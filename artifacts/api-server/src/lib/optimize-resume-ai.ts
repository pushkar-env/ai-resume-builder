import {
  completeResumeAiJson,
  clipAiInput,
} from "./resume-ai-chat";
import { compactSectionsForOptimize } from "./resume-ai-serialize";
import { logger } from "./logger";

type SectionRow = {
  id: number;
  type: string;
  title: string;
  content: unknown;
  isVisible?: boolean;
};

type OptimizeGroupResult = {
  sections: Array<{
    id: number;
    type: string;
    title: string;
    content: unknown;
  }>;
  summary: string;
};

const GROUP_ORDER: Array<"summary" | "skills" | "experience" | "projects"> = [
  "summary",
  "skills",
  "experience",
  "projects",
];

const MAX_ITEMS_PER_OPTIMIZE_CALL = 3;

function sectionItemCount(section: SectionRow): number {
  const content = section.content as { items?: unknown[] } | null;
  return Array.isArray(content?.items) ? content.items.length : 0;
}

function chunkSectionItems(section: SectionRow, maxItems: number): SectionRow[] {
  const content = section.content as { items?: unknown[] } | null;
  const items = Array.isArray(content?.items) ? content.items : [];
  if (items.length <= maxItems) return [section];

  const chunks: SectionRow[] = [];
  for (let i = 0; i < items.length; i += maxItems) {
    chunks.push({
      ...section,
      content: {
        ...(content && typeof content === "object" ? content : {}),
        items: items.slice(i, i + maxItems),
      },
    });
  }
  return chunks;
}

type OptimizeBatch = {
  group: SectionRow[];
  parentSectionId?: number;
  chunkIndex?: number;
};

function expandGroupsForBatching(groups: SectionRow[][]): OptimizeBatch[] {
  const expanded: OptimizeBatch[] = [];
  for (const group of groups) {
    if (
      group.length === 1 &&
      (group[0].type === "experience" || group[0].type === "projects") &&
      sectionItemCount(group[0]) > MAX_ITEMS_PER_OPTIMIZE_CALL
    ) {
      const chunks = chunkSectionItems(group[0], MAX_ITEMS_PER_OPTIMIZE_CALL);
      chunks.forEach((chunk, chunkIndex) => {
        expanded.push({
          group: [chunk],
          parentSectionId: group[0].id,
          chunkIndex,
        });
      });
      continue;
    }
    expanded.push({ group });
  }
  return expanded;
}

function mergeOptimizedSectionChunks(
  original: SectionRow,
  chunkResults: Array<{ id: number; type: string; title: string; content: unknown }>,
): { id: number; type: string; title: string; content: unknown } {
  const mergedItems: unknown[] = [];
  for (const chunk of chunkResults) {
    const content = chunk.content as { items?: unknown[] } | null;
    if (Array.isArray(content?.items)) {
      mergedItems.push(...content.items);
    }
  }

  return {
    id: original.id,
    type: original.type,
    title: original.title,
    content: { items: mergedItems },
  };
}

function groupSections(sections: SectionRow[]): SectionRow[][] {
  const buckets = new Map<string, SectionRow[]>();
  for (const type of GROUP_ORDER) {
    buckets.set(type, []);
  }
  for (const s of sections) {
    if (buckets.has(s.type)) {
      buckets.get(s.type)!.push(s);
    }
  }
  return GROUP_ORDER.map((t) => buckets.get(t)!).filter((g) => g.length > 0);
}

