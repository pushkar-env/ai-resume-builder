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
import { clipAiInput, completeResumeAi } from "../lib/resume-ai-chat";

const router: IRouter = Router();

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

function aiRouteError(res: Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : "AI request failed";
  const status = /timed out/i.test(msg) ? 504 : 500;
  res.status(status).json({ error: msg });
}

router.post(
  "/ai/generate-summary",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = GenerateSummaryBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const { jobTitle, yearsOfExperience, skills, industry, currentText } =
        parsed.data;

      const role = jobTitle?.trim() || "professional";
      const baseDescriptor = `for a ${role}${industry ? ` in ${industry}` : ""}${yearsOfExperience ? ` with ${yearsOfExperience} years of experience` : ""}${skills && skills.length > 0 ? `. Key skills: ${skills.join(", ")}` : ""}`;

      const draft = currentText?.trim() ? clipAiInput(currentText, 2_500) : "";

      const prompt = draft
        ? `Refine and polish the following professional resume summary ${baseDescriptor}. Keep the candidate's core message, voice and any specific details intact, but improve clarity, impact and ATS keywords. Aim for 3-4 sentences, written in first person without using "I". Output ONLY the rewritten summary text, no labels or quotes.\n\nDraft:\n"""${draft}"""`
        : `Write a compelling professional resume summary ${baseDescriptor}. The summary should be 3-4 sentences, quantified where possible, ATS-optimized, and written in first person without using "I". Output only the summary text, no labels or quotes.`;

      const text = await completeResumeAi(prompt, 520, "generate-summary");
      if (!text) {
        res
          .status(502)
          .json({ error: "AI returned empty content. Please try again." });
        return;
      }
      res.json(GenerateSummaryResponse.parse({ text }));
    } catch (err) {
      aiRouteError(res, err);
    }
  },
);

router.post(
  "/ai/improve-bullet",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = ImproveBulletBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const { bullet, context } = parsed.data;
      const clipped = clipAiInput(bullet, 1_500);

      const prompt = `Improve this resume bullet point to be more impactful, quantified, and ATS-friendly${context ? ` (context: ${clipAiInput(context, 200)})` : ""}:\n\n"${clipped}"\n\nRewrite it as a single, powerful bullet point starting with a strong action verb. Include metrics/numbers if possible. Output only the improved bullet text, no quotes.`;

      const text = await completeResumeAi(prompt, 220, "improve-bullet");
      if (!text) {
        res
          .status(502)
          .json({ error: "AI returned empty content. Please try again." });
        return;
      }
      res.json(ImproveBulletResponse.parse({ text }));
    } catch (err) {
      aiRouteError(res, err);
    }
  },
);

router.post(
  "/ai/suggest-skills",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = SuggestSkillsBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const { jobTitle, industry, existingSkills, summary } = parsed.data;

      const role = jobTitle?.trim() || "professional";
      const summaryCtx = summary?.trim() ? clipAiInput(summary, 600) : "";
      const prompt = `Suggest 10 relevant technical and soft skills for a ${role}${industry ? ` in ${industry}` : ""}${existingSkills && existingSkills.length > 0 ? `. They already have: ${existingSkills.join(", ")} (do NOT repeat these)` : ""}${summaryCtx ? `. Use this candidate context to personalise suggestions: """${summaryCtx}"""` : ""}. Focus on ATS-friendly, in-demand skills. Return ONLY a JSON array of skill strings, nothing else. Example: ["Skill 1", "Skill 2"]`;

      const completion = await completeResumeAi(prompt, 400, "suggest-skills");

      let skills: string[] = [];
      try {
        const jsonMatch = completion.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          skills = JSON.parse(jsonMatch[0]);
        }
      } catch {
        skills = [];
      }

      res.json(SuggestSkillsResponse.parse({ skills }));
    } catch (err) {
      aiRouteError(res, err);
    }
  },
);

router.post(
  "/ai/ats-suggestions",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = GetAtsSuggestionsBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const { resumeContent, jobDescription } = parsed.data;

      const prompt = `Analyze this resume content for ATS optimization${jobDescription ? " against the provided job description" : ""}.\n\nResume:\n${clipAiInput(resumeContent, 8_000)}${jobDescription ? `\n\nJob Description:\n${clipAiInput(jobDescription, 4_000)}` : ""}\n\nReturn ONLY a JSON object with this exact structure:\n{"suggestions": ["suggestion 1", ...], "keywords": ["keyword 1", ...], "score": 75}\n- suggestions: 3-5 specific improvements to make\n- keywords: 5-10 important keywords from the job description (or general ATS keywords)\n- score: estimated ATS score from 0-100\nOutput only the JSON, nothing else.`;

      const content = await completeResumeAi(prompt, 900, "ats-suggestions");

      let result: { suggestions: string[]; keywords: string[]; score: number } =
        {
          suggestions: [],
          keywords: [],
          score: 70,
        };
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch {
        result = {
          suggestions: [
            "Ensure your resume includes relevant keywords",
            "Quantify your achievements with numbers",
          ],
          keywords: [],
          score: 65,
        };
      }

      res.json(GetAtsSuggestionsResponse.parse(result));
    } catch (err) {
      aiRouteError(res, err);
    }
  },
);

export default router;
