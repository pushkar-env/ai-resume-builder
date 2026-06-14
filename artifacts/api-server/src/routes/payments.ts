import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getAuth, clerkClient } from "@clerk/express";
import {
  queuePaymentFailedEmail,
  queueSubscriptionCancelledEmail,
  queueSubscriptionEndedEmail,
  queueSubscriptionRenewalEmail,
  queueSubscriptionResumedEmail,
  queueSubscriptionWelcomeEmail,
  clearSubscriptionEmailDedupe,
} from "../lib/email";
import {
  billingEmailFlags,
  DEV_MOCK_SUBSCRIPTION_ID,
  devMockBillingDates,
  isDevBillingMode,
  isDevMockSubscription,
  shouldSendBillingEmail,
} from "../lib/billing/dev-mode";

const router = Router();

function requireAuth(req: Request, res: Response, next: any): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

// Ensure we have the Razorpay keys
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_mock";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "mock_secret";
const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret";
const RAZORPAY_MONTHLY_PLAN_ID =
  process.env.RAZORPAY_MONTHLY_PLAN_ID || "plan_mock_monthly";
const RAZORPAY_YEARLY_PLAN_ID =
  process.env.RAZORPAY_YEARLY_PLAN_ID || "plan_mock_yearly";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

function rejectUnlessDevBilling(
  res: Response,
): boolean {
  if (isDevBillingMode()) return false;
  res.status(404).json({ error: "Not found" });
  return true;
}

type SubscriptionMailTiming = {
  planType?: string;
  currentEnd?: number;
  nextBillingAt?: number;
};

function readSubscriptionTiming(sub: unknown): SubscriptionMailTiming {
  if (!sub || typeof sub !== "object") return {};
  const s = sub as {
    notes?: { planType?: string };
    current_end?: number;
    next_billing_at?: number;
  };
  return {
    planType: s.notes?.planType,
    currentEnd:
      typeof s.current_end === "number" ? s.current_end : undefined,
    nextBillingAt:
      typeof s.next_billing_at === "number"
        ? s.next_billing_at
        : typeof s.current_end === "number"
          ? s.current_end
          : undefined,
  };
}

/**
 * 1. Create Subscription endpoint
 * Called from the frontend when the user clicks "Upgrade to Pro".
 * It creates a Razorpay subscription and returns the ID.
 */
router.post(
  "/payments/create-subscription",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { planType } = req.body; // "monthly" or "yearly"
      const planId =
        planType === "yearly"
          ? RAZORPAY_YEARLY_PLAN_ID
          : RAZORPAY_MONTHLY_PLAN_ID;

      const options = {
        plan_id: planId,
        total_count: planType === "yearly" ? 10 : 120, // 10 years of billing
        customer_notify: 1 as 1,
        notes: {
          userId: userId,
          planType: planType,
        },
      };

      const subscription = await razorpay.subscriptions.create(options);

      return res.json({
        id: subscription.id,
        plan_id: subscription.plan_id,
        status: subscription.status,
      });
    } catch (error) {
      console.error("Error creating Razorpay subscription:", error);
      return res.status(500).json({ error: "Failed to create subscription" });
    }
  },
);

