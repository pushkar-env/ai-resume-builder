import { completeResumeAiJson, clipAiInput } from "./resume-ai-chat";
import { logger } from "./logger";

/**
 * Deterministic, rubric-based ATS scoring engine.
 *
 * The previous implementation asked the LLM for a free-form 0-100 score with no
 * rubric, which produced inconsistent results across identical scans and feedback
 * that wasn't tied to anything the optimizer fixes. This engine instead computes
 * the score from concrete, measurable checks (weights sum to 100), so the same
 * resume always yields the same score, every check is explainable, and every
 * failed check maps to a specific, actionable fix that the optimizer addresses.
 *
 * The only non-deterministic input is the set of keywords extracted from the job
 * description (LLM with a deterministic fallback); the keyword *matching* and the
 * score itself are fully deterministic.
 */

type SectionRow = {
  id: number;
  type: string;
  title: string;
  content: unknown;
  isVisible?: boolean;
};

export type AtsCheckStatus = "pass" | "partial" | "fail";

export type AtsCheck = {
  id: string;
  label: string;
  weight: number;
  earned: number;
  status: AtsCheckStatus;
  /** Specific, data-driven fix shown to the user when the check is not a full pass. */
  fix?: string;
};

export type AtsResult = {
  score: number;
  passedChecks: string[];
  failedChecks: string[];
  feedback: string[];
  /** Detailed breakdown — useful for debugging/telemetry; not all of it is persisted. */
  checks: AtsCheck[];
  /** JD keywords still missing from the resume — fed to the optimizer to close the loop. */
  missingKeywords: string[];
};

/* --------------------------------- helpers -------------------------------- */

const STRONG_ACTION_VERBS = new Set([
  "led", "built", "designed", "developed", "launched", "shipped", "drove", "delivered",
  "created", "architected", "implemented", "engineered", "spearheaded", "founded",
  "improved", "increased", "reduced", "cut", "grew", "scaled", "optimized", "streamlined",
  "accelerated", "boosted", "generated", "saved", "won", "achieved", "exceeded", "automated",
  "managed", "owned", "directed", "coordinated", "mentored", "coached", "trained", "hired",
  "negotiated", "secured", "established", "launched", "migrated", "modernized", "refactored",
  "redesigned", "rebuilt", "deployed", "integrated", "analyzed", "researched", "forecasted",
  "championed", "transformed", "overhauled", "pioneered", "initiated", "executed", "orchestrated",
  "resolved", "eliminated", "consolidated", "standardized", "unified", "enhanced", "expanded",
  "introduced", "released", "maintained", "diagnosed", "debugged", "tested", "validated",
]);

const WEAK_PHRASES = [
  "responsible for", "responsible of", "worked on", "duties included", "duties include",
  "helped with", "helped to", "assisted with", "assisted in", "in charge of", "tasked with",
  "involved in", "participated in", "contributed to", "was part of", "responsibilities included",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "our", "will", "have", "has", "this",
  "that", "from", "they", "their", "them", "all", "any", "can", "but", "not", "who", "what",
  "when", "where", "how", "why", "which", "into", "out", "over", "under", "about", "across",
  "per", "via", "etc", "such", "also", "more", "most", "than", "then", "use", "used", "using",
  "able", "must", "should", "would", "could", "may", "might", "well", "good", "great", "strong",
  "work", "working", "role", "team", "teams", "year", "years", "experience", "experiences",
  "job", "candidate", "candidates", "position", "company", "companies", "ability", "skills",
  "skill", "knowledge", "including", "include", "includes", "required", "requirements",
  "responsibilities", "responsibility", "preferred", "plus", "looking", "join", "us", "we",
  "a", "an", "in", "on", "of", "to", "is", "be", "as", "at", "or", "it", "by", "if", "do",
]);

function getSection(sections: SectionRow[], type: string): SectionRow | undefined {
  return sections.find((s) => s.type === type && s.isVisible !== false);
}

