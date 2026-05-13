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
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        isPremium: true, // Remains true until the cycle ends (handled by webhook eventually)
        subscriptionId: subscriptionId,
        subscriptionStatus: "cancelled"
      }
    });

    return res.json({ success: true, status: subscriptionStatus });
  } catch (error) {
    console.error("Error cancelling Razorpay subscription:", error);
    return res.status(500).json({ error: "Failed to cancel subscription" });
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
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            isPremium: true,
            subscriptionId: subscriptionId,
            subscriptionStatus: "active",
            premiumSince: new Date().toISOString()
          }
        });
        console.log(`Successfully upgraded/renewed user ${userId} to Premium via subscription!`);
      }
    }

    // Handle Subscription Cancellation or Halt (payment failure)
    if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
      const subscriptionEntity = event.payload.subscription.entity;
      const userId = subscriptionEntity.notes?.userId;

      if (userId) {
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            isPremium: false,
            subscriptionId: null,
            subscriptionStatus: event.event === "subscription.cancelled" ? "cancelled" : "halted"
          }
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
