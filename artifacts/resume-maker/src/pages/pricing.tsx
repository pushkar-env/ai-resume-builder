import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Check, Star, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser, useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { SEO } from "@/components/shared/SEO";

// Helper function to load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PricingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const isPremium = user?.publicMetadata?.isPremium === true;

  const handleUpgrade = async () => {
    if (!user) {
      setLocation("/sign-in");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Load Razorpay script
      const res = await loadRazorpayScript();
      if (!res) {
        toast({ title: "Failed to load payment gateway", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      // 2. Fetch Subscription from our backend
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      
      const subRes = await fetch(`${apiUrl}/payments/create-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ planType: billingCycle })
      });

      if (!subRes.ok) {
        throw new Error("Failed to create subscription");
      }

      const subscriptionData = await subRes.json();

      // 3. Open Razorpay Checkout for Subscription
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_mock", 
        name: "ResumeSensei",
        description: `Pro ${billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`,
        image: `${import.meta.env.BASE_URL}bluemascot.svg`,
        subscription_id: subscriptionData.id,
        handler: async function (response: any) {
          toast({ 
            title: "Payment Successful!", 
            description: "Upgrading your account... Please wait.",
            duration: 10000,
          });
          
          // Poll for updated user data since the webhook takes a moment to process
          let isUpgraded = false;
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
            const updatedUser = await user.reload();
            if (updatedUser?.publicMetadata?.isPremium) {
              isUpgraded = true;
              break;
            }
          }

          if (isUpgraded) {
            toast({ 
              title: "Welcome to Pro! 🎉", 
              description: "All premium features are now unlocked." 
            });
          } else {
            toast({ 
              title: "Upgrade Processing", 
              description: "Your payment was successful. The upgrade might take a minute to reflect. Please refresh the page shortly." 
            });
          }
        },
        prefill: {
          name: user.fullName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
        },
        theme: {
          color: "#4f46e5" // primary
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', function (response: any){
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      paymentObject.open();

    } catch (error) {
      console.error(error);
      toast({ title: "Checkout Error", description: "Something went wrong during checkout.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Development bypass (in case test keys aren't working perfectly)
  const handleDevUpgrade = async () => {
    setIsProcessing(true);
    try {
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/dev-upgrade`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to upgrade");
      }
      await user?.reload();
      toast({ title: "Dev Upgrade Successful! 🎉" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Upgrade Error", description: e.message || "Failed to upgrade", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Pricing | ResumeSensei Pro"
        description="Simple, transparent pricing. Upgrade to ResumeSensei Pro for unlimited AI writing, premium templates, and ATS scoring."
        canonicalUrl="https://resumesensei.com/pricing"
      />
      <Navbar />

      <div className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-yellow-500/10 mb-4">
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Upgrade to Premium</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Unlock the full potential of ResumeSensei. Access premium templates, unlimited AI features, and land your dream job faster.
          </p>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-muted p-1 rounded-full inline-flex relative">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-full transition-colors ${
                billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-full transition-colors ${
                billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
            </button>
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background rounded-full shadow transition-transform duration-300 ease-in-out ${
                billingCycle === "yearly" ? "translate-x-[calc(100%+4px)]" : "translate-x-1"
              }`}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Free Plan */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col">
            <h3 className="text-xl font-bold mb-2">Free Plan</h3>
            <p className="text-muted-foreground text-sm mb-6">Perfect for getting started</p>
            <div className="mb-6">
              <span className="text-4xl font-black">₹0</span>
              <span className="text-muted-foreground"> / forever</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                "1 Active Resume",
                "3 Basic Templates",
                "PDF Export (Standard)",
                "Basic AI Suggestions",
                "Community Support"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard">Continue with Free</Link>
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="rounded-3xl border-2 border-primary bg-primary/5 p-8 shadow-xl relative flex flex-col transform md:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-md">
              Most Popular
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Pro</h3>
            <p className="text-muted-foreground text-sm mb-6">For serious job seekers</p>
            <div className="mb-6">
              <span className="text-4xl font-black text-foreground">
                {billingCycle === "yearly" ? "₹999" : "₹99"}
              </span>
              <span className="text-muted-foreground">
                {billingCycle === "yearly" ? " / yearly" : " / monthly"}
              </span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                <span key={1}><b>Unlimited</b> Resumes</span>,
                <span key={2}><b>All 12 Premium</b> Templates</span>,
                "Advanced ATS Vector Export",
                <span key={3}><b>Unlimited</b> AI Writing & Rewriting</span>,
                "ATS Score Tracking",
                "Priority Email Support"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
            
            {isPremium ? (
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2" disabled>
                <Check className="h-4 w-4" />
                You are on Pro!
              </Button>
            ) : (
              <div className="space-y-3">
                <Button 
                  className="w-full gap-2 shadow-lg hover:shadow-xl transition-all" 
                  size="lg"
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Upgrade to Pro"}
                  {!isProcessing && <ArrowRight className="h-4 w-4" />}
                </Button>
                
                {/* Safe fallback for testing without keys */}
                {import.meta.env.DEV && (
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={handleDevUpgrade}>
                    [Dev] Bypass Payment
                  </Button>
                )}
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <Shield className="h-3 w-3" /> Secure checkout via Razorpay (UPI, Cards, Netbanking)
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
