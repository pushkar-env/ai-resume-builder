import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "support@resumesensei.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
/** Verified sender in Resend (e.g. ResumeSensei <hello@resumesensei.com>). */
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL;

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 10_000;

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress || "unknown";
}

function allowRate(ip: string): boolean {
  if (rateBuckets.size > 5000) {
    const now = Date.now();
    for (const [k, v] of rateBuckets) {
      if (now - v.windowStart > RATE_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || now - b.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ContactBody = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  /** Honeypot — must be empty */
  company?: unknown;
};

router.post("/contact", async (req: Request, res: Response): Promise<void> => {
  const ip = clientIp(req);
  if (!allowRate(ip)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const body = req.body as ContactBody;
  if (body.company != null && String(body.company).trim() !== "") {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length > MAX_NAME) {
    res.status(400).json({ error: "Please enter a valid name." });
    return;
  }
  if (!email || email.length > MAX_EMAIL || !emailRe.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (!subject || subject.length > MAX_SUBJECT) {
    res.status(400).json({ error: "Please enter a subject." });
    return;
  }
  if (!message || message.length > MAX_MESSAGE) {
    res.status(400).json({ error: "Please enter a message." });
    return;
  }

  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
    logger.warn(
      { hasKey: !!RESEND_API_KEY, hasFrom: !!CONTACT_FROM_EMAIL },
      "contact: missing RESEND_API_KEY or CONTACT_FROM_EMAIL",
    );
    res.status(503).json({
      error: "Contact delivery is not configured. Please email us directly at support@resumesensei.com.",
    });
    return;
  }

  const html = `
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <hr />
    <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
  `;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        reply_to: email,
        subject: `[ResumeSensei Contact] ${subject}`,
        html,
      }),
      signal: controller.signal,
    });

    clearTimeout(t);

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => "");
      logger.error({ status: resendRes.status, errText: errText.slice(0, 500) }, "contact: Resend API error");
      res.status(502).json({ error: "Could not send your message. Please try again or email support@resumesensei.com." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    clearTimeout(t);
    logger.error({ err: e }, "contact: send failed");
    res.status(502).json({ error: "Could not send your message. Please try again later." });
  }
});

export default router;