/**
 * Client-side confirmation after Razorpay subscription checkout (UPI / cards).
 * Verifies payment signature, ensures the subscription belongs to the signed-in user,
 * then upgrades Clerk immediately so the app updates without waiting on webhooks alone.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

router.post(
  "/payments/confirm-subscription-checkout",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId as string;
      const {
        razorpay_payment_id,
        razorpay_subscription_id,
        razorpay_signature,
      } = req.body ?? {};

      if (
        typeof razorpay_payment_id !== "string" ||
        typeof razorpay_subscription_id !== "string" ||
        typeof razorpay_signature !== "string" ||
        !razorpay_payment_id ||
        !razorpay_subscription_id ||
        !razorpay_signature
      ) {
        res.status(400).json({ error: "Missing payment confirmation fields" });
        return;
      }

      const isMockKeys =
        RAZORPAY_KEY_ID === "rzp_test_mock" ||
        RAZORPAY_KEY_SECRET === "mock_secret";
      if (!isMockKeys) {
        const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
        const expected = crypto
          .createHmac("sha256", RAZORPAY_KEY_SECRET)
          .update(body)
          .digest("hex");
        if (expected.length !== razorpay_signature.length) {
          res.status(400).json({ error: "Invalid payment signature" });
          return;
        }
        const ok = crypto.timingSafeEqual(
          Buffer.from(expected),
          Buffer.from(razorpay_signature),
        );
        if (!ok) {
          res.status(400).json({ error: "Invalid payment signature" });
          return;
        }
      } else {
        console.warn(
          "[payments] Skipping Razorpay signature check (mock keys)",
        );
      }

      /** Razorpay can lag briefly after checkout — retry fetch before failing. */
      type FetchedSub = {
        notes?: { userId?: string; planType?: string };
        status?: string;
      };
      let subscription: FetchedSub | null = null;
      let lastFetchErr: unknown;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          subscription = (await razorpay.subscriptions.fetch(
            razorpay_subscription_id,
          )) as unknown as FetchedSub;
          break;
        } catch (e) {
          lastFetchErr = e;
          await sleep(280 * (attempt + 1));
        }
      }
      if (!subscription) {
        console.error(
          "[payments] confirm-subscription: fetch subscription failed after retries",
          lastFetchErr,
        );
        res
          .status(502)
          .json({
            error: "Could not verify subscription with payment provider",
          });
        return;
      }

      const noteUserId = subscription.notes?.userId;
      if (!noteUserId || noteUserId !== userId) {
        res
          .status(403)
          .json({ error: "Subscription does not belong to this account" });
        return;
      }

      const existing = await clerkClient.users.getUser(userId);
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
      const wasNewPremium = meta.isPremium !== true;
      const planType =
        subscription.notes?.planType ??
        (meta.planType as string | undefined) ??
        "monthly";

      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...meta,
          isPremium: true,
          subscriptionId: razorpay_subscription_id,
          subscriptionStatus: "active",
          planType,
          premiumSince:
            (meta.premiumSince as string | undefined) ??
            new Date().toISOString(),
        },
      });

      if (wasNewPremium && shouldSendBillingEmail(razorpay_subscription_id)) {
        const timing = readSubscriptionTiming(subscription);
        queueSubscriptionWelcomeEmail({
          userId,
          subscriptionId: razorpay_subscription_id,
          planType: timing.planType ?? planType,
          nextBillingAt: timing.nextBillingAt,
          ...billingEmailFlags(razorpay_subscription_id),
        });
      }

      res.json({
        ok: true,
        subscriptionStatus: subscription.status ?? "active",
      });
    } catch (error) {
      console.error("[payments] confirm-subscription-checkout error:", error);
      res.status(500).json({ error: "Failed to confirm subscription" });
    }
  },
);

/**
 * Fresh Pro status from Clerk (bypasses stale JWT/session cache on the client after server-side metadata updates).
 */
router.get(
  "/payments/membership",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId as string;
      const user = await clerkClient.users.getUser(userId);
      const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      res.json({
        isPremium: meta.isPremium === true,
        subscriptionStatus:
          (meta.subscriptionStatus as string | undefined) ?? null,
        subscriptionId: (meta.subscriptionId as string | undefined) ?? null,
        planType: (meta.planType as string | undefined) ?? null,
      });
    } catch (e) {
      console.error("[payments] membership error", e);
      res.status(500).json({ error: "Failed to read membership" });
    }
  },
);

/**
 * Cancel Subscription endpoint
 * Called from the frontend settings page.
 */