function bulletText(b: unknown): string {
  if (typeof b === "string") return b.trim();
  if (b && typeof b === "object" && "text" in b) {
    return String((b as { text?: string }).text ?? "").trim();
  }
  return "";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

/** A bullet "has a metric" if it contains a number, percentage, money figure, or scale word. */
function hasMetric(bullet: string): boolean {
  if (/\d/.test(bullet)) return true;
  return /\b(million|billion|thousand|hundred|double|tripled|doubled|quadrupled)\b/i.test(bullet);
}

function firstWord(text: string): string {
  const m = text.trim().toLowerCase().match(/[a-z]+/);
  return m ? m[0] : "";
}

function startsWithActionVerb(bullet: string): boolean {
  return STRONG_ACTION_VERBS.has(firstWord(bullet));
}

function containsWeakPhrase(bullet: string): boolean {
  const low = bullet.toLowerCase();
  return WEAK_PHRASES.some((p) => low.includes(p));
}

function tokenize(text: string): string[] {
  return stripHtml(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^[.]+|[.]+$/g, ""))
    .filter((t) => t.length >= 2);
}

type ExperienceItem = {
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets?: unknown[];
};

function getExperienceItems(sections: SectionRow[]): ExperienceItem[] {
  const exp = getSection(sections, "experience");
  const content = exp?.content as { items?: ExperienceItem[] } | null;
  return Array.isArray(content?.items) ? content!.items! : [];
}

function getAllBullets(sections: SectionRow[]): string[] {
  const bullets: string[] = [];
  for (const item of getExperienceItems(sections)) {
    if (Array.isArray(item.bullets)) {
      for (const b of item.bullets) {
        const t = bulletText(b);
        if (t) bullets.push(t);
      }
    }
  }
  return bullets;
}

/** Lowercased plain-text corpus of the whole resume, for keyword matching. */
function buildResumeCorpus(sections: SectionRow[]): { text: string; tokens: Set<string> } {
  const parts: string[] = [];
  for (const s of sections) {
    if (s.isVisible === false) continue;
    const c = s.content as Record<string, unknown> | null;
    if (!c) continue;

    if (s.type === "summary" && typeof c.text === "string") {
      parts.push(stripHtml(c.text));
    } else if (Array.isArray(c.items)) {
      for (const item of c.items as Record<string, unknown>[]) {
        if (!item) continue;
        for (const key of ["name", "title", "company", "role", "description", "school", "degree", "issuer"]) {
          if (typeof item[key] === "string") parts.push(item[key] as string);
        }
        if (Array.isArray(item.bullets)) {
          for (const b of item.bullets) parts.push(bulletText(b));
        }
      }
    }
  }
  const text = parts.join(" \n ").toLowerCase();
  return { text, tokens: new Set(tokenize(text)) };
}

/** Does a (possibly multi-word) keyword appear in the resume corpus? */
function keywordPresent(keyword: string, corpus: { text: string; tokens: Set<string> }): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  if (kw.includes(" ") || kw.includes("/")) {
    return corpus.text.includes(kw);
  }
  if (corpus.tokens.has(kw)) return true;
  // Token-boundary match for things like "ci/cd", "node.js".
  return corpus.text.includes(kw);
}

/* --------------------------- keyword extraction --------------------------- */

/**
 * Extract the most relevant hard-skill / tool / role keywords from a job
 * description. Uses the LLM for relevance with a deterministic fallback so the
 * scorer always works even if the AI call fails.
 */
export async function extractJobKeywords(jobDescription: string): Promise<string[]> {
  const jd = jobDescription.trim();
  if (!jd) return [];

  try {
    const prompt = `Extract the most important ATS keywords from this job description: the hard skills, tools, technologies, platforms, methodologies, certifications, and role-specific terms a resume would be screened for. Ignore generic soft skills and filler.

Return JSON only: {"keywords":["keyword1","keyword2"]}
- 12 to 20 keywords, each 1-3 words, lowercase, deduplicated, ordered by importance.

Job description:
"""${clipAiInput(jd, 3_500)}"""`;

    const result = await completeResumeAiJson<{ keywords?: unknown[] }>(
      prompt,
      "ats-extract-keywords",
      "ats-score",
    );
    const keywords = Array.isArray(result?.keywords)
      ? result.keywords
          .map((k) => String(k).trim().toLowerCase())
          .filter((k) => k.length >= 2 && k.length <= 40)
      : [];
    const deduped = Array.from(new Set(keywords)).slice(0, 20);
    if (deduped.length > 0) return deduped;
  } catch (err) {
    logger.warn({ error: err }, "JD keyword extraction failed, using deterministic fallback");
  }

  return fallbackExtractKeywords(jd);
}

