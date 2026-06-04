/** Client timeouts — slightly above matching server AI profiles. */

/** Polish summary, improve bullet (server profile: quick ~28s). */
export const AI_QUICK_TIMEOUT_MS = 32_000;

/** Skills, ATS suggestions (server profile: standard ~42s). */
export const AI_STANDARD_TIMEOUT_MS = 48_000;

/** Import, optimize, ATS score scan (server profiles: 45–52s). */
export const AI_HEAVY_TIMEOUT_MS = 58_000;

/** @deprecated Use tiered helpers below. */
export const AI_REQUEST_TIMEOUT_MS = AI_HEAVY_TIMEOUT_MS;

export function createAiRequestOptions(
  timeoutMs = AI_HEAVY_TIMEOUT_MS,
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

export function createAiQuickRequestOptions(): RequestInit {
  return createAiRequestOptions(AI_QUICK_TIMEOUT_MS);
}

export function createAiStandardRequestOptions(): RequestInit {
  return createAiRequestOptions(AI_STANDARD_TIMEOUT_MS);
}

export function createAiHeavyRequestOptions(): RequestInit {
  return createAiRequestOptions(AI_HEAVY_TIMEOUT_MS);
}

/** @deprecated Prefer createAiQuickRequestOptions / createAiHeavyRequestOptions. */
export const AI_REQUEST_OPTIONS: RequestInit = {
  get signal() {
    return createAiHeavyRequestOptions().signal;
  },
};

export function isAiAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  return name === "AbortError" || name === "TimeoutError";
}

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

export function aiErrorDescription(err: unknown, fallback: string): string {
  if (isAiTimeoutError(err)) {
    return "The AI request took too long. Please try again — shorter resumes respond faster.";
  }
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message?: string }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}
