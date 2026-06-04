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
import {
  clipAiInput,
  completeResumeAi,
  completeResumeAiJson,
} from "../lib/resume-ai-chat";
import { sendAiRouteError } from "../lib/ai-route-error";

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

      const text = await completeResumeAi(prompt, 520, "generate-summary", {
        profile: "quick",
      });
      if (!text) {
        res
          .status(502)
          .json({ error: "AI returned empty content. Please try again." });
        return;
      }
      res.json(GenerateSummaryResponse.parse({ text }));
    } catch (err) {
      sendAiRouteError(res, err);
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

      const text = await completeResumeAi(prompt, 220, "improve-bullet", {
        profile: "quick",
      });
      if (!text) {
        res
          .status(502)
          .json({ error: "AI returned empty content. Please try again." });
        return;
      }
      res.json(ImproveBulletResponse.parse({ text }));
    } catch (err) {
      sendAiRouteError(res, err);
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
      const prompt = `Suggest 10 relevant technical and soft skills for a ${role}${industry ? ` in ${industry}` : ""}${existingSkills && existingSkills.length > 0 ? `. They already have: ${existingSkills.join(", ")} (do NOT repeat these)` : ""}${summaryCtx ? `. Candidate context: """${summaryCtx}"""` : ""}. Return JSON: {"skills":["Skill 1","Skill 2"]}. ATS-friendly, in-demand skills only.`;

      const aiResult = await completeResumeAiJson<{ skills?: string[] }>(
        prompt,
        "suggest-skills",
        "standard",
      );
      const skills = Array.isArray(aiResult.skills)
        ? aiResult.skills.map(String).filter(Boolean)
        : [];

      res.json(SuggestSkillsResponse.parse({ skills }));
    } catch (err) {
      sendAiRouteError(res, err);
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

      const prompt = `Analyze this resume for ATS optimization${jobDescription ? " against the job description" : ""}.

Resume:
${clipAiInput(resumeContent, 6_000)}${jobDescription ? `\n\nJob description:\n${clipAiInput(jobDescription, 3_000)}` : ""}

Return JSON: {"suggestions":["..."],"keywords":["..."],"score":75}
- suggestions: 3-5 specific improvements
- keywords: 5-10 ATS keywords
- score: integer 0-100`;

      const result = await completeResumeAiJson<{
        suggestions?: string[];
        keywords?: string[];
        score?: number;
      }>(prompt, "ats-suggestions", "standard");

      res.json(
        GetAtsSuggestionsResponse.parse({
          suggestions: Array.isArray(result.suggestions)
            ? result.suggestions.map(String)
            : [
                "Ensure your resume includes relevant keywords",
                "Quantify achievements with numbers",
              ],
          keywords: Array.isArray(result.keywords)
            ? result.keywords.map(String)
            : [],
          score:
            typeof result.score === "number"
              ? Math.max(0, Math.min(100, Math.round(result.score)))
              : 70,
        }),
      );
    } catch (err) {
      sendAiRouteError(res, err);
    }
  },
);

export default router;
