/** Client timeout — slightly above server `RESUME_AI_CALL_TIMEOUT_MS` (default 60s). */
export const AI_REQUEST_TIMEOUT_MS = 75_000;

/** Shared `RequestInit` for Orval AI mutations — aborts hung requests instead of freezing the UI. */
export function createAiRequestOptions(
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): RequestInit {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return { signal: AbortSignal.timeout(timeoutMs) };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = controller.signal;
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return { signal };
}

export const AI_REQUEST_OPTIONS: RequestInit = {
  get signal() {
    return createAiRequestOptions().signal;
  },
};

export function isAiAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  return name === "AbortError" || name === "TimeoutError";
}

/** Client-side detection for server 504 / timeout messages from the API client. */
export function isAiTimeoutError(err: unknown): boolean {
  if (isAiAbortError(err)) return true;
  if (err && typeof err === "object") {
    const status = (err as { status?: number }).status;
    if (status === 504) return true;
    const message = String((err as { message?: string }).message ?? "");
    if (/timed out|timeout/i.test(message)) return true;
  }
  return false;
}