/** Frequency-based keyword extraction used when the LLM call is unavailable. */
function fallbackExtractKeywords(jobDescription: string): string[] {
  const freq = new Map<string, number>();
  for (const token of tokenize(jobDescription)) {
    if (STOPWORDS.has(token) || token.length < 3) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([word]) => word);
}

/* ------------------------------ the rubric -------------------------------- */

function pct(part: number, whole: number): number {
  return whole <= 0 ? 0 : part / whole;
}

function statusFor(earned: number, weight: number): AtsCheckStatus {
  if (earned >= weight - 1e-9) return "pass";
  if (earned <= 0) return "fail";
  return "partial";
}

/**
 * Build the full set of weighted checks. Weights sum to 100.
 */
function buildChecks(
  sections: SectionRow[],
  jobDescription: string,
  jdKeywords: string[],
): { checks: AtsCheck[]; missingKeywords: string[] } {
  const checks: AtsCheck[] = [];
  const personal = (getSection(sections, "personal")?.content as Record<string, unknown>) ?? {};
  const summary = getSection(sections, "summary")?.content as { text?: string } | null;
  const skills = getSection(sections, "skills")?.content as { items?: unknown[] } | null;
  const expItems = getExperienceItems(sections);
  const bullets = getAllBullets(sections);
  const corpus = buildResumeCorpus(sections);

  // 1. Contact information (10): email 4, phone 3, location 3.
  {
    const weight = 10;
    let earned = 0;
    const missing: string[] = [];
    if (personal.email) earned += 4; else missing.push("email");
    if (personal.phone) earned += 3; else missing.push("phone number");
    if (personal.location) earned += 3; else missing.push("location");
    checks.push({
      id: "contact",
      label: "Contact information complete",
      weight,
      earned,
      status: statusFor(earned, weight),
      fix: missing.length ? `Add your ${missing.join(", ")} to the header so ATS and recruiters can reach you.` : undefined,
    });
  }

  // 2. Professional links (5): at least one LinkedIn/GitHub/portfolio link.
  {
    const weight = 5;
    const socials = Array.isArray((personal as any).socials) ? (personal as any).socials : [];
    const hasLink = socials.some((s: any) => typeof s?.url === "string" && s.url.trim().length > 0);
    const earned = hasLink ? weight : 0;
    checks.push({
      id: "links",
      label: "Professional link present (LinkedIn/portfolio)",
      weight,
      earned,
      status: statusFor(earned, weight),
      fix: hasLink ? undefined : "Add a LinkedIn, GitHub, or portfolio URL — recruiters expect at least one professional link.",
    });
  }

  // 3. Professional summary (10): present and adequate length.
  {
    const weight = 10;
    const text = stripHtml(String(summary?.text ?? "")).trim();
    const words = wordCount(text);
    let earned = 0;
    let fix: string | undefined;
    if (words >= 30 && words <= 90) earned = weight;
    else if (words >= 15) { earned = weight * 0.5; fix = `Your summary is ${words} words. Aim for 30-60 words covering your title, years of experience, and top strengths.`; }
    else { earned = 0; fix = "Add a 30-60 word professional summary with your target title, experience level, and strongest skills/keywords."; }
    checks.push({ id: "summary", label: "Strong professional summary", weight, earned, status: statusFor(earned, weight), fix });
  }

  // 4. Work experience completeness (12): items with title, company and dates.
  {
    const weight = 12;
    let earned = 0;
    let fix: string | undefined;
    if (expItems.length === 0) {
      fix = "Add at least one work experience entry with title, company, dates, and achievement bullets.";
    } else {
      let fieldScore = 0;
      const maxFields = expItems.length * 3;
      let missingDates = 0;
      for (const item of expItems) {
        if (item.title && String(item.title).trim()) fieldScore++;
        if (item.company && String(item.company).trim()) fieldScore++;
        if ((item.startDate && String(item.startDate).trim()) || (item.endDate && String(item.endDate).trim())) fieldScore++;
        else missingDates++;
      }
      earned = weight * pct(fieldScore, maxFields);
      if (earned < weight) {
        fix = missingDates > 0
          ? `${missingDates} experience ${missingDates === 1 ? "entry is" : "entries are"} missing dates. Add start/end dates (e.g. "Jan 2021 – Present") to every role.`
          : "Complete each experience entry with a job title, company, and dates.";
      }
    }
    checks.push({ id: "experience", label: "Complete work experience entries", weight, earned, status: statusFor(earned, weight), fix });
  }

  // 5. Experience depth (8): adequate bullets per role (>= 3 ideal).
  {
    const weight = 8;
    let earned = 0;
    let fix: string | undefined;
    if (expItems.length === 0) {
      fix = "Add achievement bullets under your work experience.";
    } else {
      const avg = bullets.length / expItems.length;
      if (avg >= 3) earned = weight;
      else if (avg >= 1.5) { earned = weight * 0.5; fix = `You average ${avg.toFixed(1)} bullets per role. Aim for 3-5 achievement bullets on each recent role.`; }
      else { earned = weight * 0.2; fix = "Add 3-5 achievement-focused bullet points to each work experience entry."; }
    }
    checks.push({ id: "depth", label: "Sufficient achievement bullets", weight, earned, status: statusFor(earned, weight), fix });
  }

  // 6. Quantified achievements (15): fraction of bullets with metrics.
  {
    const weight = 15;
    const withMetric = bullets.filter(hasMetric).length;
    const ratio = pct(withMetric, bullets.length);
    let earned: number;
    let fix: string | undefined;
    if (bullets.length === 0) {
      earned = 0;
      fix = "Add measurable, quantified achievements (%, $, time saved, scale) to your experience.";
    } else if (ratio >= 0.5) {
      earned = weight;
    } else {
      earned = weight * (ratio / 0.5); // linear ramp up to the 50% target
      const target = Math.max(1, Math.ceil(bullets.length * 0.5) - withMetric);
      fix = `Only ${withMetric} of ${bullets.length} bullets include measurable results. Add numbers/metrics (%, $, time, scale) to at least ${target} more.`;
    }
    checks.push({ id: "quantified", label: "Quantified, measurable achievements", weight, earned, status: statusFor(earned, weight), fix });
  }

  // 7. Action verbs & strong language (8): bullets lead with action verbs, avoid weak phrasing.
  {
    const weight = 8;
    let earned = 0;
    let fix: string | undefined;
    if (bullets.length === 0) {
      fix = "Write achievement bullets that begin with strong action verbs (Led, Built, Reduced).";
    } else {
      const strong = bullets.filter((b) => startsWithActionVerb(b)).length;
      const weak = bullets.filter((b) => containsWeakPhrase(b)).length;
      const strongRatio = pct(strong, bullets.length);
      earned = weight * strongRatio;
      if (weak > 0) earned = Math.max(0, earned - Math.min(weight * 0.5, weak * (weight / bullets.length)));
      if (earned < weight) {
        if (weak > 0) fix = `${weak} bullet${weak === 1 ? "" : "s"} use weak phrasing like "responsible for". Lead with strong action verbs (Led, Built, Drove, Reduced).`;
        else fix = `Only ${strong} of ${bullets.length} bullets start with a strong action verb. Start each bullet with one (e.g. Led, Built, Optimized).`;
      }
    }
    earned = Math.max(0, Math.min(weight, earned));
    checks.push({ id: "action-verbs", label: "Strong action verbs in bullets", weight, earned, status: statusFor(earned, weight), fix });
  }

  // 8. Skills coverage (10): adequate count.
  {
    const weight = 10;
    const count = Array.isArray(skills?.items) ? skills!.items!.length : 0;
    let earned: number;
    let fix: string | undefined;
    if (count >= 8) earned = weight;
    else if (count >= 5) { earned = weight * 0.6; fix = `You list ${count} skills. Add a few more relevant tools/technologies to reach 8-12 for better keyword coverage.`; }
    else { earned = weight * pct(count, 5) * 0.6; fix = `List at least 8-12 relevant skills — you currently have ${count}.`; }
    checks.push({ id: "skills", label: "Adequate skills listed", weight, earned, status: statusFor(earned, weight), fix });
  }

  // 9. Keyword match vs JD (15) — or keyword richness when there is no JD.
  let missingKeywords: string[] = [];
  {
    const weight = 15;
    const hasJd = jobDescription.trim().length > 0;
    let earned: number;
    let fix: string | undefined;
    let label: string;

    if (hasJd && jdKeywords.length > 0) {
      label = "Keyword match with job description";
      const present = jdKeywords.filter((k) => keywordPresent(k, corpus));
      missingKeywords = jdKeywords.filter((k) => !keywordPresent(k, corpus));
      const ratio = pct(present.length, jdKeywords.length);
      earned = weight * ratio;
      if (ratio < 0.85) {
        const show = missingKeywords.slice(0, 6).join(", ");
        fix = `Your resume is missing ${missingKeywords.length} key term${missingKeywords.length === 1 ? "" : "s"} from the job description${show ? `: ${show}` : ""}. Weave the ones you genuinely have into your summary, skills, and experience.`;
      }
    } else {
      // No JD: reward overall keyword richness so a detailed resume isn't penalised.
      label = "Keyword richness";
      const distinct = new Set(Array.from(corpus.tokens).filter((t) => t.length >= 3 && !STOPWORDS.has(t)));
      const ratio = Math.min(1, distinct.size / 60);
      earned = weight * ratio;
      if (ratio < 0.85) {
        fix = "Paste a target job description to get precise keyword-match scoring, and enrich your skills/experience with role-specific tools and technologies.";
      }
    }
    checks.push({ id: "keywords", label, weight, earned, status: statusFor(earned, weight), fix });
  }

  // 10. Formatting & length / ATS safety (7).
  {
    const weight = 7;
    const allText = buildResumeCorpus(sections).text;
    const words = wordCount(allText);
    let earned = 0;
    let fix: string | undefined;
    // Healthy length band.
    if (words >= 350 && words <= 900) earned += 4;
    else if (words >= 200 && words <= 1100) earned += 2;
    if (words < 200) fix = "Your resume looks thin. Add more detail to experience and skills (aim for 400-800 words).";
    else if (words > 1100) fix = "Your resume is very long. Trim to the most relevant, recent achievements (aim for 400-800 words).";
    // Dates present across experience.
    const datedRoles = expItems.filter((i) => (i.startDate && String(i.startDate).trim()) || (i.endDate && String(i.endDate).trim())).length;
    if (expItems.length === 0 || datedRoles === expItems.length) earned += 3;
    else { earned += 1.5; if (!fix) fix = "Add dates to every work experience entry — ATS parsers rely on them to build your timeline."; }
    earned = Math.min(weight, earned);
    checks.push({ id: "formatting", label: "ATS-safe formatting & length", weight, earned, status: statusFor(earned, weight), fix });
  }

  return { checks, missingKeywords };
}