async function optimizeGroup(
  sections: SectionRow[],
  jobDescription: string,
  targetKeywords: string[] = [],
): Promise<OptimizeGroupResult> {
  const compact = compactSectionsForOptimize(sections);
  const hasJd = jobDescription.trim().length > 0;
  const jdBlock = hasJd
    ? `Target job description:\n"""${clipAiInput(jobDescription, 3_500)}"""\n\n`
    : "";
  const keywordBlock =
    targetKeywords.length > 0
      ? `\nTarget ATS keywords to incorporate where truthful (do NOT fabricate experience): ${targetKeywords.join(", ")}\n`
      : "";

  const prompt = `${jdBlock}You are an expert resume writer optimizing for ATS (Applicant Tracking System) screening. Optimize ONLY the resume sections in the JSON array below.
${hasJd ? "Align wording with the job description (keywords, stack, responsibilities) without inventing employers or degrees." : "Make content professional, ATS-friendly, and achievement-focused with quantified bullets where plausible."}
${keywordBlock}
ATS optimization goals (apply to every bullet/section):
- Start each experience bullet with a strong action verb (Led, Built, Drove, Reduced, Designed...). Remove weak phrasing like "responsible for", "worked on", "helped with".
- Make achievements measurable: add concrete metrics (%, $, time saved, scale, counts) to bullets that lack them wherever plausible — aim for at least half of all bullets quantified.
- Naturally weave in the relevant target keywords/skills above so the resume matches what the ATS screens for, only where the candidate plausibly has them.
- Keep the professional summary concise (30-60 words) with the target title and strongest keywords.

Rules:
- Return JSON: {"sections":[...],"summary":"markdown bullet list of changes"}
- Keep each section's "id", "type", and "title" unchanged
- "summary" section: 3-4 sentences in content.text (plain text, no HTML)
- "skills": keep content.style; items as {"name":"..."}
- "experience"/"projects": strong action verbs and metrics in bullets
- PRESERVE every item: return the SAME number of experience/project items you were given, in the same order. Never drop, merge, or omit an item, and never return an item with an empty title/company or empty bullets.
- PRESERVE every bullet: return at least as many bullets per item as the original. Rewrite or strengthen bullets, but never delete one.
- Do not add sections or remove ids

Sections:
${JSON.stringify(compact)}`;

  return completeResumeAiJson<OptimizeGroupResult>(
    prompt,
    `optimize-${sections.map((s) => s.type).join("-")}`,
    "optimize-section",
  );
}

function bulletText(b: unknown): string {
  if (typeof b === "string") return b.trim();
  if (b && typeof b === "object" && "text" in b) {
    return String((b as { text?: string }).text ?? "").trim();
  }
  return "";
}

export function alignOptimizedSections(
  originalSections: SectionRow[],
  optimizedSections: any[],
): Array<{ id: number; type: string; title: string; content: unknown }> {
  const aligned: Array<{ id: number; type: string; title: string; content: unknown }> = [];
  const originalIds = new Set(originalSections.map((s) => s.id));
  const matchedOriginalIds = new Set<number>();

  const findOriginalById = (id: number) => {
    if (originalIds.has(id) && !matchedOriginalIds.has(id)) {
      return originalSections.find((s) => s.id === id);
    }
    return undefined;
  };

  const findOriginalByType = (type: string) => {
    return originalSections.find((s) => s.type === type && !matchedOriginalIds.has(s.id));
  };

  const findFirstUnmatchedOriginal = () => {
    return originalSections.find((s) => !matchedOriginalIds.has(s.id));
  };

  // 1. First pass: try to match by exact ID if it belongs to this group
  for (const optSec of optimizedSections) {
    if (!optSec || typeof optSec !== "object") continue;
    const optId = typeof optSec.id === "string" ? parseInt(optSec.id, 10) : optSec.id;
    if (typeof optId === "number" && !isNaN(optId)) {
      const match = findOriginalById(optId);
      if (match) {
        aligned.push({
          id: match.id,
          type: match.type,
          title: match.title,
          content: optSec.content,
        });
        matchedOriginalIds.add(match.id);
        (optSec as any)._matched = true;
      }
    }
  }

  // 2. Second pass: for unmatched LLM sections, try to match by index if length is identical
  if (optimizedSections.length === originalSections.length) {
    for (let i = 0; i < optimizedSections.length; i++) {
      const optSec = optimizedSections[i];
      if (!optSec || typeof optSec !== "object" || optSec._matched) continue;

      const origSec = originalSections[i];
      if (origSec && !matchedOriginalIds.has(origSec.id)) {
        aligned.push({
          id: origSec.id,
          type: origSec.type,
          title: origSec.title,
          content: optSec.content,
        });
        matchedOriginalIds.add(origSec.id);
        optSec._matched = true;
      }
    }
  }

  // 3. Third pass: match by type
  for (const optSec of optimizedSections) {
    if (!optSec || typeof optSec !== "object" || optSec._matched) continue;
    if (typeof optSec.type === "string") {
      const match = findOriginalByType(optSec.type);
      if (match) {
        aligned.push({
          id: match.id,
          type: match.type,
          title: match.title,
          content: optSec.content,
        });
        matchedOriginalIds.add(match.id);
        optSec._matched = true;
      }
    }
  }

  // 4. Fourth pass: fallback to any remaining unmatched original sections in order
  for (const optSec of optimizedSections) {
    if (!optSec || typeof optSec !== "object" || optSec._matched) continue;
    const match = findFirstUnmatchedOriginal();
    if (match) {
      aligned.push({
        id: match.id,
        type: match.type,
        title: match.title,
        content: optSec.content,
      });
      matchedOriginalIds.add(match.id);
      optSec._matched = true;
    }
  }

  // Clean up temporary property
  for (const optSec of optimizedSections) {
    if (optSec && typeof optSec === "object") {
      delete optSec._matched;
    }
  }

  return aligned;
}

