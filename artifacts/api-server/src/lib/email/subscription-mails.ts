import { clerkClient } from "@clerk/express";
import { logger } from "../logger";
import { getBillingFromEmail } from "./layout";
import { isBillingEmailConfigured, sendResendEmail } from "./resend-client";
import {
  buildCancellationScheduledEmail,
  buildPaymentFailedEmail,
  buildPaymentRenewalEmail,
  buildSubscriptionEndedEmail,
  buildSubscriptionResumedEmail,
  buildWelcomeEmail,
} from "./subscription-templates";

const DEDUPE_KEY = "subscriptionEmailDedupe";
const MAX_DEDUPE_KEYS = 64;

type DedupeStore = Record<string, string>;

function readDedupeStore(
  privateMetadata: Record<string, unknown> | undefined,
): DedupeStore {
  const raw = privateMetadata?.[DEDUPE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DedupeStore;
}

async function claimDedupeKey(
  userId: string,
  dedupeKey: string,
  pairedKey?: string,
): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const store = readDedupeStore(
      user.privateMetadata as Record<string, unknown> | undefined,
    );
    if (store[dedupeKey]) {
      // Block duplicate sends for the same event (e.g. API + webhook). Allow a new
      // email when the user toggled cancel/resume since the last claim.
      if (!pairedKey || !store[pairedKey]) return false;
    }

    const keys = Object.keys(store);
    const trimmed =
      keys.length >= MAX_DEDUPE_KEYS
        ? Object.fromEntries(
            keys.slice(-(MAX_DEDUPE_KEYS - 1)).map((k) => [k, store[k]!]),
          )
        : { ...store };
    if (pairedKey) {
      delete trimmed[pairedKey];
    }
    trimmed[dedupeKey] = new Date().toISOString();

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...(user.privateMetadata as Record<string, unknown>),
        [DEDUPE_KEY]: trimmed,
      },
    });
    return true;
  } catch (err) {
    logger.error({ err, userId, dedupeKey }, "email: dedupe claim failed");
    return true;
  }
}

function resolveFirstName(
  user: Awaited<ReturnType<typeof clerkClient.users.getUser>>,
): string {
  const first = user.firstName?.trim();
  if (first) return first;
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.split("@")[0] ?? "there";
  return "there";
}

function resolveRecipientEmail(
  user: Awaited<ReturnType<typeof clerkClient.users.getUser>>,
): string | null {
  const email = user.primaryEmailAddress?.emailAddress?.trim();
  if (!email) return null;
  return email;
}

async function sendToUser(
  userId: string,
  dedupeKey: string,
  build: (firstName: string) => {
    subject: string;
    html: string;
    text: string;
  },
  tag: string,
  allowRetest = false,
  pairedDedupeKey?: string,
): Promise<void> {
  if (!isBillingEmailConfigured()) {
    logger.warn(
      { userId, tag },
      "email: missing RESEND_API_KEY or BILLING_FROM_EMAIL — skipping billing email",
    );
    return;
  }

  const billingFrom = getBillingFromEmail();
  if (!billingFrom) return;

  if (!allowRetest) {
    if (!(await claimDedupeKey(userId, dedupeKey, pairedDedupeKey))) {
      logger.info({ userId, dedupeKey }, "email: skipped duplicate");
      return;
    }
  }

  const user = await clerkClient.users.getUser(userId);
  const to = resolveRecipientEmail(user);
  if (!to) {
    logger.warn({ userId, tag }, "email: user has no primary email");
    return;
  }

  const { subject, html, text } = build(resolveFirstName(user));
  const result = await sendResendEmail({
    from: billingFrom,
    to: [to],
    subject,
    html,
    text,
    replyTo: "support@resumesensei.com",
    tags: [{ name: "category", value: tag }],
  });

  if (!result.ok) {
    logger.warn({ userId, tag, reason: result.reason }, "email: send skipped or failed");
  } else {
    logger.info({ userId, tag, dedupeKey }, "email: subscription email sent");
  }
}

export type SubscriptionMailParams = {
  userId: string;
  subscriptionId: string;
  planType?: string;
  accessUntil?: number;
  nextBillingAt?: number;
  amountLabel?: string;
  /** Dev mock subscriptions: skip dedupe so flows can be re-tested locally */
  allowRetest?: boolean;
};