router.post(
  "/payments/cancel-subscription",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId" });
      }

      // Cancel at the end of the billing cycle
      let subscriptionStatus = "cancelled";
      let cancelledSub: unknown = null;
      if (!isDevMockSubscription(subscriptionId)) {
        cancelledSub = await razorpay.subscriptions.cancel(
          subscriptionId,
          true,
        );
        subscriptionStatus = (cancelledSub as { status?: string }).status ?? "cancelled";
      }

      // Update clerk metadata to reflect cancelled status (will actually expire at cycle end)
      const existing = await clerkClient.users.getUser(userId);
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
      const planType = (meta.planType as string | undefined) ?? "monthly";
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...meta,
          isPremium: true,
          subscriptionId: subscriptionId,
          subscriptionStatus: "cancelled",
        },
      });

      if (shouldSendBillingEmail(subscriptionId)) {
        const mockDates = isDevMockSubscription(subscriptionId)
          ? devMockBillingDates()
          : null;
        const timing = readSubscriptionTiming(cancelledSub);
        queueSubscriptionCancelledEmail({
          userId,
          subscriptionId,
          planType: timing.planType ?? planType,
          accessUntil: mockDates?.currentEnd ?? timing.currentEnd,
          ...billingEmailFlags(subscriptionId),
        });
      }

      return res.json({ success: true, status: subscriptionStatus });
    } catch (error) {
      console.error("Error cancelling Razorpay subscription:", error);
      return res.status(500).json({ error: "Failed to cancel subscription" });
    }
  },
);

function razorpayErrDetail(error: unknown): string {
  if (error && typeof error === "object" && "error" in error) {
    const inner = (error as { error?: { description?: string; code?: string } })
      .error;
    if (inner?.description) return inner.description;
    if (inner?.code) return inner.code;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

type RpSubscription = {
  status?: string;
  notes?: { userId?: string };
  has_scheduled_changes?: boolean;
};

/**
 * Resume auto-renewal after cancel-at-cycle-end: clears Razorpay scheduled cancellation, then sets Clerk `subscriptionStatus` to active.
 */
router.post(
  "/payments/resume-subscription",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId as string;
      const existing = await clerkClient.users.getUser(userId);
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
      const subscriptionId = meta.subscriptionId as string | undefined;
      const subscriptionStatus = meta.subscriptionStatus as string | undefined;

      if (!subscriptionId) {
        res
          .status(400)
          .json({ error: "No subscription is linked to this account." });
        return;
      }

      if (meta.isPremium !== true) {
        res
          .status(400)
          .json({
            error:
              "Resume is only available while you still have Pro access for the current billing period.",
          });
        return;
      }

      if (subscriptionStatus !== "cancelled") {
        res
          .status(400)
          .json({ error: "Your subscription is already set to renew." });
        return;
      }

      const planType = (meta.planType as string | undefined) ?? "monthly";

      if (isDevMockSubscription(subscriptionId)) {
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...meta,
            subscriptionStatus: "active",
          },
        });

        if (shouldSendBillingEmail(subscriptionId)) {
          const { nextBillingAt } = devMockBillingDates();
          queueSubscriptionResumedEmail({
            userId,
            subscriptionId,
            planType,
            nextBillingAt,
            ...billingEmailFlags(subscriptionId),
          });
        }

        res.json({ success: true, providerStatus: "active" });
        return;
      }

      let sub: RpSubscription;
      try {
        sub = (await razorpay.subscriptions.fetch(
          subscriptionId,
        )) as RpSubscription;
      } catch (e) {
        console.error("[payments] resume-subscription: fetch failed", e);
        res
          .status(502)
          .json({
            error:
              "Could not verify your subscription with the payment provider.",
          });
        return;
      }

      const noteUserId = sub.notes?.userId;
      if (noteUserId && noteUserId !== userId) {
        res
          .status(403)
          .json({ error: "Subscription does not belong to this account." });
        return;
      }

      const subs = razorpay.subscriptions as typeof razorpay.subscriptions & {
        cancelScheduledChanges?: (id: string) => Promise<RpSubscription>;
        resume?: (
          id: string,
          params: { resume_at: string },
        ) => Promise<RpSubscription>;
      };

      const syncClerkActive = async (
        providerStatus?: string,
        providerSub?: unknown,
      ) => {
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...meta,
            subscriptionStatus: "active",
          },
        });

        if (shouldSendBillingEmail(subscriptionId)) {
          const timing = readSubscriptionTiming(providerSub ?? sub);
          queueSubscriptionResumedEmail({
            userId,
            subscriptionId,
            planType: timing.planType ?? planType,
            nextBillingAt: timing.nextBillingAt,
            ...billingEmailFlags(subscriptionId),
          });
        }

        res.json({ success: true, providerStatus: providerStatus ?? "active" });
      };

      const refetchAndMaybeSync = async (): Promise<boolean> => {
        try {
          const again = (await razorpay.subscriptions.fetch(
            subscriptionId,
          )) as RpSubscription;
          if (
            again.status === "active" &&
            again.has_scheduled_changes !== true
          ) {
            await syncClerkActive(again.status, again);
            return true;
          }
        } catch {
          /* ignore */
        }
        return false;
      };

      try {
        if (sub.status === "paused" && subs.resume) {
          const updated = await subs.resume(subscriptionId, {
            resume_at: "now",
          });
          await syncClerkActive(updated.status, updated);
          return;
        }

        if (subs.cancelScheduledChanges) {
          const updated = await subs.cancelScheduledChanges(subscriptionId);
          await syncClerkActive(updated.status, updated);
          return;
        }

        res
          .status(500)
          .json({
            error: "Payment provider client is missing resume support.",
          });
        return;
      } catch (e) {
        console.error(
          "[payments] resume-subscription: provider call failed",
          e,
        );
        if (await refetchAndMaybeSync()) {
          return;
        }
        res.status(400).json({
          error: "We could not re-enable auto-renewal automatically.",
          detail: razorpayErrDetail(e),
        });
      }
    } catch (error) {
      console.error("Error resuming subscription:", error);
      res.status(500).json({ error: "Failed to resume subscription" });
    }
  },
);

