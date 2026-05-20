import { Router, type IRouter, type Request, type Response } from "express";
import {
  GenerateSummaryBody,
  ImproveBulletBody,
  SuggestSkillsBody,
  GetAtsSuggestionsBody,
  GenerateSummaryResponse,
  ImproveBulletResponse,
  SuggestSkillsResponse,
  GetAtsSuggestionsResponse,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const AI_ROUTE_TIMEOUT_MS = 75_000;

type ChatCompletionResult = {
  choices: Array<{ message?: { content?: string | null } }>;
};

async function withAiTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${AI_ROUTE_TIMEOUT_MS}ms`)),
          AI_ROUTE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function requireAuth(req: Request, res: Response, next: any): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

router.post("/ai/generate-summary", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
  const parsed = GenerateSummaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobTitle, yearsOfExperience, skills, industry, currentText } = parsed.data;

  const role = jobTitle?.trim() || "professional";
  const baseDescriptor = `for a ${role}${industry ? ` in ${industry}` : ""}${yearsOfExperience ? ` with ${yearsOfExperience} years of experience` : ""}${skills && skills.length > 0 ? `. Key skills: ${skills.join(", ")}` : ""}`;

  const prompt = currentText && currentText.trim().length > 0
    ? `Refine and polish the following professional resume summary ${baseDescriptor}. Keep the candidate's core message, voice and any specific details intact, but improve clarity, impact and ATS keywords. Aim for 3-4 sentences, written in first person without using "I". Output ONLY the rewritten summary text, no labels or quotes.\n\nDraft:\n"""${currentText.trim()}"""`
    : `Write a compelling professional resume summary ${baseDescriptor}. The summary should be 3-4 sentences, quantified where possible, ATS-optimized, and written in first person without using "I". Output only the summary text, no labels or quotes.`;

  const callModel = async (tokens: number): Promise<ChatCompletionResult> =>
    (openai.chat.completions.create as any)({
      model: "gpt-5-mini",
      max_completion_tokens: tokens,
      messages: [{ role: "user", content: prompt }],
      // gpt-5 family supports reasoning_effort; "minimal" leaves the most budget for actual content
      ...({ reasoning_effort: "minimal" } as Record<string, unknown>),
    }) as Promise<ChatCompletionResult>;

  let completion = await withAiTimeout(callModel(1200), "generate-summary");
  let text = (completion.choices[0]?.message?.content ?? "").trim();
  if (!text) {
    req.log?.warn?.({ msg: "generate-summary returned empty content, retrying with larger budget" });
    completion = await withAiTimeout(callModel(2400), "generate-summary-retry");
    text = (completion.choices[0]?.message?.content ?? "").trim();
  }
  res.json(GenerateSummaryResponse.parse({ text }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    const status = /timed out/i.test(msg) ? 504 : 500;
    res.status(status).json({ error: msg });
  }
});

router.post("/ai/improve-bullet", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
  const parsed = ImproveBulletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { bullet, context } = parsed.data;

  const prompt = `Improve this resume bullet point to be more impactful, quantified, and ATS-friendly${context ? ` (context: ${context})` : ""}:\n\n"${bullet}"\n\nRewrite it as a single, powerful bullet point starting with a strong action verb. Include metrics/numbers if possible. Output only the improved bullet text, no quotes.`;

  const completion = await withAiTimeout(
    (openai.chat.completions.create as any)({
      model: "gpt-5-mini",
      max_completion_tokens: 800,
      messages: [{ role: "user", content: prompt }],
      ...({ reasoning_effort: "minimal" } as Record<string, unknown>),
    }) as Promise<ChatCompletionResult>,
    "improve-bullet",
  );

  const text = (completion.choices[0]?.message?.content ?? "").trim();
  res.json(ImproveBulletResponse.parse({ text }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    const status = /timed out/i.test(msg) ? 504 : 500;
    res.status(status).json({ error: msg });
  }
});

router.post("/ai/suggest-skills", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
  const parsed = SuggestSkillsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobTitle, industry, existingSkills, summary } = parsed.data;

  const role = jobTitle?.trim() || "professional";
  const prompt = `Suggest 10 relevant technical and soft skills for a ${role}${industry ? ` in ${industry}` : ""}${existingSkills && existingSkills.length > 0 ? `. They already have: ${existingSkills.join(", ")} (do NOT repeat these)` : ""}${summary && summary.trim().length > 0 ? `. Use this candidate context to personalise suggestions: """${summary.trim().slice(0, 600)}"""` : ""}. Focus on ATS-friendly, in-demand skills. Return ONLY a JSON array of skill strings, nothing else. Example: ["Skill 1", "Skill 2"]`;

  const completion = await withAiTimeout(
    (openai.chat.completions.create as any)({
      model: "gpt-5-mini",
      max_completion_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
      ...({ reasoning_effort: "minimal" } as Record<string, unknown>),
    }) as Promise<ChatCompletionResult>,
    "suggest-skills",
  );

  let skills: string[] = [];
  try {
    const content = completion.choices[0]?.message?.content ?? "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      skills = JSON.parse(jsonMatch[0]);
    }
  } catch {
    skills = [];
  }

  res.json(SuggestSkillsResponse.parse({ skills }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    const status = /timed out/i.test(msg) ? 504 : 500;
    res.status(status).json({ error: msg });
  }
});

router.post("/ai/ats-suggestions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
  const parsed = GetAtsSuggestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { resumeContent, jobDescription } = parsed.data;

  const prompt = `Analyze this resume content for ATS optimization${jobDescription ? " against the provided job description" : ""}.\n\nResume:\n${resumeContent}${jobDescription ? `\n\nJob Description:\n${jobDescription}` : ""}\n\nReturn ONLY a JSON object with this exact structure:\n{"suggestions": ["suggestion 1", ...], "keywords": ["keyword 1", ...], "score": 75}\n- suggestions: 3-5 specific improvements to make\n- keywords: 5-10 important keywords from the job description (or general ATS keywords)\n- score: estimated ATS score from 0-100\nOutput only the JSON, nothing else.`;

  const completion = await withAiTimeout(
    (openai.chat.completions.create as any)({
      model: "gpt-5-mini",
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      ...({ reasoning_effort: "minimal" } as Record<string, unknown>),
    }) as Promise<ChatCompletionResult>,
    "ats-suggestions",
  );

  let result: { suggestions: string[]; keywords: string[]; score: number } = { suggestions: [], keywords: [], score: 70 };
  try {
    const content = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    }
  } catch {
    result = { suggestions: ["Ensure your resume includes relevant keywords", "Quantify your achievements with numbers"] as string[], keywords: [] as string[], score: 65 };
  }

  res.json(GetAtsSuggestionsResponse.parse(result));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    const status = /timed out/i.test(msg) ? 504 : 500;
    res.status(status).json({ error: msg });
  }
});

export default router;
