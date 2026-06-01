import { openai } from "@workspace/integrations-openai-ai-server";

/** Fast chat model for short resume copy (avoid reasoning models — they are slow and burn token budget). */
export const RESUME_AI_MODEL =
  process.env.RESUME_AI_MODEL?.trim() || "gpt-4o-mini";

/** Wall-clock cap per OpenAI call (ms). */
export const RESUME_AI_CALL_TIMEOUT_MS =
  Number(process.env.RESUME_AI_CALL_TIMEOUT_MS) || 60_000;

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

async function withCallTimeout<T>(
  promise: Promise<T>,
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
              new Error(
                `${label} timed out after ${RESUME_AI_CALL_TIMEOUT_MS}ms`,
              ),
            ),
          RESUME_AI_CALL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Single chat completion tuned for resume polish / bullets / skills (low latency).
 */
export async function completeResumeAi(
  prompt: string,
  maxOutputTokens: number,
  label: string,
): Promise<string> {
  const completion = await withCallTimeout(
    openai.chat.completions.create(
      {
        model: RESUME_AI_MODEL,
        max_tokens: maxOutputTokens,
        temperature: 0.5,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: RESUME_AI_CALL_TIMEOUT_MS },
    ) as Promise<ChatCompletionResult>,
    label,
  );

  return (completion.choices[0]?.message?.content ?? "").trim();
}