function webhookSignaturesEqual(
  expectedHex: string,
  received: string,
): boolean {
  try {
    if (expectedHex.length !== received.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expectedHex),
      Buffer.from(received),
    );
  } catch {
    return false;
  }
}

type RpSubEntity = {
  id?: string;
  status?: string;
  notes?: { userId?: string; planType?: string };
  current_end?: number;
};

function readSubscriptionEntity(payload: unknown): RpSubEntity | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { subscription?: { entity?: RpSubEntity } };
  const e = p.subscription?.entity;
  return e && typeof e === "object" ? e : null;
}

function readPaymentEntity(
  payload: unknown,
): { notes?: { userId?: string }; subscription_id?: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    payment?: {
      entity?: { notes?: { userId?: string }; subscription_id?: string };
    };
  };
  const e = p.payment?.entity;
  return e && typeof e === "object" ? e : null;
}

async function clerkGrantPremium(
  userId: string,
  subscriptionId: string | undefined,
  planType?: string,
): Promise<{ wasNewPremium: boolean; resolvedPlanType: string }> {
  const existing = await clerkClient.users.getUser(userId);
  const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
  const wasNewPremium = meta.isPremium !== true;
  const resolvedPlanType =
    planType ?? (meta.planType as string | undefined) ?? "monthly";
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      isPremium: true,
      subscriptionId:
        subscriptionId ?? (meta.subscriptionId as string | undefined),
      subscriptionStatus: "active",
      planType: resolvedPlanType,
      premiumSince:
        (meta.premiumSince as string | undefined) ?? new Date().toISOString(),
    },
  });
  return { wasNewPremium, resolvedPlanType };
}

