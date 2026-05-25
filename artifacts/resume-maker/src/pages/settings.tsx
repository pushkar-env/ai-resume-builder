import { UserProfile, useUser, useAuth } from "@clerk/react";
import { Navbar } from "@/components/layout/Navbar";
import { ResumeRenewalFlow } from "@/components/shared/ResumeRenewalFlow";
import { Settings as SettingsIcon, CreditCard, CheckCircle2, AlertCircle, Calendar, RefreshCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProBadge } from "@/components/shared/ProBadge";
import { ProButton } from "@/components/shared/ProButton";

function BillingSection() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);

  const isPremium = user?.publicMetadata?.isPremium === true;
  const subscriptionId = user?.publicMetadata?.subscriptionId as string | undefined;
  const subscriptionStatus = user?.publicMetadata?.subscriptionStatus as string | undefined;

  type SubscriptionPayload = {
    notes?: { planType?: string };
    current_start?: number;
    current_end?: number;
    clerkSubscriptionStatus?: string | null;
    short_url?: string;
  };

  const { data: subscriptionDetails, isLoading: detailsLoading, isError: detailsError, refetch: refetchSubscription } = useQuery({
    queryKey: ["subscription-details", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/subscription`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json() as SubscriptionPayload;
    },
    enabled: !!subscriptionId && isPremium,
    staleTime: 0,
  });

  const isCancelledRenewal =
    subscriptionStatus === "cancelled" ||
    subscriptionDetails?.clerkSubscriptionStatus === "cancelled";

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const handleDevDowngrade = async () => {
    setIsDowngrading(true);
    try {
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/dev-downgrade`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to downgrade");
      await user?.reload();
      toast({ title: "Dev Reset Successful", description: "You are now on the Free Plan." });
    } catch (e: any) {
      toast({ title: "Dev Reset Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsDowngrading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your premium subscription? You will lose access at the end of your billing cycle.")) return;
    
    setIsCancelling(true);
    try {
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/cancel-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ subscriptionId })
      });

      if (!res.ok) {
        throw new Error("Failed to cancel subscription");
      }

      await user?.reload();
      await queryClient.invalidateQueries({ queryKey: ["billing-page-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-details"] });
      toast({ title: "Subscription Cancelled", description: "Your subscription has been cancelled and will not renew." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Cancellation Failed", description: e.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };



  return (
    <div className="w-full p-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Billing & Subscription</h2>
          <p className="text-sm text-muted-foreground">Manage your premium plan</p>
        </div>
      </div>

      {!isPremium ? (
        <div className="bg-muted/50 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-border/50">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              Free Plan
            </h3>
            <p className="text-sm text-muted-foreground mt-1">You are currently on the free plan.</p>
          </div>
          <Link href="/pricing" className="w-full sm:w-auto">
            <ProButton className="w-full" text="Upgrade to Pro" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header & Actions */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <ProBadge size="default" /> Plan
                  {isCancelledRenewal ? (
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Cancels Soon</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isCancelledRenewal
                    ? "Your subscription is cancelled and will not renew."
                    : "You have full access to all premium features."}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-stretch sm:items-end gap-3 w-full sm:w-auto">
              {subscriptionId && isCancelledRenewal && (
                <div className="w-full sm:w-auto">
                  <ResumeRenewalFlow triggerClassName="w-full sm:min-w-[11rem]" />
                </div>
              )}
              {subscriptionId && !isCancelledRenewal && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button 
                    variant="destructive" 
                    onClick={handleCancel}
                    disabled={isCancelling}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                </div>
              )}
              
              {import.meta.env.DEV && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={handleDevDowngrade}
                  disabled={isDowngrading}
                >
                  {isDowngrading ? "[Dev] Resetting..." : "[Dev] Reset to Free Plan"}
                </Button>
              )}
            </div>
          </div>

          {/* Detailed Subscription Info Grid */}
          {detailsLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground bg-card rounded-xl border border-border shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading subscription details...
            </div>
          ) : detailsError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
              <p className="font-medium text-destructive">Could not load subscription details</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchSubscription()}>
                Retry
              </Button>
            </div>
          ) : subscriptionDetails ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/20 transition-colors">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Plan Type
                </p>
                <p className="font-bold text-xl capitalize mt-2 text-foreground">
                  {subscriptionDetails.notes?.planType || "Monthly"}
                </p>
              </div>
              
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/20 transition-colors">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-1.5">
                  {isCancelledRenewal ? (
                    <><AlertCircle className="h-3.5 w-3.5" /> Ends On</>
                  ) : (
                    <><RefreshCcw className="h-3.5 w-3.5" /> Renews On</>
                  )}
                </p>
                <p className={`font-bold text-xl mt-2 ${isCancelledRenewal ? "text-orange-600" : "text-foreground"}`}>
                  {subscriptionDetails.current_end ? formatDate(subscriptionDetails.current_end) : "Unknown"}
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/20 transition-colors">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Current Cycle
                </p>
                <div className="mt-2 text-sm font-medium text-foreground">
                  <div>{subscriptionDetails.current_start ? formatDate(subscriptionDetails.current_start) : "?"}</div>
                  <div className="text-muted-foreground text-xs my-0.5">to</div>
                  <div>{subscriptionDetails.current_end ? formatDate(subscriptionDetails.current_end) : "?"}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <SettingsIcon className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-10">
            Manage your account security, profile information, and billing.
          </p>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex justify-center">
        <div className="w-full max-w-4xl">
          <UserProfile 
            path={`${basePath}/settings`}
            routing="path"
            appearance={{
              elements: {
                rootBox: "w-full max-w-none shadow-none",
                cardBox: "w-full shadow-sm border border-border bg-card rounded-xl",
              }
            }}
          >
            <UserProfile.Page label="Billing" labelIcon={<CreditCard className="h-4 w-4" />} url="billing">
              <BillingSection />
            </UserProfile.Page>
          </UserProfile>
        </div>
      </main>
    </div>
  );
}
