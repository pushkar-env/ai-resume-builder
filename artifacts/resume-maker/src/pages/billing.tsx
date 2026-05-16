import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Shield,
  Star,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { AppFooter } from "@/components/layout/AppFooter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/shared/SEO";
import { SubscriptionSuccessDialog } from "@/components/shared/SubscriptionSuccessDialog";
import { ResumeRenewalFlow } from "@/components/shared/ResumeRenewalFlow";
import { openSubscriptionCheckout } from "@/lib/subscription-checkout";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "@/lib/plan-features";

function formatDate(timestamp?: number) {
  if (!timestamp) return "Unknown";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type SubscriptionPayload = {
  notes?: { planType?: string };
  current_start?: number;
  current_end?: number;
  /** Clerk publicMetadata.subscriptionStatus — set on user-initiated cancel (Razorpay may still report active until period end). */
  clerkSubscriptionStatus?: string | null;
};

export default function BillingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscriptionSuccessOpen, setSubscriptionSuccessOpen] = useState(false);

  const isPremium = user?.publicMetadata?.isPremium === true;
  const subscriptionId = user?.publicMetadata?.subscriptionId as string | undefined;
  const subscriptionStatus = user?.publicMetadata?.subscriptionStatus as string | undefined;

  const { data: subscriptionDetails, isLoading: detailsLoading, isError: detailsError, refetch: refetchSubscription } = useQuery({
    queryKey: ["billing-page-subscription", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch subscription details");
      return res.json() as SubscriptionPayload;
    },
    enabled: !!subscriptionId && isPremium,
    staleTime: 0,
  });

  const isCancelledRenewal =
    subscriptionStatus === "cancelled" ||
    subscriptionDetails?.clerkSubscriptionStatus === "cancelled";

  const handleUpgrade = async () => {
    if (!user) {
      setLocation("/sign-in");
      return;
    }

    setIsProcessing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      await openSubscriptionCheckout({
        billingCycle,
        getToken,
        user,
        apiUrl,
        razorpayKeyId: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_mock",
        checkoutImageUrl: `${import.meta.env.BASE_URL}bluemascot.svg`,
        customerName: user.fullName || "",
        customerEmail: user.primaryEmailAddress?.emailAddress || "",
        queryClient,
        onPremiumConfirmed: () => setSubscriptionSuccessOpen(true),
        onStillPending: () =>
          toast({
            title: "Payment received",
            description:
              "Your bank may take a moment to confirm. Return to this tab or pull to refresh — Pro usually appears within a minute.",
          }),
        toastError: (title, description) =>
          toast({ title, description, variant: "destructive" }),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Something went wrong during checkout.";
      toast({ title: "Checkout Error", description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscriptionId) return;
    if (!window.confirm("Cancel your subscription? You will retain Pro access until the current cycle ends.")) return;

    setIsCancelling(true);
    try {
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/cancel-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });
      if (!res.ok) throw new Error("Failed to cancel subscription");
      await user?.reload();
      await queryClient.invalidateQueries({ queryKey: ["billing-page-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-details"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your plan will not renew after the current billing cycle.",
      });
    } catch (error: any) {
      toast({
        title: "Cancellation Failed",
        description: error?.message || "Could not cancel subscription.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Billing | Resumesensei"
        description="View plan status, manage subscription, and choose the best Resumesensei pricing."
      />
      <Navbar />

      <div className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Billing</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Manage your subscription and choose the right plan.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 text-primary shrink-0" />
              {isPremium ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>Current plan: Pro</span>
                  {isCancelledRenewal && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                      Cancels soon
                    </span>
                  )}
                </span>
              ) : (
                "Current plan: Free"
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <section className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Plan Status</h2>
          {!isPremium ? (
            <div>
              <p className="text-sm font-medium">You are on the Free plan.</p>
              <p className="text-sm text-muted-foreground">
                Upgrade below to unlock all templates, unlimited AI, ATS score tracking, and more.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold flex flex-wrap items-center gap-2">
                      Pro plan
                      {isCancelledRenewal ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                          Cancels soon
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800 dark:bg-green-950/60 dark:text-green-200">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {isCancelledRenewal
                        ? "Your subscription is cancelled and will not renew. You keep Pro access until the end of the current billing period."
                        : "Your account has full premium access."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end sm:min-w-[min(100%,12rem)]">
                  {isCancelledRenewal && subscriptionId ? (
                    <ResumeRenewalFlow triggerSize="default" triggerClassName="sm:min-w-[12rem]" />
                  ) : null}
                  {!isCancelledRenewal && subscriptionId ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelSubscription}
                      disabled={isCancelling}
                      className="w-full sm:w-auto"
                    >
                      {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {isCancelledRenewal && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] dark:bg-amber-950/25 px-4 py-3 sm:px-5 sm:py-4 text-sm"
                >
                  <p className="font-semibold text-amber-950 dark:text-amber-100">Changed your mind?</p>
                  <p className="text-muted-foreground mt-1 text-xs sm:text-sm leading-relaxed">
                    You can turn auto-renewal back on any time before this period ends — your saved resumes and Pro
                    features are not affected.
                  </p>
                </div>
              )}

              {detailsLoading ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading subscription details...
                </div>
              ) : detailsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium text-destructive">Could not load subscription details</p>
                  <p className="text-muted-foreground mt-1">Try again in a moment.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchSubscription()}>
                    Retry
                  </Button>
                </div>
              ) : subscriptionDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" /> Plan
                    </p>
                    <p className="mt-2 text-lg font-semibold capitalize">{subscriptionDetails.notes?.planType || "Monthly"}</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      {isCancelledRenewal ? (
                        <>
                          <AlertCircle className="h-3.5 w-3.5" /> Ends on
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="h-3.5 w-3.5" /> Renews on
                        </>
                      )}
                    </p>
                    <p
                      className={`mt-2 text-lg font-semibold ${isCancelledRenewal ? "text-orange-600 dark:text-orange-400" : ""}`}
                    >
                      {formatDate(subscriptionDetails.current_end)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Current cycle
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {formatDate(subscriptionDetails.current_start)} – {formatDate(subscriptionDetails.current_end)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section id="pricing" className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl font-semibold">Pricing Options</h2>
            <div className="bg-muted p-1 rounded-full inline-flex relative w-full sm:w-auto">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`relative z-10 flex-1 sm:flex-none px-5 py-2 text-sm font-semibold rounded-full transition-colors ${
                  billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`relative z-10 flex-1 sm:flex-none px-5 py-2 text-sm font-semibold rounded-full transition-colors ${
                  billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Yearly
              </button>
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background rounded-full shadow transition-transform duration-300 ${
                  billingCycle === "yearly" ? "translate-x-[calc(100%+4px)]" : "translate-x-1"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border bg-card p-6 flex flex-col">
              <h3 className="text-lg font-bold">Free</h3>
              <p className="text-sm text-muted-foreground mt-1">Best for trying out Resumesensei</p>
              <div className="mt-5">
                <span className="text-4xl font-black">₹0</span>
                <span className="text-muted-foreground"> / forever</span>
              </div>
              <ul className="space-y-3 mt-5 mb-6 flex-1">
                {FREE_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              {!isPremium && (
                <Button variant="outline" asChild className="w-full">
                  <Link href="/dashboard">Continue with Free</Link>
                </Button>
              )}
            </div>

            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 flex flex-col relative">
              <div className="absolute -top-3 left-4 rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-1 font-bold tracking-wide uppercase">
                Recommended
              </div>
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="text-sm text-muted-foreground mt-1">For serious job seekers</p>
              <div className="mt-5">
                <span className="text-4xl font-black">{billingCycle === "yearly" ? "₹999" : "₹99"}</span>
                <span className="text-muted-foreground">{billingCycle === "yearly" ? " / yearly" : " / monthly"}</span>
              </div>
              <ul className="space-y-3 mt-5 mb-6 flex-1">
                {PRO_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              {isPremium ? (
                <Button className="w-full" disabled>
                  <Check className="h-4 w-4 mr-1.5" />
                  You are on Pro
                </Button>
              ) : (
                <Button className="w-full" onClick={handleUpgrade} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : "Upgrade to Pro"}
                  {!isProcessing && <ArrowRight className="h-4 w-4 ml-1.5" />}
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Secure checkout via Razorpay
              </p>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />

      <SubscriptionSuccessDialog open={subscriptionSuccessOpen} onOpenChange={setSubscriptionSuccessOpen} />
    </div>
  );
}