/** Cancel-at-period-end: user stays Pro until current_end. */
async function clerkMarkRenewalCancelled(
  userId: string,
  subscriptionId: string | undefined,
): Promise<void> {
  const existing = await clerkClient.users.getUser(userId);
  const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      isPremium: true,
      subscriptionId:
        subscriptionId ?? (meta.subscriptionId as string | undefined),
      subscriptionStatus: "cancelled",
    },
  });
}

async function clerkRevokePremium(
  userId: string,
  status: string,
): Promise<{ hadPremium: boolean; subscriptionId?: string; planType?: string }> {
  const existing = await clerkClient.users.getUser(userId);
  const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
  const hadPremium = meta.isPremium === true;
  const subscriptionId = meta.subscriptionId as string | undefined;
  const planType = meta.planType as string | undefined;
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      isPremium: false,
      subscriptionId: null,
      subscriptionStatus: status,
    },
  });
  return { hadPremium, subscriptionId, planType };
}

async function clerkSetSubscriptionStatus(
  userId: string,
  status: string,
  keepPremium: boolean,
): Promise<void> {
  const existing = await clerkClient.users.getUser(userId);
  const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      isPremium: keepPremium,
      subscriptionStatus: status,
    },
  });
}

/**
 * Razorpay subscription webhooks — keep in sync with Dashboard webhook settings.
 *
 * Recommended events: `subscription.activated`, `subscription.charged`, `subscription.completed`,
 * `subscription.cancelled`, `subscription.paused`, `subscription.resumed`, and **`subscription.halted`**
 * (payment failures — add this in Razorpay if not already). `subscription.pending` is optional.
 */
