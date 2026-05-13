import { Sparkles, Star, LayoutDashboard, CreditCard } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SubscriptionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionSuccessDialog({ open, onOpenChange }: SubscriptionSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(100%,28rem)] max-h-[min(90dvh,640px)] overflow-y-auto border-primary/20 bg-card p-0 gap-0 shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-800 px-6 pt-10 pb-8 text-center text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/25">
            <Star className="h-8 w-8 text-amber-200 fill-amber-200" aria-hidden />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Welcome to Pro</p>
          <DialogTitle className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Congratulations
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-white/90 sm:text-base">
            Your subscription is active. Every premium feature is now unlocked on this account.
          </DialogDescription>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden />
              <span>Unlimited AI writing, premium templates, and ATS score tracking are ready to use.</span>
            </li>
            <li className="flex gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden />
              <span>Manage billing or cancel anytime from Settings → Billing or the Billing page.</span>
            </li>
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-col">
          <Button className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md" asChild>
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center gap-2"
              onClick={() => onOpenChange(false)}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              Go to dashboard
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link
              href="/billing"
              className="flex w-full items-center justify-center gap-2"
              onClick={() => onOpenChange(false)}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              View billing
            </Link>
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
