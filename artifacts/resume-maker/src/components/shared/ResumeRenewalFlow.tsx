import { useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { resumeSubscriptionRenewal } from "@/lib/resume-subscription";
import { cn } from "@/lib/utils";

type ResumeRenewalFlowProps = {
  /** Optional class on the trigger button */
  triggerClassName?: string;
  /** Visually de-emphasize trigger (e.g. in dense settings cards) */
  triggerVariant?: "default" | "outline";
  triggerSize?: "default" | "sm" | "lg";
  disabled?: boolean;
};

/**
 * Lets a Pro user re-enable Razorpay auto-renewal after they cancelled at period end (Clerk `subscriptionStatus: cancelled`).
 */
export function ResumeRenewalFlow({
  triggerClassName,
  triggerVariant = "default",
  triggerSize = "sm",
  disabled = false,
}: ResumeRenewalFlowProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await resumeSubscriptionRenewal(getToken);
      if (!result.ok) {
        toast({
          title: "Could not resume renewal",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      await user?.reload();
      await queryClient.invalidateQueries({
        queryKey: ["billing-page-subscription"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["subscription-details"],
      });
      setOpen(false);
      toast({
        title: "Auto-renewal is back on",
        description:
          "Your Pro plan will renew at the end of each billing period unless you cancel again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        disabled={disabled}
        className={cn("w-full sm:w-auto gap-2", triggerClassName)}
        onClick={() => setOpen(true)}
      >
        <Undo2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="whitespace-normal text-center sm:whitespace-nowrap">
          Keep Pro — resume renewal
        </span>
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Resume auto-renewal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground text-left space-y-2">
                <p>
                  Your Pro access stays the same until the end of this billing
                  period. We will turn auto-renewal back on with your payment
                  provider so the plan continues after that date.
                </p>
                <p className="text-xs sm:text-sm">
                  If renewal cannot be completed (for example the billing period
                  already ended), you can subscribe again from the pricing
                  section.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              disabled={busy}
              className="mt-0 w-full sm:w-auto"
            >
              Not now
            </AlertDialogCancel>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                  Working…
                </>
              ) : (
                "Yes, keep my subscription"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
