import { useState, useEffect } from "react";
import { Sparkles, Star, LayoutDashboard, CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SubscriptionStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "verifying" | "success";
}

export function SubscriptionStatusDialog({
  open,
  onOpenChange,
  status,
}: SubscriptionStatusDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  // Safety valve: the verifying state is non-dismissible at first (so an
  // accidental tap can't abort a payment), but we must NEVER trap the user.
  // After a grace period we surface an explicit escape hatch and allow the
  // dialog to close — covers slow webhooks / mobile timer throttling where Pro
  // confirmation may stall after returning from a UPI app.
  const [canDismiss, setCanDismiss] = useState(false);

  // Animate verification steps for a premium look
  useEffect(() => {
    if (!open || status !== "verifying") {
      setActiveStep(0);
      setCanDismiss(false);
      return;
    }
    const timer1 = setTimeout(() => setActiveStep(1), 1800);
    const timer2 = setTimeout(() => setActiveStep(2), 3500);
    const dismissTimer = setTimeout(() => setCanDismiss(true), 18000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(dismissTimer);
    };
  }, [open, status]);

  // Create an array of decorative particles for the celebration explosion
  const sparkles = Array.from({ length: 16 }).map((_, i) => ({
    id: i,
    angle: (i * 360) / 16 + (Math.random() * 15 - 7.5),
    delay: (i % 4) * 0.08,
    distance: 70 + Math.random() * 50,
    size: 6 + Math.random() * 8,
  }));

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // While verifying, block accidental dismissal until the grace period
      // elapses — but always allow closing afterwards so the user is never stuck.
      if (status === "verifying" && !val && !canDismiss) return;
      onOpenChange(val);
    }}>
      <DialogContent
        // Suppress the built-in ✕ / Escape / overlay close while we are still
        // genuinely confirming, so taps don't silently fail. Re-enabled by the
        // grace timer and surfaced via an explicit "Close" button below.
        showClose={status !== "verifying" || canDismiss}
        onEscapeKeyDown={(e) => {
          if (status === "verifying" && !canDismiss) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (status === "verifying" && !canDismiss) e.preventDefault();
        }}
        className="sm:max-w-[min(100%,28rem)] max-h-[min(90dvh,640px)] border-primary/20 bg-card p-0 gap-0 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
      >
        <AnimatePresence mode="wait">
          {status === "verifying" ? (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center px-6 py-12 text-center"
            >
              {/* Premium Rotating/Glowing Ring */}
              <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
                {/* Glowing Background Blur */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 opacity-20 blur-xl animate-pulse" />
                
                {/* Outer Rotating Gradient Border */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-r-cyan-400 border-b-violet-500"
                />

                {/* Inner Pulsing Circle */}
                <motion.div
                  animate={{ scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="relative flex h-18 w-18 items-center justify-center rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500"
                >
                  <CreditCard className="h-8 w-8" />
                </motion.div>
              </div>

              <DialogTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Confirming Payment
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground max-w-xs">
                We are securing your subscription with the payment gateway. Please do not close or refresh this tab.
              </DialogDescription>

              {/* Status Verification Steps */}
              <div className="mt-8 w-full max-w-xs space-y-4 text-left">
                {[
                  "Secure authorization received",
                  "Verifying digital signature",
                  "Activating Pro workspace",
                ].map((step, idx) => {
                  const isCompleted = idx < activeStep;
                  const isCurrent = idx === activeStep;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="rounded-full bg-green-500 p-0.5"
                          >
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.div>
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/35" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        isCompleted ? "text-muted-foreground line-through opacity-70" : isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Escape hatch — appears only if confirmation is taking unusually
                  long (slow bank/webhook). Pro still activates in the background;
                  this just frees the user from a blocking modal. */}
              {canDismiss && (
                <div className="mt-8 w-full max-w-xs border-t border-border/50 pt-5 text-center">
                  <p className="text-xs text-muted-foreground">
                    Taking longer than usual? Your payment is safe — Pro will
                    appear automatically once your bank confirms.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-xs font-semibold"
                    onClick={() => onOpenChange(false)}
                  >
                    Close and keep waiting in the background
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.25 }}
              className="flex flex-col min-h-0"
            >
              {/* Scrollable content area */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {/* Header Gradient Block */}
                <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-800 px-6 pt-10 pb-8 text-center text-white">
                  {/* Visual Glow Spots */}
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />
                  
                  {/* Explosive Sparkles */}
                  <div className="absolute left-1/2 top-20 pointer-events-none">
                    {sparkles.map((sparkle) => (
                      <motion.div
                        key={sparkle.id}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                        animate={{
                          scale: [0, 1.2, 0.8, 0],
                          x: Math.cos((sparkle.angle * Math.PI) / 180) * sparkle.distance,
                          y: Math.sin((sparkle.angle * Math.PI) / 180) * sparkle.distance,
                          opacity: [1, 1, 0.6, 0],
                        }}
                        transition={{
                          duration: 1.4,
                          delay: sparkle.delay,
                          ease: "easeOut",
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 text-amber-200 fill-amber-200"
                      >
                        <Star size={sparkle.size} />
                      </motion.div>
                    ))}
                  </div>

                  {/* Animated Star Shield Badge */}
                  <motion.div
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 0.15, stiffness: 150 }}
                    className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-xl ring-1 ring-white/30 backdrop-blur-sm"
                  >
                    <ShieldCheck
                      className="h-8 w-8 text-amber-300 fill-amber-300/10 drop-shadow-[0_2px_8px_rgba(253,230,138,0.3)] animate-pulse"
                      aria-hidden
                    />
                  </motion.div>
                  
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                    Welcome to Pro
                  </p>
                  <DialogTitle className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    Congratulations!
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm text-white/90 max-w-sm mx-auto sm:text-base">
                    Your subscription is active. Every premium feature is now unlocked on this account.
                  </DialogDescription>
                </div>

                {/* Feature Highlights */}
                <div className="px-6 py-5 bg-card">
                  <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4 space-y-3">
                    <div className="flex gap-3 text-sm">
                      <Sparkles
                        className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5"
                        aria-hidden
                      />
                      <span className="text-foreground/90 font-medium text-[13px] leading-relaxed">
                        Unlimited AI writing, premium templates, custom styling options, and ATS score tracking are now available.
                      </span>
                    </div>
                    <div className="flex gap-3 text-sm border-t border-border/50 pt-3">
                      <ShieldCheck
                        className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5"
                        aria-hidden
                      />
                      <span className="text-foreground/90 font-medium text-[13px] leading-relaxed">
                        Manage billing, download receipts, or cancel auto-renewal anytime from Settings &rarr; Billing.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer — pinned at bottom, never clips */}
              <div className="shrink-0 flex flex-col gap-3 border-t border-border/50 bg-muted/20 px-6 py-5">
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:via-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all duration-300 h-11 font-semibold rounded-lg"
                  asChild
                >
                  <Link
                    href="/dashboard"
                    className="flex w-full items-center justify-center gap-2"
                    onClick={() => onOpenChange(false)}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    Go to dashboard
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full gap-2 border-border/60 hover:bg-muted/80 h-11 font-semibold text-foreground/80 hover:text-foreground rounded-lg" 
                  asChild
                >
                  <Link
                    href="/billing"
                    className="flex w-full items-center justify-center gap-2"
                    onClick={() => onOpenChange(false)}
                  >
                    <CreditCard className="h-4 w-4 shrink-0" />
                    View billing details
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
