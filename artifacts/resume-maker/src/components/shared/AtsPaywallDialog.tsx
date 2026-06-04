import { Star, Zap, Target, Sparkles, ShieldCheck, Gauge } from "lucide-react";
import { useLocation } from "wouter";
import { ProButton } from "./ProButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface AtsPaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AtsPaywallDialog({
  open,
  onOpenChange,
}: AtsPaywallDialogProps) {
  const [, navigate] = useLocation();

  const features = [
    {
      icon: Gauge,
      title: "Real-time ATS Scoring",
      description: "Get a live compatibility score (0-100) instantly reflecting how well your resume matches parsing algorithms.",
      colorClass: "bg-violet-500/10 text-violet-500 dark:bg-violet-950/30 dark:text-violet-400",
      borderColor: "group-hover:border-violet-500/30",
    },
    {
      icon: Target,
      title: "Job-Specific Auditing",
      description: "Paste target job descriptions to analyze match rate and extract key keywords directly.",
      colorClass: "bg-blue-500/10 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400",
      borderColor: "group-hover:border-blue-500/30",
    },
    {
      icon: Sparkles,
      title: "One-Click AI Refinement",
      description: "Instantly tailor your experience and skills to the job description with automated writing assistance.",
      colorClass: "bg-pink-500/10 text-pink-500 dark:bg-pink-950/30 dark:text-pink-400",
      borderColor: "group-hover:border-pink-500/30",
    },
    {
      icon: ShieldCheck,
      title: "Formatting & Structure Audit",
      description: "Scan for layout errors, missing contact details, and hidden bugs that cause parser failures.",
      colorClass: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-400",
      borderColor: "group-hover:border-emerald-500/30",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-primary/20 bg-card overflow-hidden max-h-[90vh] flex flex-col p-0">
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-pink-500 to-blue-600 shrink-0" />

        {/* Scrollable Container for Content */}
        <div className="overflow-y-auto px-6 pt-6 pb-4 space-y-5">
          <DialogHeader className="space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center shadow-md animate-pulse">
              <Zap className="h-6 w-6 text-white fill-white" />
            </div>
            <DialogTitle className="text-center text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              Unlock AI ATS Auditor Pro
            </DialogTitle>
            <DialogDescription className="text-center text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Stop guessing. Let AI scan, score, and optimize your resume for your target roles directly in the editor.
            </DialogDescription>
          </DialogHeader>

          {/* Interactive Scan Preview Visual */}
          <div className="relative overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-pink-500/10 blur-xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
              {/* Animated Progress Ring */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    className="stroke-muted/40"
                    strokeWidth="6.5"
                    fill="transparent"
                  />
                  {open && (
                    <motion.circle
                      cx="40"
                      cy="40"
                      r="34"
                      className="stroke-violet-500"
                      strokeWidth="6.5"
                      strokeLinecap="round"
                      fill="transparent"
                      initial={{ strokeDasharray: 2 * Math.PI * 34, strokeDashoffset: 2 * Math.PI * 34 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - 88 / 100) }}
                      transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
                    />
                  )}
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.8 }}
                    className="text-xl font-extrabold text-foreground"
                  >
                    88
                  </motion.span>
                  <span className="text-[7.5px] uppercase tracking-wider text-muted-foreground font-black">Score</span>
                </div>
              </div>

              {/* Mock Details */}
              <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground">ATS Match Status</span>
                  <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20 self-center sm:self-auto">
                    Highly Compatible
                  </span>
                </div>
                <div className="h-px bg-border/60" />
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-0.5">
                    <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Critical Fixes</span>
                    <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                      0 Issues Left
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">AI Keywords</span>
                    <span className="text-xs font-bold text-violet-500 flex items-center gap-1">
                      12 Added
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {features.map((feat, idx) => {
              const IconComp = feat.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className={`group flex items-start gap-3 p-3 rounded-xl border border-border bg-card/60 transition-all hover:bg-muted/30 hover:shadow-sm ${feat.borderColor}`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${feat.colorClass} transition-transform group-hover:scale-105`}>
                    <IconComp className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground">
                      {feat.title}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {feat.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-col sm:flex-col gap-2 p-5 bg-muted/20 border-t border-border shrink-0">
          <ProButton
            className="w-full h-10 shadow-md"
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
            text="Upgrade to Pro"
            showIcon
          />
          <Button
            variant="ghost"
            className="w-full h-9 text-xs font-medium hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
