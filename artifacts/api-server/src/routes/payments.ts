import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getAuth, clerkClient } from "@clerk/express";

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
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret";
const RAZORPAY_MONTHLY_PLAN_ID = process.env.RAZORPAY_MONTHLY_PLAN_ID || "plan_mock_monthly";
const RAZORPAY_YEARLY_PLAN_ID = process.env.RAZORPAY_YEARLY_PLAN_ID || "plan_mock_yearly";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * 1. Create Subscription endpoint
 * Called from the frontend when the user clicks "Upgrade to Pro".
 * It creates a Razorpay subscription and returns the ID.
 */
router.post("/payments/create-subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { planType } = req.body; // "monthly" or "yearly"
    const planId = planType === "yearly" ? RAZORPAY_YEARLY_PLAN_ID : RAZORPAY_MONTHLY_PLAN_ID;

    const options = {
      plan_id: planId,
      total_count: planType === "yearly" ? 10 : 120, // 10 years of billing
      customer_notify: 1 as 1,
      notes: {
        userId: userId,
        planType: planType
      }
    };

    const subscription = await razorpay.subscriptions.create(options);
    
    return res.json({
      id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status
    });
  } catch (error) {
    console.error("Error creating Razorpay subscription:", error);
    return res.status(500).json({ error: "Failed to create subscription" });
  }
});

/**
 * Client-side confirmation after Razorpay subscription checkout (UPI / cards).
 * Verifies payment signature, ensures the subscription belongs to the signed-in user,
 * then upgrades Clerk immediately so the app updates without waiting on webhooks alone.
 */
router.post("/payments/confirm-subscription-checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body ?? {};

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

    const isMockKeys = RAZORPAY_KEY_ID === "rzp_test_mock" || RAZORPAY_KEY_SECRET === "mock_secret";
    if (!isMockKeys) {
      const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
      const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");
      if (expected.length !== razorpay_signature.length) {
        res.status(400).json({ error: "Invalid payment signature" });
        return;
      }
      const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
      if (!ok) {
        res.status(400).json({ error: "Invalid payment signature" });
        return;
      }
    } else {
      console.warn("[payments] Skipping Razorpay signature check (mock keys)");
    }

    let subscription: { notes?: { userId?: string; planType?: string }; status?: string };
    try {
      subscription = (await razorpay.subscriptions.fetch(razorpay_subscription_id)) as typeof subscription;
    } catch (e) {
      console.error("[payments] confirm-subscription: fetch subscription failed", e);
      res.status(502).json({ error: "Could not verify subscription with payment provider" });
      return;
    }

    const noteUserId = subscription.notes?.userId;
    if (!noteUserId || noteUserId !== userId) {
      res.status(403).json({ error: "Subscription does not belong to this account" });
      return;
    }

    const existing = await clerkClient.users.getUser(userId);
    const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...meta,
        isPremium: true,
        subscriptionId: razorpay_subscription_id,
        subscriptionStatus: "active",
        planType: subscription.notes?.planType ?? meta.planType ?? "monthly",
        premiumSince: (meta.premiumSince as string | undefined) ?? new Date().toISOString(),
      },
    });

    res.json({ ok: true, subscriptionStatus: subscription.status ?? "active" });
  } catch (error) {
    console.error("[payments] confirm-subscription-checkout error:", error);
    res.status(500).json({ error: "Failed to confirm subscription" });
  }
});

/**
 * Cancel Subscription endpoint
 * Called from the frontend settings page.
 */
