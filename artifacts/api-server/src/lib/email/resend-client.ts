import { logger } from "../logger";
import { readEnv } from "./env";

const RESEND_API_KEY = readEnv("RESEND_API_KEY");
const SEND_TIMEOUT_MS = 12_000;

export type SendEmailParams = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export function isBillingEmailConfigured(): boolean {
  return isEmailConfigured() && Boolean(readEnv("BILLING_FROM_EMAIL"));
}

export async function sendResendEmail(
  params: SendEmailParams,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!RESEND_API_KEY) {
    logger.warn("email: RESEND_API_KEY not configured — skipping send");
    return { ok: false, reason: "not_configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
        tags: params.tags,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error(
        { status: res.status, errText: errText.slice(0, 500), subject: params.subject },
        "email: Resend API error",
      );
      return { ok: false, reason: "api_error" };
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err, subject: params.subject }, "email: send failed");
    return { ok: false, reason: "send_failed" };
  } finally {
    clearTimeout(timer);
  }
}
