/** Razorpay subscription id used by POST /payments/dev-upgrade (local testing only). */
export const DEV_MOCK_SUBSCRIPTION_ID = "sub_dev_mock";

/** True when dev bypass endpoints and mock-subscription emails are allowed. */
export function isDevBillingMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ENABLE_DEV_BILLING === "false") return false;
  if (process.env.ENABLE_DEV_BILLING === "true") return true;
  return true;
}

export function isDevMockSubscription(
  subscriptionId?: string | null,
): boolean {
  return subscriptionId === DEV_MOCK_SUBSCRIPTION_ID;
}

/** Mirrors GET /payments/subscription mock payload timing (30-day cycle). */
export function devMockBillingDates(): {
  currentEnd: number;
  nextBillingAt: number;
} {
  const currentEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  return { currentEnd, nextBillingAt: currentEnd };
}

export function shouldSendBillingEmail(
  subscriptionId?: string | null,
): boolean {
  if (!subscriptionId) return false;
  if (isDevMockSubscription(subscriptionId)) {
    return isDevBillingMode();
  }
  return true;
}

export function billingEmailFlags(
  subscriptionId: string,
): { allowRetest: boolean } {
  return {
    allowRetest: isDevMockSubscription(subscriptionId) && isDevBillingMode(),
  };
}