router.post(
  "/payments/webhook",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawBody = (req as any).rawBody;
      const signature = req.headers["x-razorpay-signature"] as
        | string
        | undefined;

      if (!rawBody || !signature) {
        res.status(400).send("Missing body or signature");
        return;
      }

      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody.toString())
        .digest("hex");

      if (!webhookSignaturesEqual(expectedSignature, signature)) {
        if (RAZORPAY_KEY_ID === "rzp_test_mock") {
          console.warn(
            "[payments] webhook: invalid signature (ignored in mock key mode)",
          );
        } else {
          res.status(400).json({ error: "Invalid signature" });
          return;
        }
      }

      const event = req.body as { event?: string; payload?: unknown };
      const eventName = event.event ?? "";
      const payload = event.payload;

      const nowSec = Math.floor(Date.now() / 1000);

      switch (eventName) {
        case "subscription.charged":
        case "subscription.activated": {
          const pay = readPaymentEntity(payload);
          const sub = readSubscriptionEntity(payload);
          const userId = sub?.notes?.userId || pay?.notes?.userId;
          const subId =
            sub?.id ||
            (typeof pay?.subscription_id === "string"
              ? pay.subscription_id
              : undefined);
          if (userId && subId) {
            const { wasNewPremium, resolvedPlanType } = await clerkGrantPremium(
              userId,
              subId,
              sub?.notes?.planType,
            );
            if (shouldSendBillingEmail(subId)) {
              const timing = readSubscriptionTiming(sub);
              if (wasNewPremium) {
                queueSubscriptionWelcomeEmail({
                  userId,
                  subscriptionId: subId,
                  planType: timing.planType ?? resolvedPlanType,
                  nextBillingAt: timing.nextBillingAt,
                  ...billingEmailFlags(subId),
                });
              } else if (eventName === "subscription.charged") {
                queueSubscriptionRenewalEmail({
                  userId,
                  subscriptionId: subId,
                  planType: timing.planType ?? resolvedPlanType,
                  nextBillingAt: timing.nextBillingAt,
                  ...billingEmailFlags(subId),
                });
              }
            }
            console.log(
              `[payments] webhook ${eventName}: premium for user ${userId}`,
            );
          }
          break;
        }

        case "subscription.resumed": {
          const sub = readSubscriptionEntity(payload);
          const userId = sub?.notes?.userId;
          if (userId) {
            await clerkSetSubscriptionStatus(userId, "active", true);
            const subId = sub?.id;
            if (subId && shouldSendBillingEmail(subId)) {
              const timing = readSubscriptionTiming(sub);
              queueSubscriptionResumedEmail({
                userId,
                subscriptionId: subId,
                planType: timing.planType ?? sub?.notes?.planType,
                nextBillingAt: timing.nextBillingAt,
                ...billingEmailFlags(subId),
              });
            }
            console.log(`[payments] webhook subscription.resumed: ${userId}`);
          }
          break;
        }

        case "subscription.paused": {
          const sub = readSubscriptionEntity(payload);
          const userId = sub?.notes?.userId;
          if (userId) {
            await clerkSetSubscriptionStatus(userId, "paused", true);
            console.log(`[payments] webhook subscription.paused: ${userId}`);
          }
          break;
        }

        case "subscription.halted": {
          const sub = readSubscriptionEntity(payload);
          const userId = sub?.notes?.userId;
          if (userId) {
            const subId = sub?.id;
            if (subId && shouldSendBillingEmail(subId)) {
              queuePaymentFailedEmail({
                userId,
                subscriptionId: subId,
                planType: sub?.notes?.planType,
                ...billingEmailFlags(subId),
              });
            }
            await clerkRevokePremium(userId, "halted");
            console.log(`[payments] webhook subscription.halted: ${userId}`);
          }
          break;
        }

        case "subscription.completed": {
          const sub = readSubscriptionEntity(payload);
          const userId = sub?.notes?.userId;
          if (userId) {
            const revoked = await clerkRevokePremium(userId, "completed");
            const subId = revoked.subscriptionId ?? sub?.id;
            if (
              revoked.hadPremium &&
              subId &&
              shouldSendBillingEmail(subId)
            ) {
              queueSubscriptionEndedEmail({
                userId,
                subscriptionId: subId,
                planType: revoked.planType ?? sub?.notes?.planType,
                reason: "completed",
                ...billingEmailFlags(subId),
              });
            }
            console.log(`[payments] webhook subscription.completed: ${userId}`);
          }
          break;
        }

        case "subscription.cancelled": {
          const sub = readSubscriptionEntity(payload);
          const userId = sub?.notes?.userId;
          if (!userId) break;

          const status = String(sub.status ?? "");
          const currentEnd =
            typeof sub.current_end === "number" ? sub.current_end : 0;
          const stillInPaidPeriod = currentEnd > nowSec;

          // Active/authenticated with a future billing end → cancel-at-cycle-end semantics (keep Pro).
          if (
            status === "active" ||
            status === "authenticated" ||
            stillInPaidPeriod
          ) {
            await clerkMarkRenewalCancelled(userId, sub.id);
            if (sub.id && shouldSendBillingEmail(sub.id)) {
              queueSubscriptionCancelledEmail({
                userId,
                subscriptionId: sub.id,
                planType: sub?.notes?.planType,
                accessUntil: currentEnd || undefined,
                ...billingEmailFlags(sub.id),
              });
            }
            console.log(
              `[payments] webhook subscription.cancelled (renewal stopped, access retained): ${userId}`,
            );
          } else {
            const revoked = await clerkRevokePremium(userId, "cancelled");
            const subId = revoked.subscriptionId ?? sub?.id;
            if (
              revoked.hadPremium &&
              subId &&
              shouldSendBillingEmail(subId)
            ) {
              queueSubscriptionEndedEmail({
                userId,
                subscriptionId: subId,
                planType: revoked.planType ?? sub?.notes?.planType,
                reason: "cancelled",
                ...billingEmailFlags(subId),
              });
            }
            console.log(
              `[payments] webhook subscription.cancelled (access ended): ${userId}`,
            );
          }
          break;
        }

        default:
          if (eventName) {
            console.log(`[payments] webhook ignored event: ${eventName}`);
          }
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).send("Webhook handler failed");
    }
  },
);

