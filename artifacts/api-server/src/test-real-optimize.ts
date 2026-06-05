import { db, resumesTable, resumeSectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
// We need to import runAtsAuditOnResume. Since it's a private function in resumes.ts, we can copy its code or import it if exported.
// Let's copy the code of runAtsAuditOnResume and formatSectionsForAiAnalysis / completeResumeAiJson from api-server.
import { formatSectionsForAiAnalysis } from "./lib/resume-ai-serialize";
import { completeResumeAiJson, clipAiInput } from "./lib/resume-ai-chat";
import { logger } from "./lib/logger";

async function runAtsAuditOnResume(
  resumeId: number,
  resumeTitle: string,
  sections: any[],
  jobDescription: string,
): Promise<{
  score: number;
  passedChecks: string[];
  failedChecks: string[];
  feedback: string[];
}> {
  const personalSection = sections.find((s) => s.type === "personal");
  const personalContent = personalSection?.content as any;
  const skillsSection = sections.find((s) => s.type === "skills");
  const skillsContent = skillsSection?.content as any;

  const targetJobTitle = personalContent?.jobTitle || resumeTitle || "Professional";
  const skillsList = Array.isArray(skillsContent?.items)
    ? skillsContent.items.map((i: any) => i.name || i).join(", ")
    : "";

  const resumeText = formatSectionsForAiAnalysis(sections);
  const jdBlock =
    jobDescription && jobDescription.trim().length > 0
      ? `\nJob description:\n"""${clipAiInput(jobDescription, 3_500)}"""`
      : "";

  const prompt = `You are an ATS auditor. Score this resume for target role "${targetJobTitle}".
Skills on resume: ${skillsList || "none"}${jdBlock}

Resume:
"""
${resumeText}
"""

Return JSON: {"score":75,"passedChecks":["..."],"failedChecks":["..."],"feedback":["..."]}
- score: integer 0-100
- passedChecks, failedChecks, feedback: 3-5 specific strings each`;

  let scoreVal = 70;
  let passedChecks: string[] = [];
  let failedChecks: string[] = [];
  let feedback: string[] = [];

  const fallbackScoreCalc = () => {
    passedChecks = [];
    failedChecks = [];
    feedback = [];

    const personalContent = personalSection?.content as any;
    if (personalContent?.email) passedChecks.push("Contact email present");
    else failedChecks.push("Missing contact email");

    if (personalContent?.phone) passedChecks.push("Phone number present");
    else failedChecks.push("Missing phone number");

    const summarySection = sections.find((s) => s.type === "summary");
    const summaryContent = summarySection?.content as any;
    if (summaryContent?.text && summaryContent.text.length > 50) {
      passedChecks.push("Professional summary present");
    } else {
      failedChecks.push("Missing or too short professional summary");
      feedback.push(
        "Add a compelling professional summary of at least 3-4 sentences",
      );
    }

    const expSection = sections.find((s) => s.type === "experience");
    const expContent = expSection?.content as any;
    if (expContent?.items && expContent.items.length > 0) {
      passedChecks.push("Work experience included");
      const hasQuantified = expContent.items.some((item: any) =>
        item.bullets?.some((b: string) => /\d/.test(b)),
      );
      if (hasQuantified) passedChecks.push("Quantified achievements present");
      else {
        failedChecks.push("No quantified achievements");
        feedback.push(
          "Add numbers and metrics to your bullet points (e.g., 'Increased sales by 30%')",
        );
      }
    } else {
      failedChecks.push("Missing work experience");
    }

    const skillsContent = skillsSection?.content as any;
    if (skillsContent?.items && skillsContent.items.length >= 5) {
      passedChecks.push("Adequate skills listed");
    } else {
      failedChecks.push("Too few skills listed");
      feedback.push(
        "List at least 5-10 relevant skills for better ATS matching",
      );
    }

    if (resumeTitle && resumeTitle.length > 2)
      passedChecks.push("Resume has a title");

    scoreVal = Math.round(
      (passedChecks.length / (passedChecks.length + failedChecks.length)) * 100,
    );
  };

  try {
    const parsedResult = await completeResumeAiJson<{
      score?: number | string;
      passedChecks?: unknown[];
      failedChecks?: unknown[];
      feedback?: unknown[];
    }>(prompt, "ats-score-ai", "ats-score");

    if (parsedResult) {
      let parsedScore: number | null = null;
      if (typeof parsedResult.score === "number") {
        parsedScore = parsedResult.score;
      } else if (typeof parsedResult.score === "string") {
        const parsed = parseInt(parsedResult.score, 10);
        if (!isNaN(parsed)) {
          parsedScore = parsed;
        }
      }

      if (parsedScore !== null) {
        return {
          score: Math.max(0, Math.min(100, Math.round(parsedScore))),
          passedChecks: Array.isArray(parsedResult.passedChecks)
            ? parsedResult.passedChecks.map(String)
            : [],
          failedChecks: Array.isArray(parsedResult.failedChecks)
            ? parsedResult.failedChecks.map(String)
            : [],
          feedback: Array.isArray(parsedResult.feedback)
            ? parsedResult.feedback.map(String)
            : [],
        };
      }
    }
  } catch (err: any) {
    logger.error({ error: err }, "AI ATS scoring failed during optimization helper, using fallback");
  }

  // Fallback if AI call failed
  fallbackScoreCalc();
  return {
    score: scoreVal,
    passedChecks,
    failedChecks,
    feedback,
  };
}

async function main() {
  const resumeId = 82;
  const jobDescription = "Senior Software Engineer with React and Node.js expertise";

  const [resume] = await db
    .select()
    .from(resumesTable)
    .where(eq(resumesTable.id, resumeId));

  const sections = await db
    .select()
    .from(resumeSectionsTable)
    .where(eq(resumeSectionsTable.resumeId, resumeId));

  console.log("Running runAtsAuditOnResume...");
  const auditResult = await runAtsAuditOnResume(
    resume.id,
    resume.title,
    sections,
    jobDescription,
  );

  console.log("Audit result:", auditResult);

  console.log("Updating database...");
  const now = new Date();
  const [updatedResume] = await db
    .update(resumesTable)
    .set({
      updatedAt: now,
      atsScore: auditResult.score,
      atsPassedChecks: auditResult.passedChecks,
      atsFailedChecks: auditResult.failedChecks,
      atsFeedback: auditResult.feedback,
      atsUpdatedAt: now,
      atsJobDescription: jobDescription && jobDescription.trim().length > 0 ? jobDescription.trim() : null,
    })
    .where(eq(resumesTable.id, resume.id))
    .returning();

  console.log("Updated record in DB:", {
    atsScore: updatedResume.atsScore,
    atsUpdatedAt: updatedResume.atsUpdatedAt,
    atsJobDescription: updatedResume.atsJobDescription,
    updatedAt: updatedResume.updatedAt,
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