export function sanitizeSectionContent(type: string, content: any): any {
  if (!content) {
    return type === "summary" ? { text: "" } : { items: [] };
  }

  if (type === "summary") {
    if (typeof content === "string") {
      return { text: content };
    }
    if (typeof content === "object") {
      return { text: typeof content.text === "string" ? content.text : "" };
    }
    return { text: "" };
  }

  if (type === "skills") {
    let items: any[] = [];
    let style = "chips";

    if (Array.isArray(content)) {
      items = content;
    } else if (typeof content === "object") {
      items = Array.isArray(content.items) ? content.items : [];
      style = typeof content.style === "string" ? content.style : "chips";
    }

    const sanitizedItems = items
      .map((item: any) => {
        if (typeof item === "string") {
          return { name: item };
        }
        if (item && typeof item === "object") {
          return {
            name: typeof item.name === "string" ? item.name : (item.name ? String(item.name) : ""),
            level: typeof item.level === "number" ? item.level : undefined,
          };
        }
        return null;
      })
      .filter((item): item is { name: string; level?: number } => !!item && item.name.trim() !== "");

    return { style, items: sanitizedItems };
  }

  if (type === "experience") {
    let items: any[] = [];
    if (Array.isArray(content)) {
      items = content;
    } else if (typeof content === "object" && Array.isArray(content.items)) {
      items = content.items;
    }

    const sanitizedItems = items
      .map((item: any) => {
        if (!item || typeof item !== "object") return null;

        let bullets: string[] = [];
        if (Array.isArray(item.bullets)) {
          bullets = item.bullets
            .map((b: any) => typeof b === "string" ? b.trim() : (b && typeof b === "object" && "text" in b ? String(b.text).trim() : ""))
            .filter(Boolean);
        } else if (typeof item.bullets === "string") {
          bullets = [item.bullets.trim()];
        }

        return {
          title: typeof item.title === "string" ? item.title.trim() : (item.role && typeof item.role === "string" ? item.role.trim() : ""),
          company: typeof item.company === "string" ? item.company.trim() : "",
          location: typeof item.location === "string" ? item.location.trim() : "",
          startDate: typeof item.startDate === "string" ? item.startDate.trim() : (item.start_date && typeof item.start_date === "string" ? item.start_date.trim() : ""),
          endDate: typeof item.endDate === "string" ? item.endDate.trim() : (item.end_date && typeof item.end_date === "string" ? item.end_date.trim() : ""),
          bullets,
        };
      })
      .filter(Boolean);

    return { items: sanitizedItems };
  }

  if (type === "projects") {
    let items: any[] = [];
    if (Array.isArray(content)) {
      items = content;
    } else if (typeof content === "object" && Array.isArray(content.items)) {
      items = content.items;
    }

    const sanitizedItems = items
      .map((item: any) => {
        if (!item || typeof item !== "object") return null;

        return {
          name: typeof item.name === "string" ? item.name.trim() : (item.title && typeof item.title === "string" ? item.title.trim() : ""),
          description: typeof item.description === "string" ? item.description.trim() : "",
          url: typeof item.url === "string" ? item.url.trim() : "",
        };
      })
      .filter(Boolean);

    return { items: sanitizedItems };
  }

  return content;
}

