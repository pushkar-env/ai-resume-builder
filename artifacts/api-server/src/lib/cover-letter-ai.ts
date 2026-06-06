import { completeResumeAi, completeResumeAiJson } from "./resume-ai-chat";
import { logger } from "./logger";

export function formatResumeForAi(resume: any, sections: any[]): string {
  let content = `Resume Title: ${resume.title}\n\n`;

  const sortedSections = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);

  for (const sec of sortedSections) {
    if (!sec.isVisible) continue;
    content += `=== Section: ${sec.title} (${sec.type}) ===\n`;
    try {
      if (typeof sec.content === "string") {
        content += `${sec.content}\n\n`;
      } else {
        content += `${JSON.stringify(sec.content, null, 2)}\n\n`;
      }
    } catch {
      content += `${sec.content}\n\n`;
    }
  }
  return content;
}

export async function generateCoverLetterText(
  resumeText: string | null,
  jobDetails: {
    jobTitle?: string | null;
    companyName?: string | null;
    hiringManagerName?: string | null;
    companyLocation?: string | null;
    jobDescription?: string | null;
  },
  options: {
    tone: string;
    preset: string;
    customInstructions?: string | null;
    experienceLevel?: string | null;
  },
): Promise<string> {
  const { jobTitle, companyName, hiringManagerName, companyLocation, jobDescription } = jobDetails;
  const { tone, preset, customInstructions, experienceLevel } = options;

  logger.info("Generating cover letter text via AI");

  const prompt = `
You are an expert recruiter and cover letter copywriter specializing in high-converting, ATS-friendly, and highly personalized cover letters.
Your goal is to write a cover letter that matches the candidate's resume achievements with the target job description.

Candidate Resume Context:
"""
${resumeText || "No resume content provided. Write the letter based on the target job details."}
"""

Target Position details:
- Job Title: ${jobTitle || "Not specified"}
- Company Name: ${companyName || "Not specified"}
- Hiring Manager Name: ${hiringManagerName || "Hiring Manager"}
- Location: ${companyLocation || "Not specified"}
- Experience Level: ${experienceLevel || "Professional"}

Target Job Description:
"""
${jobDescription || "Not specified"}
"""

Preset Style: ${preset}
Tone: ${tone}
${customInstructions ? `Custom Instructions: "${customInstructions}"` : ""}

Guidelines for writing:
1. Length: Keep the total letter strictly between 250 and 400 words.
2. Structure: The body of the letter MUST follow a strict 4-paragraph structure (after the salutation):
   - **Paragraph 1: Opening**: Hook the reader immediately. Specify the role and company. Mention a compelling, specific reason why you are excited about this company (mentioning company research/industry context if relevant). Do NOT use generic opening clichés (e.g. "I am writing to express my interest...", "Please accept this application...").
   - **Paragraph 2: Relevant Experience**: Focus on 1 or 2 achievements from the resume that directly align with the core requirements or problems mentioned in the job description. Use metrics and numbers to quantify impact where possible.
   - **Paragraph 3: Value Proposition**: Connect your skills and experience to the company's needs (products, values, mission). Demonstrate how you can deliver immediate value.
   - **Paragraph 4: Closing**: Express enthusiasm, thank the reader, and close with a polite, confident call to action for an interview.
3. Tone and Presets:
   - Preset style is "${preset}". (Professional = standard corporate; Executive = strategic leadership/impact; Modern = direct/fresh; Startup = action-oriented/high energy/builder; Technical = stack/problem-solving/metrics; Creative = storytelling; Academic = research/theory).
   - Tone is "${tone}". (Formal = traditional/polite; Confident = authoritative; Enthusiastic = passionate/value-aligned; Conversational = warm/approachable).
4. Language Rules: Avoid standard AI clichés like "delighted to apply", "synergy", "passion", "dynamic", "thrilled", "I am writing to...", "excited to submit". Keep the voice natural, human, and polished. Do NOT hallucinate facts not present in the resume.
5. Output format: Output ONLY the cover letter body text (including date, recipient block, salutation, the 4 body paragraphs, sign-off, and candidate name). Do not include any HTML, markdown headers outside the text, or conversational intros/outros.
`;

  return await completeResumeAi(prompt, 800, "generate-cover-letter", {
    profile: "standard",
    jsonMode: false,
  });
}

