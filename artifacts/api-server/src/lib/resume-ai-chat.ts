import { openai } from "@workspace/integrations-openai-ai-server";
import {
  getAiProfile,
  type ResumeAiProfile,
  type ResumeAiProfileId,
} from "./resume-ai-profiles";

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
): Promise<string> {
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

  return (completion.choices[0]?.message?.content ?? "").trim();
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

export function parseAiJson<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${label}: AI returned empty content`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!jsonMatch) {
      throw new Error(`${label}: could not parse JSON from AI response`);
    }
    return JSON.parse(jsonMatch[1]) as T;
  }
}

export async function completeResumeAiJson<T>(
  prompt: string,
  label: string,
  profileId: ResumeAiProfileId,
  maxOutputTokens?: number,
): Promise<T> {
  const profile = getAiProfile(profileId);
  const text = await completeResumeAi(
    prompt,
    maxOutputTokens ?? profile.maxOutputTokens,
    label,
    { profile: profileId, jsonMode: true },
  );
  return parseAiJson<T>(text, label);
}
