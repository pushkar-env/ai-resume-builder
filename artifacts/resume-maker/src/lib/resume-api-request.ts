import {
  AI_REQUEST_TIMEOUT_MS,
  createAiRequestOptions,
  isAiTimeoutError,
} from "@/lib/ai-request";

/** Resume create/duplicate — allow cold API + DB wake-up. */
export const RESUME_MUTATION_TIMEOUT_MS = 45_000;

/** PDF export — server Puppeteer render with pooled browser. */
export const PDF_EXPORT_TIMEOUT_MS = 90_000;

/** Import uses OpenAI parsing on the server. */
export const IMPORT_RESUME_TIMEOUT_MS = AI_REQUEST_TIMEOUT_MS;

export function createResumeMutationOptions(
  timeoutMs = RESUME_MUTATION_TIMEOUT_MS,
): RequestInit {
  return createAiRequestOptions(timeoutMs);
}

export function createImportResumeOptions(): RequestInit {
  return createAiRequestOptions(IMPORT_RESUME_TIMEOUT_MS);
}

export function createPdfExportSignal(
  timeoutMs = PDF_EXPORT_TIMEOUT_MS,
): AbortSignal | undefined {
  return createAiRequestOptions(timeoutMs).signal ?? undefined;
}

export function isTransientApiError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === 502 || status === 503 || status === 504) return true;
  const message = String((err as { message?: string }).message ?? "");
  return /network|fetch failed|failed to fetch|ECONNRESET|ETIMEDOUT/i.test(
    message,
  );
}

export function isResumeOperationTimeout(err: unknown): boolean {
  return isAiTimeoutError(err);
}

export function resumeOperationErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (isResumeOperationTimeout(err)) {
    return "The server took too long to respond. Please try again in a moment.";
  }
  if (isTransientApiError(err)) {
    return "The server is waking up — please try again.";
  }
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message?: string }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

/** One retry helps when the API cold-starts after idle sleep. */
export async function withResumeMutationRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (!isTransientApiError(err)) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    return operation();
  }
}
