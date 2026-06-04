import type { Response } from "express";

export function sendAiRouteError(res: Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : "AI request failed";
  const status = /timed out/i.test(msg) ? 504 : 500;
  res.status(status).json({ error: msg });
}