// Create a mock verification endpoint to manually trigger upgrade for testing without real payments
router.post(
  "/payments/dev-upgrade",
  requireAuth,
  async (req: Request, res: Response) => {
    if (rejectUnlessDevBilling(res)) return;

    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const bodyPlan = (req.body as { planType?: unknown })?.planType;
      const planType = bodyPlan === "yearly" ? "yearly" : "monthly";

      const existing = await clerkClient.users.getUser(userId);
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;

      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...meta,
          isPremium: true,
          premiumSince:
            (meta.premiumSince as string | undefined) ??
            new Date().toISOString(),
          subscriptionId: DEV_MOCK_SUBSCRIPTION_ID,
          subscriptionStatus: "active",
          planType,
        },
      });

      if (shouldSendBillingEmail(DEV_MOCK_SUBSCRIPTION_ID)) {
        const { nextBillingAt } = devMockBillingDates();
        queueSubscriptionWelcomeEmail({
          userId,
          subscriptionId: DEV_MOCK_SUBSCRIPTION_ID,
          planType,
          nextBillingAt,
          allowRetest: true,
        });
      }

      return res.json({
        success: true,
        message: "Developer upgrade successful",
        emailQueued: shouldSendBillingEmail(DEV_MOCK_SUBSCRIPTION_ID),
      });
    } catch (error) {
      console.error("Dev upgrade error:", error);
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : String(error),
        });
    }
  },
);

/**
 * Get Subscription Details
 * Retrieves the live subscription details from Razorpay or returns mock data for dev.
 */
router.get(
  "/payments/subscription",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await clerkClient.users.getUser(userId);
      const subscriptionId = user.publicMetadata?.subscriptionId as
        | string
        | undefined;

      if (!subscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      const clerkSubscriptionStatus =
        (user.publicMetadata?.subscriptionStatus as string | undefined) ?? null;

      if (isDevMockSubscription(subscriptionId)) {
        const mockDates = devMockBillingDates();
        return res.json({
          id: DEV_MOCK_SUBSCRIPTION_ID,
          status: user.publicMetadata.subscriptionStatus || "active",
          plan_id: "plan_mock_monthly",
          current_start: Math.floor(Date.now() / 1000) - 86400,
          current_end: mockDates.currentEnd,
          next_billing_at: mockDates.nextBillingAt,
          notes: { planType: user.publicMetadata.planType || "monthly" },
          short_url: "https://razorpay.com/docs/api/subscriptions/",
          clerkSubscriptionStatus,
        });
      }

      const subscription = await razorpay.subscriptions.fetch(subscriptionId);
      return res.json({
        ...(subscription as unknown as Record<string, unknown>),
        clerkSubscriptionStatus,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch subscription details" });
    }
  },
);

// Create a mock verification endpoint to manually trigger downgrade for testing
router.post(
  "/payments/dev-downgrade",
  requireAuth,
  async (req: Request, res: Response) => {
    if (rejectUnlessDevBilling(res)) return;

    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const existing = await clerkClient.users.getUser(userId);
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
      const wasPremium = meta.isPremium === true;
      const subscriptionId = meta.subscriptionId as string | undefined;
      const planType = (meta.planType as string | undefined) ?? "monthly";

      if (
        wasPremium &&
        subscriptionId &&
        shouldSendBillingEmail(subscriptionId)
      ) {
        queueSubscriptionEndedEmail({
          userId,
          subscriptionId,
          planType,
          reason: "completed",
          allowRetest: true,
        });
      }

      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...meta,
          isPremium: false,
          premiumSince: null,
          subscriptionId: null,
          subscriptionStatus: null,
        },
      });

      void clearSubscriptionEmailDedupe(userId);

      return res.json({
        success: true,
        message: "Developer downgrade successful",
        emailQueued:
          wasPremium &&
          Boolean(subscriptionId && shouldSendBillingEmail(subscriptionId)),
      });
    } catch (error) {
      console.error("Dev downgrade error:", error);
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : String(error),
        });
    }
  },
);

export default router;
