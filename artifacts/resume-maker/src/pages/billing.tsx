import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCcw,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { AppFooter } from "@/components/layout/AppFooter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/shared/SEO";

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

function formatDate(timestamp?: number) {
  if (!timestamp) return "Unknown";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BillingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [isCancelling, setIsCancelling] = useState(false);

  const isPremium = user?.publicMetadata?.isPremium === true;
  const subscriptionId = user?.publicMetadata?.subscriptionId as string | undefined;
  const subscriptionStatus = user?.publicMetadata?.subscriptionStatus as string | undefined;

  const { data: subscriptionDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["billing-page-subscription", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch subscription details");
      return res.json();
    },
    enabled: !!subscriptionId && isPremium,
  });

  const handleUpgrade = async () => {
    if (!user) {
      setLocation("/sign-in");
      return;
    }

    setIsProcessing(true);
    try {
      const ready = await loadRazorpayScript();
      if (!ready) {
        toast({ title: "Failed to load payment gateway", variant: "destructive" });
        return;
      }

      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const subRes = await fetch(`${apiUrl}/payments/create-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planType: billingCycle }),
      });

      if (!subRes.ok) {
        throw new Error("Failed to create subscription");
      }

      const subscriptionData = await subRes.json();
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_mock",
        name: "ResumeSensei",
        description: `Pro ${billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`,
        image: `${import.meta.env.BASE_URL}bluemascot.svg`,
        subscription_id: subscriptionData.id,
        handler: async () => {
          toast({
            title: "Payment Successful",
            description: "Refreshing your plan status...",
            duration: 7000,
          });
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const updatedUser = await user.reload();
            if (updatedUser?.publicMetadata?.isPremium) {
              toast({
                title: "Welcome to Pro",
                description: "Your billing status is now active.",
              });
              return;
            }
          }
          toast({
            title: "Upgrade Processing",
            description: "Payment completed. Status may take up to a minute to reflect.",
          });
        },
        prefill: {
          name: user.fullName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
        },
        theme: { color: "#4f46e5" },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on("payment.failed", (response: any) => {
        toast({
          title: "Payment Failed",
          description: response?.error?.description || "Your payment could not be completed.",
          variant: "destructive",
        });
      });
      paymentObject.open();
    } catch (error: any) {
      toast({
        title: "Checkout Error",
        description: error?.message || "Something went wrong during checkout.",
        variant: "destructive",
      });
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
        title="Billing | ResumeSensei"
        description="View plan status, manage subscription, and choose the best ResumeSensei pricing."
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
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 text-primary" />
              {isPremium ? "Current plan: Pro" : "Current plan: Free"}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <section className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Plan Status</h2>
          {!isPremium ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">You are on the Free plan.</p>
                <p className="text-sm text-muted-foreground">Upgrade to unlock all templates and unlimited AI features.</p>
              </div>
              <Button asChild className="sm:w-auto w-full">
                <Link href="#pricing">View Pricing</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Pro plan is active</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {subscriptionStatus === "cancelled"
                        ? "Auto-renew is off. Your access remains active until cycle end."
                        : "Your account has full premium access."}
                    </p>
                  </div>
                </div>
                {subscriptionStatus !== "cancelled" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelSubscription}
                    disabled={isCancelling}
                    className="w-full sm:w-auto"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                )}
              </div>

              {detailsLoading ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading subscription details...
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
                      <RefreshCcw className="h-3.5 w-3.5" /> Cycle End
                    </p>
                    <p className="mt-2 text-lg font-semibold">{formatDate(subscriptionDetails.current_end)}</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Current Cycle
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {formatDate(subscriptionDetails.current_start)} - {formatDate(subscriptionDetails.current_end)}
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
              <p className="text-sm text-muted-foreground mt-1">Best for trying out ResumeSensei</p>
              <div className="mt-5">
                <span className="text-4xl font-black">₹0</span>
                <span className="text-muted-foreground"> / forever</span>
              </div>
              <ul className="space-y-3 mt-5 mb-6 flex-1">
                {["1 Active Resume", "3 Basic Templates", "Basic AI Suggestions", "Standard Export"].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard">Continue with Free</Link>
              </Button>
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
                {[
                  "Unlimited resumes",
                  "All premium templates",
                  "Unlimited AI writing",
                  "Advanced ATS export and scoring",
                ].map((feature) => (
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
    </div>
  );
}
