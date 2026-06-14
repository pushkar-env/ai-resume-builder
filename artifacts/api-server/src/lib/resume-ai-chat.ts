import { openai } from "@workspace/integrations-openai-ai-server";
import {
  getAiProfile,
  type ResumeAiProfile,
  type ResumeAiProfileId,
} from "./resume-ai-profiles";
import { logger } from "./logger";
import { isJsonParseError, parseAiJson } from "./resume-ai-json";

export { extractJsonPayload, parseAiJson } from "./resume-ai-json";

/** Fast chat model for resume copy (avoid reasoning models — slow and costly). */
export const RESUME_AI_MODEL =
  process.env.RESUME_AI_MODEL?.trim() || "gpt-4o-mini";

/** Default wall-clock cap when no profile is passed (legacy). */
export const RESUME_AI_CALL_TIMEOUT_MS =
  Number(process.env.RESUME_AI_CALL_TIMEOUT_MS) || 52_000;

type ChatCompletionResult = {
  choices: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
};

export type ResumeAiCompletion = {
  text: string;
  finishReason: string | null;
};

export function clipAiInput(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAiError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);

  if (/timed out|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return true;
  }
  if (/rate limit|429|503|502|504|overloaded|temporarily unavailable/i.test(msg)) {
    return true;
  }

  const status =
    typeof err === "object" && err && "status" in err
      ? Number((err as { status?: number }).status)
      : undefined;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function withCallTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`${label} timed out after ${timeoutMs}ms`),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runCompletion(
  prompt: string,
  profile: ResumeAiProfile,
  label: string,
): Promise<ResumeAiCompletion> {
  const completion = await withCallTimeout(
    openai.chat.completions.create(
      {
        model: RESUME_AI_MODEL,
        max_tokens: profile.maxOutputTokens,
        temperature: profile.temperature,
        messages: [{ role: "user", content: prompt }],
        ...(profile.jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      },
      { timeout: profile.timeoutMs },
    ) as Promise<ChatCompletionResult>,
    profile.timeoutMs + 2_000,
    label,
  );

  return {
    text: (completion.choices[0]?.message?.content ?? "").trim(),
    finishReason: completion.choices[0]?.finish_reason ?? null,
  };
}

async function withRetries<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number,
): Promise<T> {
  let lastError: unknown;
  const attempts = Math.max(1, maxRetries + 1);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableAiError(err);
      const isLast = attempt >= attempts - 1;
      if (!retryable || isLast) break;
      await sleep(600 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${attempts} attempt(s)`);
}

export type CompleteResumeAiOptions = {
  profile?: ResumeAiProfileId;
  maxOutputTokens?: number;
  jsonMode?: boolean;
};

/**
 * Single chat completion tuned for resume AI features (latency + reliability).
 */
export async function completeResumeAi(
  prompt: string,
  maxOutputTokens: number,
  label: string,
  options?: CompleteResumeAiOptions,
): Promise<string> {
  const result = await completeResumeAiWithMeta(
    prompt,
    maxOutputTokens,
    label,
    options,
  );
  return result.text;
}

export async function completeResumeAiWithMeta(
  prompt: string,
  maxOutputTokens: number,
  label: string,
  options?: CompleteResumeAiOptions,
): Promise<ResumeAiCompletion> {
  const baseProfile = getAiProfile(options?.profile ?? "standard");
  const profile: ResumeAiProfile = {
    ...baseProfile,
    maxOutputTokens: options?.maxOutputTokens ?? maxOutputTokens,
    jsonMode: options?.jsonMode ?? baseProfile.jsonMode,
  };

  return withRetries(
    () => runCompletion(prompt, profile, label),
    label,
    profile.maxRetries,
  );
}

export async function completeResumeAiJson<T>(
  prompt: string,
  label: string,
  profileId: ResumeAiProfileId,
  maxOutputTokens?: number,
): Promise<T> {
  const profile = getAiProfile(profileId);
  const baseTokens = maxOutputTokens ?? profile.maxOutputTokens;
  const tokenBudgets = [
    baseTokens,
    Math.min(Math.round(baseTokens * 1.35), 4_096),
    Math.min(Math.round(baseTokens * 1.75), 4_096),
  ];

  let lastError: unknown;

  for (let attempt = 0; attempt < tokenBudgets.length; attempt++) {
    const tokens = tokenBudgets[attempt];
    try {
      const { text, finishReason } = await completeResumeAiWithMeta(
        prompt,
        tokens,
        label,
        { profile: profileId, jsonMode: true },
      );

      if (!text) {
        throw new Error(`${label}: AI returned empty content`);
      }

      if (finishReason === "length") {
        logger.warn(
          { label, attempt, tokens, textLength: text.length },
          "AI JSON response truncated by token limit",
        );
        throw new Error(`${label}: AI response truncated`);
      }

      return parseAiJson<T>(text, label);
    } catch (err) {
      lastError = err;
      const canRetry =
        attempt < tokenBudgets.length - 1 &&
        (isJsonParseError(err) ||
          (err instanceof Error && /truncated/i.test(err.message)));

      if (!canRetry) break;

      logger.warn(
        { label, attempt, nextTokens: tokenBudgets[attempt + 1], error: err },
        "Retrying AI JSON completion after parse/truncation failure",
      );
      await sleep(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label}: AI JSON completion failed`);
}