/* ------------------------------------------------------------------ *
 * Content-preservation reconciliation.
 *
 * The optimizer occasionally drops an experience/project item, drops all
 * the bullets of an item, or blanks out a field. These helpers diff the
 * optimized content against the (sanitized) original and guarantee that
 * optimization can only *rewrite* content, never lose it:
 *   - no item is ever dropped (count never decreases),
 *   - an item's bullet count never decreases,
 *   - any field the model blanked is restored from the original,
 *   - genuinely-empty items are stripped so they don't render as empty
 *     timeline markers in the preview.
 * ------------------------------------------------------------------ */

const norm = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "");

/** Prefer a non-empty optimized string, otherwise fall back to the original. */
function preferred(optValue: unknown, origValue: unknown): string {
  const opt = typeof optValue === "string" ? optValue.trim() : "";
  if (opt) return opt;
  return typeof origValue === "string" ? origValue.trim() : "";
}

function experienceItemHasContent(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  const hasIdentity = [item.title, item.company, item.location, item.startDate, item.endDate].some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
  const hasBullets = Array.isArray(item.bullets) && item.bullets.some((b: any) => bulletText(b) !== "");
  return hasIdentity || hasBullets;
}

function projectItemHasContent(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  return [item.name, item.description, item.url].some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
}

function bulletList(item: any): string[] {
  return Array.isArray(item?.bullets) ? item.bullets.map(bulletText).filter(Boolean) : [];
}

function mergeExperienceItem(orig: any, opt: any): any {
  // No usable optimized counterpart -> keep the original verbatim.
  if (!opt || !experienceItemHasContent(opt)) return orig;

  const optBullets = bulletList(opt);
  const origBullets = bulletList(orig);
  // Never let optimization reduce the number of bullets. If the model
  // returned fewer non-empty bullets than the original, keep the originals.
  const bullets = optBullets.length >= origBullets.length ? optBullets : origBullets;

  return {
    title: preferred(opt.title, orig.title),
    company: preferred(opt.company, orig.company),
    location: preferred(opt.location, orig.location),
    startDate: preferred(opt.startDate, orig.startDate),
    endDate: preferred(opt.endDate, orig.endDate),
    bullets,
  };
}

function mergeProjectItem(orig: any, opt: any): any {
  if (!opt || !projectItemHasContent(opt)) return orig;
  return {
    name: preferred(opt.name, orig.name),
    description: preferred(opt.description, orig.description),
    url: preferred(opt.url, orig.url),
  };
}

/**
 * Pair each original item with its best optimized counterpart. The optimizer
 * keeps employers/titles stable, so we match on company/title (resilient to a
 * dropped or reordered item), then fill any leftovers positionally.
 */
