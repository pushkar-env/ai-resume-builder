import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Check, Star, Shield, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser, useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { SEO } from "@/components/shared/SEO";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "@/lib/plan-features";
import { useQueryClient } from "@tanstack/react-query";
import { SITE_URL } from "@/lib/brand";
import { SubscriptionSuccessDialog } from "@/components/shared/SubscriptionSuccessDialog";
import { DevBillingPanel } from "@/components/shared/DevBillingPanel";
import { openSubscriptionCheckout } from "@/lib/subscription-checkout";
import { useDevBillingUpgrade } from "@/hooks/use-dev-billing-upgrade";
import { ProBadge } from "@/components/shared/ProBadge";
import { ProButton } from "@/components/shared/ProButton";

export default function PricingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [subscriptionSuccessOpen, setSubscriptionSuccessOpen] = useState(false);
  const { runDevUpgrade } = useDevBillingUpgrade();

  const isPremium = user?.publicMetadata?.isPremium === true;

  const proCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (proCardRef.current) {
        proCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, []);

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
      console.error(error);
      const msg =
        error instanceof Error
          ? error.message
          : "Something went wrong during checkout.";
      toast({
        title: "Checkout Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDevUpgrade = async () => {
    setIsProcessing(true);
    try {
      await runDevUpgrade(() => setSubscriptionSuccessOpen(true));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Pricing | Resumesensei Pro"
        description="Simple pricing in INR. Free includes exports with a subtle brand footer; Pro adds watermark-free PDF & Word, unlimited resumes & cover letters, all templates, full AI, and ATS score tracking."
        canonicalUrl={`${SITE_URL}/pricing`}
      />
      <Navbar />

      <div className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-yellow-500/10 mb-4">
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Upgrade to Premium
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Unlock the full potential of Resumesensei. Pro removes export
            watermarks, unlocks every template, unlimited AI for resumes & cover letters, premium colors &
            fonts, and ATS score tracking.
          </p>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Value Propositions Micro-Grid */}
        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto mb-12">
          {/* Card 1: Whitelabel */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/20 p-5 flex flex-col items-start transition-all hover:bg-muted/30 hover:border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 mb-3.5">
              <Shield className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-1">100% Whitelabel</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Remove all watermarks and brand footprints to secure complete ownership of your narrative.
            </p>
          </div>

          {/* Card 2: ATS Auditor */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/20 p-5 flex flex-col items-start transition-all hover:bg-muted/30 hover:border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 mb-3.5">
              <Sparkles className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-1">ATS Optimized</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Leverage the integrated AI ATS Auditor to align formatting and text with recruitment systems.
            </p>
          </div>

          {/* Card 3: Recruiter Ready */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/20 p-5 flex flex-col items-start transition-all hover:bg-muted/30 hover:border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-3.5">
              <Check className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-1">Recruiter Ready</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Deploy unlimited polished, high-converting resumes and cover letters styled to win interviews.
            </p>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-muted p-1 rounded-full inline-flex relative">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-full transition-colors ${
                billingCycle === "monthly"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-full transition-colors ${
                billingCycle === "yearly"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
            </button>
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background rounded-full shadow transition-transform duration-300 ease-in-out ${
                billingCycle === "yearly"
                  ? "translate-x-[calc(100%+4px)]"
                  : "translate-x-1"
              }`}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col h-full justify-between">
            <div className="flex flex-col flex-grow">
              <h3 className="text-xl font-bold mb-2">Free Plan</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Perfect for getting started
              </p>
              <div className="mb-6">
                <span className="text-4xl font-black">₹0</span>
                <span className="text-muted-foreground"> / forever</span>
              </div>
              <ul className="space-y-4 mb-8 flex-grow">
                {FREE_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {isPremium ? (
                <Button
                  variant="outline"
                  className="w-full h-11 text-base"
                  disabled
                >
                  Free Plan
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-11 text-base shadow-sm"
                    asChild
                  >
                    <Link href="/dashboard">Continue with Free</Link>
                  </Button>
                  <p className="text-center text-sm font-medium text-muted-foreground mt-2">
                    Free forever. No credit card required.
                  </p>
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5 opacity-0 pointer-events-none select-none">
                <Shield className="h-3 w-3" /> Secure checkout spacer
              </p>
            </div>
          </div>

          {/* Pro Plan */}
          <div
            ref={proCardRef}
            className="rounded-3xl border-2 border-primary bg-primary/5 p-8 shadow-xl relative flex flex-col h-full justify-between"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-md">
              Most Popular
            </div>
            <div className="flex flex-col flex-grow">
              <div className="mb-2">
                <ProBadge size="lg" />
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                For serious job seekers
              </p>
              <div className="mb-6">
                <span className="text-4xl font-black text-foreground">
                  {billingCycle === "yearly" ? "₹999" : "₹99"}
                </span>
                <span className="text-muted-foreground">
                  {billingCycle === "yearly" ? " / yearly" : " / monthly"}
                </span>
              </div>
              <ul className="space-y-4 mb-8 flex-grow">
                {PRO_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {isPremium ? (
                <Button
                  className="w-full h-11 text-base bg-green-600 hover:bg-green-700 text-white gap-2"
                  disabled
                >
                  <Check className="h-4 w-4" />
                  You are on Pro!
                </Button>
              ) : (
                <div className="space-y-3">
                  <ProButton
                    effect="sleek"
                    className="w-full h-11 text-base shadow-lg"
                    onClick={handleUpgrade}
                    disabled={isProcessing}
                    text={isProcessing ? "Processing..." : "Upgrade to Pro"}
                    showIcon={!isProcessing}
                  />
                  <p className="text-center text-sm font-medium text-muted-foreground mt-2">
                    Cancel anytime. No hidden fees.
                  </p>
                </div>
              )}

              <DevBillingPanel
                isPremium={isPremium}
                isProcessing={isProcessing}
                onDevUpgrade={() => void handleDevUpgrade()}
              />

              <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                <Shield className="h-3 w-3" /> Secure checkout via Razorpay
                (UPI, Cards, Netbanking)
              </p>
            </div>
          </div>
        </div>
      </main>

      <SubscriptionSuccessDialog
        open={subscriptionSuccessOpen}
        onOpenChange={setSubscriptionSuccessOpen}
      />
    </div>
  );
}
