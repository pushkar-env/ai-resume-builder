import type { Response } from "express";
import { logger } from "./logger";

export function sendAiRouteError(res: Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : "AI request failed";
  const status = /timed out/i.test(msg) ? 504 : 500;

  const isJsonFailure =
    /JSON|parse|truncated|could not parse/i.test(msg) ||
    (err instanceof Error && err.name === "SyntaxError");

  if (isJsonFailure) {
    logger.error({ error: err }, "AI route JSON/parse failure");
    res.status(status).json({
      error:
        "AI optimization returned an invalid response. Please try again — if the issue persists, shorten long bullet points or reduce the number of roles/projects.",
    });
    return;
  }

  res.status(status).json({ error: msg });
}