function pairItems(
  origItems: any[],
  optItems: any[],
  keyOf: (item: any) => string[],
): Array<{ orig: any; opt: any | null }> {
  const usedOpt = new Set<number>();
  const pairs: Array<{ orig: any; opt: any | null }> = origItems.map((orig) => {
    const origKeys = keyOf(orig).filter(Boolean);
    const matchIdx = optItems.findIndex(
      (opt, idx) =>
        !usedOpt.has(idx) &&
        opt &&
        keyOf(opt).filter(Boolean).some((k) => origKeys.includes(k)),
    );
    if (matchIdx !== -1) {
      usedOpt.add(matchIdx);
      return { orig, opt: optItems[matchIdx] };
    }
    return { orig, opt: null };
  });

  // Assign remaining unmatched optimized items to still-unpaired originals, in order.
  let cursor = 0;
  for (let i = 0; i < optItems.length; i++) {
    if (usedOpt.has(i)) continue;
    while (cursor < pairs.length && pairs[cursor].opt) cursor++;
    if (cursor >= pairs.length) break;
    pairs[cursor].opt = optItems[i];
    usedOpt.add(i);
    cursor++;
  }

  return pairs;
}

/**
 * Reconcile a single optimized section against its sanitized original so that
 * optimization never loses content. Both inputs must already be sanitized.
 */
export function reconcileSectionContent(type: string, original: any, optimized: any): any {
  if (type === "summary") {
    const optText = typeof optimized?.text === "string" ? optimized.text.trim() : "";
    const origText = typeof original?.text === "string" ? original.text.trim() : "";
    return { text: optText || origText };
  }

  if (type === "skills") {
    const optItems = Array.isArray(optimized?.items) ? optimized.items : [];
    const origItems = Array.isArray(original?.items) ? original.items : [];
    // Only guard against a total wipe-out; otherwise trust the optimized list.
    if (optItems.length === 0 && origItems.length > 0) {
      return { style: optimized?.style ?? original?.style ?? "chips", items: origItems };
    }
    return optimized;
  }

  if (type === "experience") {
    const origItems = Array.isArray(original?.items) ? original.items : [];
    const optItems = Array.isArray(optimized?.items) ? optimized.items : [];
    const expKey = (it: any) => `${norm(it?.company)}|${norm(it?.title)}`;
    const merged = pairItems(origItems, optItems, (it) => [norm(it?.company), norm(it?.title)]).map(
      ({ orig, opt }) => mergeExperienceItem(orig, opt),
    );
    // Append any genuinely new, meaningful optimized item not already represented.
    const mergedKeys = new Set(merged.map(expKey));
    for (const opt of optItems) {
      if (experienceItemHasContent(opt) && !mergedKeys.has(expKey(opt))) {
        merged.push(opt);
        mergedKeys.add(expKey(opt));
      }
    }
    return { items: merged.filter(experienceItemHasContent) };
  }

  if (type === "projects") {
    const origItems = Array.isArray(original?.items) ? original.items : [];
    const optItems = Array.isArray(optimized?.items) ? optimized.items : [];
    const merged = pairItems(origItems, optItems, (it) => [norm(it?.name)]).map(({ orig, opt }) =>
      mergeProjectItem(orig, opt),
    );
    return { items: merged.filter(projectItemHasContent) };
  }

  return optimized;
}

/**
 * Optimize resume in parallel section groups — faster and more reliable than one huge completion.
 */
