import {
  completeResumeAiJson,
  clipAiInput,
} from "./resume-ai-chat";
import { compactSectionsForOptimize } from "./resume-ai-serialize";

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
): Promise<OptimizeGroupResult> {
  const compact = compactSectionsForOptimize(sections);
  const hasJd = jobDescription.trim().length > 0;
  const jdBlock = hasJd
    ? `Target job description:\n"""${clipAiInput(jobDescription, 3_500)}"""\n\n`
    : "";

  const prompt = `${jdBlock}You are an expert resume writer. Optimize ONLY the resume sections in the JSON array below.
${hasJd ? "Align wording with the job description (keywords, stack, responsibilities) without inventing employers or degrees." : "Make content professional, ATS-friendly, and achievement-focused with quantified bullets where plausible."}

Rules:
- Return JSON: {"sections":[...],"summary":"markdown bullet list of changes"}
- Keep each section's "id", "type", and "title" unchanged
- "summary" section: 3-4 sentences in content.text (plain text, no HTML)
- "skills": keep content.style; items as {"name":"..."}
- "experience"/"projects": strong action verbs and metrics in bullets
- Do not add sections or remove ids

Sections:
${JSON.stringify(compact)}`;

  return completeResumeAiJson<OptimizeGroupResult>(
    prompt,
    `optimize-${sections.map((s) => s.type).join("-")}`,
    "optimize-section",
  );
}

/**
 * Optimize resume in parallel section groups — faster and more reliable than one huge completion.
 */
export async function optimizeResumeWithAi(
  sections: SectionRow[],
  jobDescription: string,
): Promise<{ sections: OptimizeGroupResult["sections"]; summary: string }> {
  const groups = groupSections(sections);
  const results = await Promise.all(
    groups.map((group) => optimizeGroup(group, jobDescription)),
  );

  const mergedSections = results.flatMap((r) => r.sections ?? []);
  const summary = results
    .map((r) => r.summary?.trim())
    .filter(Boolean)
    .join("\n");

  return { sections: mergedSections, summary };
}