export async function rewriteCoverLetterSection(
  currentText: string,
  action: "shorten" | "expand" | "tone" | "grammar" | "custom",
  options: {
    tone: string;
    customInstructions?: string | null;
    resumeText?: string | null;
  },
): Promise<string> {
  const { tone, customInstructions, resumeText } = options;

  logger.info({ action }, "Rewriting cover letter section via AI");

  let instruction = "";
  if (action === "shorten") {
    instruction = "Make the text more concise and punchy. Remove fluff while retaining all core metrics and accomplishments.";
  } else if (action === "expand") {
    instruction = "Expand on the text, adding detail and depth. Use context from the candidate's resume if helpful to make it richer.";
  } else if (action === "tone") {
    instruction = `Adjust the tone of the text to be ${tone}. Make it sound natural and professional.`;
  } else if (action === "grammar") {
    instruction = "Fix any grammatical, spelling, punctuation, or stylistic issues. Improve overall sentence flow and readability without altering the facts.";
  } else if (action === "custom") {
    instruction = `Rewrite the text according to these custom instructions: "${customInstructions}"`;
  }

  const prompt = `
You are a professional editor. Rewrite the following cover letter segment according to the instruction.

Candidate Resume Context (use for expansion/re-alignment if needed):
"""
${resumeText || "None"}
"""

Instruction:
${instruction}

Current Text segment to rewrite:
"""
${currentText}
"""

Output only the rewritten segment text. Do not wrap in quotes or add conversational headers/footers.
`;

  return await completeResumeAi(prompt, 600, `rewrite-cover-letter-${action}`, {
    profile: "quick",
    jsonMode: false,
  });
}

export interface AtsAuditResult {
  score: number;
  passedChecks: string[];
  failedChecks: string[];
  feedback: string[];
  keywords: string[];
}

export async function auditCoverLetterAts(
  coverLetterContent: string,
  jobDescription: string,
): Promise<AtsAuditResult> {
  logger.info("Auditing cover letter ATS score");

  const prompt = `
Analyze the following cover letter for ATS (Applicant Tracking System) compatibility and alignment against the target job description.

Cover Letter Content:
"""
${coverLetterContent}
"""

Target Job Description:
"""
${jobDescription}
"""

Provide a detailed evaluation in JSON format:
{
  "score": number (0-100, indicating how well the cover letter aligns with the job description and meets industry standards),
  "passedChecks": [string] (e.g. "Appropriate word count", "Clean formatting", "Mentions target company name"),
  "failedChecks": [string] (e.g. "Missing core keywords: ...", "Overused AI clichés: ...", "No quantified metrics"),
  "feedback": [string] (constructive optimization tips, e.g. "Incorporate 'React' and 'TypeScript' which are heavily requested in the job description", "Replace clichés with metrics"),
  "keywords": [string] (list of 5-10 core keywords from the job description that should be or are mentioned in the cover letter)
}
`;

  const result = await completeResumeAiJson<AtsAuditResult>(
    prompt,
    "audit-cover-letter-ats",
    "standard",
  );

  return {
    score: typeof result.score === "number" ? result.score : 70,
    passedChecks: Array.isArray(result.passedChecks) ? result.passedChecks.map(String) : [],
    failedChecks: Array.isArray(result.failedChecks) ? result.failedChecks.map(String) : [],
    feedback: Array.isArray(result.feedback) ? result.feedback.map(String) : [],
    keywords: Array.isArray(result.keywords) ? result.keywords.map(String) : [],
  };
}
