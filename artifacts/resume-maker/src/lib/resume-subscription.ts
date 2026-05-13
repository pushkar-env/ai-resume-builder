export type ResumeSubscriptionResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Re-enables Pro auto-renewal after the user cancelled at period end (Razorpay scheduled change + Clerk `subscriptionStatus: cancelled`).
 */
export async function resumeSubscriptionRenewal(
  getToken: () => Promise<string | null | undefined>,
): Promise<ResumeSubscriptionResult> {
  const token = await getToken();
  if (!token) {
    return { ok: false, message: "You need to be signed in to resume your subscription." };
  }

  const apiUrl = import.meta.env.VITE_API_URL || "/api";
  const res = await fetch(`${apiUrl}/payments/resume-subscription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let body: { error?: string; detail?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    const msg = body.detail ?? body.error ?? `Request failed (${res.status}).`;
    return { ok: false, message: msg };
  }

  return { ok: true };
}