export async function clearSubscriptionEmailDedupe(userId: string): Promise<void> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const privateMetadata = {
      ...(user.privateMetadata as Record<string, unknown>),
    };
    delete privateMetadata[DEDUPE_KEY];
    await clerkClient.users.updateUserMetadata(userId, { privateMetadata });
    logger.info({ userId }, "email: cleared subscription dedupe keys");
  } catch (err) {
    logger.error({ err, userId }, "email: clear dedupe failed");
  }
}

export function queueSubscriptionWelcomeEmail(
  params: SubscriptionMailParams,
): void {
  void sendToUser(
    params.userId,
    `welcome:${params.subscriptionId}`,
    (firstName) =>
      buildWelcomeEmail({
        firstName,
        planType: params.planType,
        subscriptionId: params.subscriptionId,
        nextBillingAt: params.nextBillingAt,
      }),
    "subscription_welcome",
    params.allowRetest,
  ).catch((err) =>
    logger.error({ err, userId: params.userId }, "email: welcome failed"),
  );
}

export function queueSubscriptionCancelledEmail(
  params: SubscriptionMailParams,
): void {
  const dedupeKey = `cancel:${params.subscriptionId}`;
  void sendToUser(
    params.userId,
    dedupeKey,
    (firstName) =>
      buildCancellationScheduledEmail({
        firstName,
        planType: params.planType,
        subscriptionId: params.subscriptionId,
        accessUntil: params.accessUntil,
      }),
    "subscription_cancelled",
    params.allowRetest,
    `resumed:${params.subscriptionId}`,
  ).catch((err) =>
    logger.error({ err, userId: params.userId }, "email: cancel failed"),
  );
}

export function queueSubscriptionResumedEmail(
  params: SubscriptionMailParams,
): void {
  const dedupeKey = `resumed:${params.subscriptionId}`;
  void sendToUser(
    params.userId,
    dedupeKey,
    (firstName) =>
      buildSubscriptionResumedEmail({
        firstName,
        planType: params.planType,
        subscriptionId: params.subscriptionId,
        nextBillingAt: params.nextBillingAt,
      }),
    "subscription_resumed",
    params.allowRetest,
    `cancel:${params.subscriptionId}`,
  ).catch((err) =>
    logger.error({ err, userId: params.userId }, "email: resume failed"),
  );
}

export function queueSubscriptionEndedEmail(
  params: SubscriptionMailParams & {
    reason: "completed" | "halted" | "cancelled";
  },
): void {
  const reasonLabels: Record<typeof params.reason, string> = {
    completed: "Billing period completed",
    halted: "Payment failed — subscription halted",
    cancelled: "Subscription cancelled",
  };

  void sendToUser(
    params.userId,
    `ended:${params.subscriptionId}:${params.reason}`,
    (firstName) =>
      buildSubscriptionEndedEmail({
        firstName,
        planType: params.planType,
        subscriptionId: params.subscriptionId,
        reasonLabel: reasonLabels[params.reason],
      }),
    "subscription_ended",
    params.allowRetest,
  ).catch((err) =>
    logger.error({ err, userId: params.userId }, "email: ended failed"),
  );
}

export function queueSubscriptionRenewalEmail(
  params: SubscriptionMailParams,
): void {
  const cycleKey = params.nextBillingAt
    ? Math.floor(params.nextBillingAt / 86400)
    : Math.floor(Date.now() / 86400000);

  void sendToUser(
    params.userId,
    `renewal:${params.subscriptionId}:${cycleKey}`,
    (firstName) =>
      buildPaymentRenewalEmail({
        firstName,
        planType: params.planType,
        subscriptionId: params.subscriptionId,
        nextBillingAt: params.nextBillingAt,
        amountLabel: params.amountLabel,
      }),
    "subscription_renewal",
    params.allowRetest,
  ).catch((err) =>
    logger.error({ err, userId: params.userId }, "email: renewal failed"),
  );
}

export function queuePaymentFailedEmail(
  params: SubscriptionMailParams,
): void {
  void sendToUser(
    params.userId,
    `halted:${params.subscriptionId}`,
    (firstName) =>
      buildPaymentFailedEmail({
        firstName,
        planType: params.planType,
        subscriptionId: params.subscriptionId,
      }),
    "subscription_payment_failed",
    params.allowRetest,
  ).catch((err) =>
    logger.error({ err, userId: params.userId }, "email: payment failed notice error"),
  );
}
