/** Per-operation timeouts (ms) — keep under ~55s for Vercel→API proxy limits. */
export type ResumeAiProfileId =
  | "quick"
  | "standard"
  | "heavy"
  | "import"
  | "optimize-section"
  | "ats-score";

export type ResumeAiProfile = {
  id: ResumeAiProfileId;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
  jsonMode: boolean;
  maxRetries: number;
};

export const RESUME_AI_PROFILES: Record<ResumeAiProfileId, ResumeAiProfile> = {
  quick: {
    id: "quick",
    timeoutMs: Number(process.env.RESUME_AI_QUICK_TIMEOUT_MS) || 28_000,
    maxOutputTokens: 520,
    temperature: 0.45,
    jsonMode: false,
    maxRetries: 2,
  },
  standard: {
    id: "standard",
    timeoutMs: Number(process.env.RESUME_AI_STANDARD_TIMEOUT_MS) || 42_000,
    maxOutputTokens: 900,
    temperature: 0.4,
    jsonMode: true,
    maxRetries: 2,
  },
  heavy: {
    id: "heavy",
    timeoutMs: Number(process.env.RESUME_AI_HEAVY_TIMEOUT_MS) || 52_000,
    maxOutputTokens: 1_400,
    temperature: 0.35,
    jsonMode: true,
    maxRetries: 2,
  },
  import: {
    id: "import",
    timeoutMs: Number(process.env.RESUME_AI_IMPORT_TIMEOUT_MS) || 52_000,
    maxOutputTokens: 2_200,
    temperature: 0.2,
    jsonMode: true,
    maxRetries: 2,
  },
  "optimize-section": {
    id: "optimize-section",
    timeoutMs: Number(process.env.RESUME_AI_OPTIMIZE_TIMEOUT_MS) || 45_000,
    maxOutputTokens: Number(process.env.RESUME_AI_OPTIMIZE_MAX_TOKENS) || 3_200,
    temperature: 0.35,
    jsonMode: true,
    maxRetries: 2,
  },
  "ats-score": {
    id: "ats-score",
    timeoutMs: Number(process.env.RESUME_AI_ATS_TIMEOUT_MS) || 45_000,
    maxOutputTokens: 800,
    temperature: 0.25,
    jsonMode: true,
    maxRetries: 2,
  },
};

export function getAiProfile(id: ResumeAiProfileId): ResumeAiProfile {
  return RESUME_AI_PROFILES[id];
}