router.post("/payments/cancel-subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: "Missing subscriptionId" });
    }

    // Cancel at the end of the billing cycle
    let subscriptionStatus = "cancelled";
    if (subscriptionId !== "sub_dev_mock") {
      const subscription = await razorpay.subscriptions.cancel(subscriptionId, true);
      subscriptionStatus = subscription.status;
    }

    // Update clerk metadata to reflect cancelled status (will actually expire at cycle end)
    const existing = await clerkClient.users.getUser(userId);
    const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...meta,
        isPremium: true,
        subscriptionId: subscriptionId,
        subscriptionStatus: "cancelled",
      },
    });

    return res.json({ success: true, status: subscriptionStatus });
  } catch (error) {
    console.error("Error cancelling Razorpay subscription:", error);
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

function razorpayErrDetail(error: unknown): string {
  if (error && typeof error === "object" && "error" in error) {
    const inner = (error as { error?: { description?: string; code?: string } }).error;
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
router.post("/payments/resume-subscription", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const existing = await clerkClient.users.getUser(userId);
    const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
    const subscriptionId = meta.subscriptionId as string | undefined;
    const subscriptionStatus = meta.subscriptionStatus as string | undefined;

    if (!subscriptionId) {
      res.status(400).json({ error: "No subscription is linked to this account." });
      return;
    }

    if (meta.isPremium !== true) {
      res
        .status(400)
        .json({ error: "Resume is only available while you still have Pro access for the current billing period." });
      return;
    }

    if (subscriptionStatus !== "cancelled") {
      res.status(400).json({ error: "Your subscription is already set to renew." });
      return;
    }

    if (subscriptionId === "sub_dev_mock") {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...meta,
          subscriptionStatus: "active",
        },
      });
      res.json({ success: true, providerStatus: "active" });
      return;
    }

    let sub: RpSubscription;
    try {
      sub = (await razorpay.subscriptions.fetch(subscriptionId)) as RpSubscription;
    } catch (e) {
      console.error("[payments] resume-subscription: fetch failed", e);
      res.status(502).json({ error: "Could not verify your subscription with the payment provider." });
      return;
    }

    const noteUserId = sub.notes?.userId;
    if (noteUserId && noteUserId !== userId) {
      res.status(403).json({ error: "Subscription does not belong to this account." });
      return;
    }

    const subs = razorpay.subscriptions as typeof razorpay.subscriptions & {
      cancelScheduledChanges?: (id: string) => Promise<RpSubscription>;
      resume?: (id: string, params: { resume_at: string }) => Promise<RpSubscription>;
    };

    const syncClerkActive = async (providerStatus?: string) => {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...meta,
          subscriptionStatus: "active",
        },
      });
      res.json({ success: true, providerStatus: providerStatus ?? "active" });
    };

    const refetchAndMaybeSync = async (): Promise<boolean> => {
      try {
        const again = (await razorpay.subscriptions.fetch(subscriptionId)) as RpSubscription;
        if (again.status === "active" && again.has_scheduled_changes !== true) {
          await syncClerkActive(again.status);
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };

    try {
      if (sub.status === "paused" && subs.resume) {
        const updated = await subs.resume(subscriptionId, { resume_at: "now" });
        await syncClerkActive(updated.status);
        return;
      }

      if (subs.cancelScheduledChanges) {
        const updated = await subs.cancelScheduledChanges(subscriptionId);
        await syncClerkActive(updated.status);
        return;
      }

      res.status(500).json({ error: "Payment provider client is missing resume support." });
      return;
    } catch (e) {
      console.error("[payments] resume-subscription: provider call failed", e);
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
});

/**
 * 2. Webhook endpoint
 * Called by Razorpay directly when a payment succeeds.
 */
router.post("/payments/webhook", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody;
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!rawBody || !signature) {
      return res.status(400).send("Missing body or signature");
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody.toString())
      .digest("hex");

    if (expectedSignature !== signature) {
      // In development/test if mock keys are used, we might bypass or log this
      if (RAZORPAY_KEY_ID === "rzp_test_mock") {
        console.warn("Invalid signature, but mocking success for development");
      } else {
        return res.status(400).json({ error: "Invalid signature" });
      }
    }

    const event = req.body;

    // Handle Subscription Success
    if (event.event === "subscription.charged") {
      const paymentEntity = event.payload.payment.entity;
      const subscriptionEntity = event.payload.subscription?.entity;
      const subscriptionId = subscriptionEntity?.id;
      
      // Notes are often attached to the subscription entity rather than the payment entity in Razorpay
      const userId = paymentEntity?.notes?.userId || subscriptionEntity?.notes?.userId;

      if (userId) {
        const existing = await clerkClient.users.getUser(userId);
        const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...meta,
            isPremium: true,
            subscriptionId: subscriptionId,
            subscriptionStatus: "active",
            premiumSince: (meta.premiumSince as string | undefined) ?? new Date().toISOString(),
          },
        });
        console.log(`Successfully upgraded/renewed user ${userId} to Premium via subscription!`);
      }
    }

    // Handle Subscription Cancellation or Halt (payment failure)
    if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
      const subscriptionEntity = event.payload.subscription.entity;
      const userId = subscriptionEntity.notes?.userId;

      if (userId) {
        const existing = await clerkClient.users.getUser(userId);
        const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...meta,
            isPremium: false,
            subscriptionId: null,
            subscriptionStatus: event.event === "subscription.cancelled" ? "cancelled" : "halted",
          },
        });
        console.log(`Successfully revoked premium for user ${userId} due to subscription status: ${event.event}`);
      }
    }

    return res.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).send("Webhook handler failed");
  }
});

// Create a mock verification endpoint to manually trigger upgrade for testing without real payments
router.post("/payments/dev-upgrade", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        isPremium: true,
        premiumSince: new Date().toISOString(),
        subscriptionId: "sub_dev_mock",
        subscriptionStatus: "active",
        planType: "monthly"
      }
    });
    
    return res.json({ success: true, message: "Developer upgrade successful" });
  } catch (error) {
    console.error("Dev upgrade error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Get Subscription Details
 * Retrieves the live subscription details from Razorpay or returns mock data for dev.
 */
router.get("/payments/subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await clerkClient.users.getUser(userId);
    const subscriptionId = user.publicMetadata?.subscriptionId as string | undefined;

    if (!subscriptionId) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    const clerkSubscriptionStatus =
      (user.publicMetadata?.subscriptionStatus as string | undefined) ?? null;

    if (subscriptionId === "sub_dev_mock") {
      return res.json({
        id: "sub_dev_mock",
        status: user.publicMetadata.subscriptionStatus || "active",
        plan_id: "plan_mock_monthly",
        current_start: Math.floor(Date.now() / 1000) - 86400,
        current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        next_billing_at: Math.floor(Date.now() / 1000) + 30 * 86400,
        notes: { planType: user.publicMetadata.planType || "monthly" },
        short_url: "https://razorpay.com/docs/api/subscriptions/",
        clerkSubscriptionStatus,
      });
    }

    const subscription = await razorpay.subscriptions.fetch(subscriptionId);
    return res.json({
      ...(subscription as Record<string, unknown>),
      clerkSubscriptionStatus,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return res.status(500).json({ error: "Failed to fetch subscription details" });
  }
});

// Create a mock verification endpoint to manually trigger downgrade for testing
router.post("/payments/dev-downgrade", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        isPremium: false,
        premiumSince: null,
        subscriptionId: null,
        subscriptionStatus: null
      }
    });
    
    return res.json({ success: true, message: "Developer downgrade successful" });
  } catch (error) {
    console.error("Dev downgrade error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
