/** Client-side timeout for AI endpoints (summary polish, bullet improve, skills). */
export const AI_REQUEST_TIMEOUT_MS = 90_000;

/** Shared `RequestInit` for Orval AI mutations — aborts hung requests instead of freezing the UI. */
export function createAiRequestOptions(timeoutMs = AI_REQUEST_TIMEOUT_MS): RequestInit {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return { signal: AbortSignal.timeout(timeoutMs) };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = controller.signal;
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return { signal };
}

export const AI_REQUEST_OPTIONS = createAiRequestOptions();

export function isAiAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  return name === "AbortError" || name === "TimeoutError";
}