/**
 * Compute the full ATS result from structured sections. Deterministic given the
 * resume and the extracted JD keywords.
 */
export function computeAtsResult(
  sections: SectionRow[],
  jobDescription: string,
  jdKeywords: string[],
): AtsResult {
  const { checks, missingKeywords } = buildChecks(sections, jobDescription, jdKeywords);

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const totalEarned = checks.reduce((sum, c) => sum + c.earned, 0);
  const score = Math.max(0, Math.min(100, Math.round(pct(totalEarned, totalWeight) * 100)));

  const passedChecks = checks.filter((c) => c.status === "pass").map((c) => c.label);
  // Fails and partials are both actionable — surface them as fixes.
  const actionable = checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => (b.weight - b.earned) - (a.weight - a.earned)); // biggest point gaps first

  const failedChecks = actionable.map((c) => c.label);
  const feedback = actionable.map((c) => c.fix).filter((f): f is string => !!f).slice(0, 6);

  return { score, passedChecks, failedChecks, feedback, checks, missingKeywords };
}

/**
 * Full scoring entrypoint: extract JD keywords (if any) then compute the result.
 */
export async function scoreResumeAts(
  sections: SectionRow[],
  jobDescription: string,
): Promise<AtsResult> {
  const jd = (jobDescription ?? "").trim();
  const jdKeywords = jd ? await extractJobKeywords(jd) : [];
  return computeAtsResult(sections, jd, jdKeywords);
}