export async function optimizeResumeWithAi(
  sections: SectionRow[],
  jobDescription: string,
  options: { targetKeywords?: string[] } = {},
): Promise<{ sections: OptimizeGroupResult["sections"]; summary: string }> {
  const targetKeywords = options.targetKeywords ?? [];
  const batches = expandGroupsForBatching(groupSections(sections));
  const batchedOriginals = new Map<number, SectionRow>();
  for (const section of sections) {
    if (
      (section.type === "experience" || section.type === "projects") &&
      sectionItemCount(section) > MAX_ITEMS_PER_OPTIMIZE_CALL
    ) {
      batchedOriginals.set(section.id, section);
    }
  }

  const chunkResultsBySectionId = new Map<
    number,
    Array<{ chunkIndex: number; section: { id: number; type: string; title: string; content: unknown } }>
  >();

  const results = await Promise.all(
    batches.map(async ({ group, parentSectionId, chunkIndex }) => {
      const result = await optimizeGroup(group, jobDescription, targetKeywords);
      const aligned = alignOptimizedSections(group, result.sections || []);
      const sanitized = aligned.map((s) => ({
        ...s,
        content: sanitizeSectionContent(s.type, s.content),
      }));

      if (
        parentSectionId != null &&
        chunkIndex != null &&
        batchedOriginals.has(parentSectionId) &&
        sanitized[0]
      ) {
        const existing = chunkResultsBySectionId.get(parentSectionId) ?? [];
        existing.push({ chunkIndex, section: sanitized[0] });
        chunkResultsBySectionId.set(parentSectionId, existing);
        return { ...result, sections: [], summary: result.summary };
      }

      return { ...result, sections: sanitized };
    }),
  );

  const mergedSections = results.flatMap((r) => r.sections ?? []);
  for (const [sectionId, chunks] of chunkResultsBySectionId) {
    const original = batchedOriginals.get(sectionId);
    if (!original || chunks.length === 0) continue;

    const orderedChunks = [...chunks]
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((entry) => entry.section);
    const merged = mergeOptimizedSectionChunks(original, orderedChunks);
    mergedSections.push({
      ...merged,
      content: sanitizeSectionContent(original.type, merged.content),
    });
  }

  // Content-preservation pass: guarantee optimization never drops items,
  // bullets, or fields relative to the original (and never emits empty items).
  const originalById = new Map(sections.map((s) => [s.id, s]));
  const reconciledSections = mergedSections.map((opt) => {
    const original = originalById.get(opt.id);
    if (!original) return opt;
    const originalSanitized = sanitizeSectionContent(original.type, original.content);
    return {
      ...opt,
      content: reconcileSectionContent(opt.type, originalSanitized, opt.content),
    };
  });

  const summary = results
    .map((r) => r.summary?.trim())
    .filter(Boolean)
    .join("\n");

  return { sections: reconciledSections, summary };
}

/**
 * Rephrase detailed or ambiguous target job titles into a general & relevant job title.
 */
export async function rephraseJobTitle(
  jobTitle: string,
  jobDescription?: string,
): Promise<string> {
  if (!jobTitle.trim()) return "";

  const jdBlock = jobDescription ? `Job Description:\n"""${clipAiInput(jobDescription, 1000)}"""\n\n` : "";
  const prompt = `${jdBlock}You are a professional resume writer and recruitment assistant.
Your task is to rephrase detailed, ambiguous, or overly specific target job titles into a clean, general, and industry-standard job title for the resume.

Guidelines:
1. Simplify complex/detailed titles by removing company-specific teams, divisions, departments, or internal projects (e.g. "Software Development Engineer - Amazon Photos" -> "Software Development Engineer" or "Software Engineer").
2. Rephrase confusingly structured titles into a standard format (e.g. "Engineering Division - , AI Research - Vice President" -> "Vice President, AI Research" or "Vice President of AI Research").
3. Retain the level of seniority (e.g. Lead, Senior, Vice President, Director, Junior) if explicit in the title.
4. Keep the job title concise (typically 2-4 words).
5. If the title is already simple, standard, and relevant, return it unchanged.
6. Output ONLY a JSON object with a single key "jobTitle" containing the rephrased string. Example format: {"jobTitle": "Software Development Engineer"}

Current Job Title to process: "${jobTitle}"`;

  try {
    const result = await completeResumeAiJson<{ jobTitle: string }>(
      prompt,
      "rephrase-job-title",
      "standard",
    );
    return (result?.jobTitle || jobTitle).trim();
  } catch (err) {
    logger.error({ error: err, jobTitle }, "Failed to rephrase job title, using fallback");
    return jobTitle;
  }
}

