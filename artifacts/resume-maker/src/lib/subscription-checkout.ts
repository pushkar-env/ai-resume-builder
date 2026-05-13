import type { QueryClient } from "@tanstack/react-query";

/** Must stay aligned with `getListResumesQueryKey()` from `@workspace/api-client-react`. */
const LIST_RESUMES_QUERY_KEY = ["/api/resumes"] as const;

/** Minimal Clerk user surface used after Razorpay checkout. */
export type CheckoutUser = {
  reload: () => Promise<{ publicMetadata?: Record<string, unknown> } | null | undefined>;
};

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reloadClerkUserFresh(
  user: CheckoutUser,
  getToken: () => Promise<string | null | undefined>
): Promise<{ publicMetadata?: Record<string, unknown> } | null | undefined> {
  try {
    const gt = getToken as (opts?: { skipCache?: boolean }) => Promise<unknown>;
    await gt({ skipCache: true });
  } catch {
    /* non-fatal */
  }
  return user.reload();
}

async function confirmSubscriptionOnServer(params: {
  apiUrl: string;
  getToken: () => Promise<string | null | undefined>;
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}): Promise<boolean> {
  const { apiUrl, getToken, razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = params;
  const token = await getToken();
  if (!token) return false;
  const res = await fetch(`${apiUrl}/payments/confirm-subscription-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    }),
  });
  return res.ok;
}

async function pollUntilPremium(params: {
  user: CheckoutUser;
  getToken: () => Promise<string | null | undefined>;
  maxAttempts: number;
  intervalMs: number;
}): Promise<boolean> {
  const { user, getToken, maxAttempts, intervalMs } = params;
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(intervalMs);
    const u = await reloadClerkUserFresh(user, getToken);
    if (u?.publicMetadata?.isPremium === true) return true;
  }
  return false;
}

function attachVisibilityPremiumRecovery(params: {
  user: CheckoutUser;
  getToken: () => Promise<string | null | undefined>;
  onPremium: () => void;
  timeoutMs: number;
}): () => void {
  const { user, getToken, onPremium, timeoutMs } = params;
  let stopped = false;

  const handler = () => {
    if (stopped || document.visibilityState !== "visible") return;
    void (async () => {
      for (let i = 0; i < 10 && !stopped; i++) {
        const u = await reloadClerkUserFresh(user, getToken);
        if (u?.publicMetadata?.isPremium === true) {
          cleanup();
          onPremium();
          return;
        }
        await sleep(900);
      }
    })();
  };

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    document.removeEventListener("visibilitychange", handler);
    window.clearTimeout(timer);
  };

  document.addEventListener("visibilitychange", handler);
  const timer = window.setTimeout(() => cleanup(), timeoutMs);

  return cleanup;
}

async function invalidatePostPremiumQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["billing-page-subscription"] });
  await queryClient.invalidateQueries({ queryKey: ["subscription-details"] });
  await queryClient.invalidateQueries({ queryKey: LIST_RESUMES_QUERY_KEY });
}

export type OpenSubscriptionCheckoutParams = {
  billingCycle: "monthly" | "yearly";
  getToken: () => Promise<string | null | undefined>;
  user: CheckoutUser;
  apiUrl: string;
  razorpayKeyId: string;
  /** e.g. import.meta.env.BASE_URL — used for Razorpay `image` */
  checkoutImageUrl: string;
  /** Display name shown in Razorpay sheet */
  customerName: string;
  customerEmail: string;
  queryClient: QueryClient;
  onPremiumConfirmed: () => void;
  /** e.g. toast for “still processing” when webhook is slow */
  onStillPending: () => void;
  toastError: (title: string, description?: string) => void;
};

/**
 * Creates a Razorpay subscription checkout. On success, confirms with the backend (signature + ownership),
 * refreshes Clerk aggressively for mobile UPI handoff, polls if needed, and invalidates billing/list caches.
 */
export async function openSubscriptionCheckout(params: OpenSubscriptionCheckoutParams): Promise<void> {
  const {
    billingCycle,
    getToken,
    user,
    apiUrl,
    razorpayKeyId,
    checkoutImageUrl,
    customerName,
    customerEmail,
    queryClient,
    onPremiumConfirmed,
    onStillPending,
    toastError,
  } = params;

  const ready = await loadRazorpayScript();
  if (!ready) {
    toastError("Could not load checkout", "Please check your connection and try again.");
    return;
  }

  const token = await getToken();
  if (!token) {
    toastError("Session expired", "Please sign in again to continue.");
    return;
  }

  const subRes = await fetch(`${apiUrl}/payments/create-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planType: billingCycle }),
  });

  const raw = await subRes.text();
  let subscriptionData: { id?: string } | null = null;
  try {
    subscriptionData = raw ? (JSON.parse(raw) as { id?: string }) : null;
  } catch {
    subscriptionData = null;
  }

  if (!subRes.ok || !subscriptionData?.id) {
    toastError(
      "Could not start checkout",
      raw && raw.length < 280 ? raw : subRes.statusText || "Please try again in a moment."
    );
    return;
  }

  const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (a: unknown) => void) => void } }).Razorpay;
  if (typeof RazorpayCtor !== "function") {
    toastError("Checkout unavailable", "Payment SDK did not load correctly.");
    return;
  }

  let detachVisibility: (() => void) | null = null;

  const finishIfPremium = async (): Promise<boolean> => {
    const u = await reloadClerkUserFresh(user, getToken);
    if (u?.publicMetadata?.isPremium === true) {
      await invalidatePostPremiumQueries(queryClient);
      detachVisibility?.();
      onPremiumConfirmed();
      return true;
    }
    return false;
  };

  const processSuccessResponse = async (response: Record<string, unknown>) => {
    try {
      const paymentId = String(response.razorpay_payment_id ?? "");
      const subscriptionId = String(response.razorpay_subscription_id ?? "");
      const signature = String(response.razorpay_signature ?? "");

      if (paymentId && subscriptionId && signature) {
        const confirmed = await confirmSubscriptionOnServer({
          apiUrl,
          getToken,
          razorpay_payment_id: paymentId,
          razorpay_subscription_id: subscriptionId,
          razorpay_signature: signature,
        });
        if (!confirmed) {
          /* Webhook may still succeed — continue polling */
        }
      }

      if (await finishIfPremium()) return;

      const fast = await pollUntilPremium({
        user,
        getToken,
        maxAttempts: 18,
        intervalMs: 1200,
      });
      if (fast) {
        await invalidatePostPremiumQueries(queryClient);
        detachVisibility?.();
        onPremiumConfirmed();
        return;
      }

      detachVisibility = attachVisibilityPremiumRecovery({
        user,
        getToken,
        onPremium: () => {
          detachVisibility?.();
          detachVisibility = null;
          void (async () => {
            await invalidatePostPremiumQueries(queryClient);
            onPremiumConfirmed();
          })();
        },
        timeoutMs: 8 * 60 * 1000,
      });

      onStillPending();
    } catch (e) {
      console.error("[subscription-checkout] post-payment handler", e);
      const recovered = await pollUntilPremium({
        user,
        getToken,
        maxAttempts: 12,
        intervalMs: 1500,
      });
      if (recovered) {
        await invalidatePostPremiumQueries(queryClient);
        detachVisibility?.();
        onPremiumConfirmed();
      } else {
        onStillPending();
      }
    }
  };

  const options: Record<string, unknown> = {
    key: razorpayKeyId,
    name: "ResumeSensei",
    description: `Pro ${billingCycle === "yearly" ? "Yearly" : "Monthly"} subscription`,
    image: checkoutImageUrl,
    subscription_id: subscriptionData.id,
    handler(response: Record<string, unknown>) {
      void processSuccessResponse(response);
    },
    prefill: {
      name: customerName,
      email: customerEmail,
    },
    theme: { color: "#4f46e5" },
    modal: {
      ondismiss: () => {
        detachVisibility?.();
      },
    },
  };

  try {
    const paymentObject = new RazorpayCtor(options);
    paymentObject.on("payment.failed", (payload: unknown) => {
      const p = payload as { error?: { description?: string; reason?: string; code?: string } };
      const msg =
        p?.error?.description ||
        p?.error?.reason ||
        (typeof p?.error?.code === "string" ? `Error code: ${p.error.code}` : null) ||
        "Payment could not be completed.";
      toastError("Payment did not go through", msg);
    });
    paymentObject.open();
  } catch (e) {
    console.error("[subscription-checkout] Razorpay open", e);
    toastError("Could not open checkout", "Please try again or use a different network.");
  }
}
