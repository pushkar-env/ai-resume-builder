import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDevBillingUiEnabled } from "@/lib/dev-billing";

type DevBillingPanelProps = {
  isPremium: boolean;
  isProcessing?: boolean;
  onDevUpgrade: () => void;
  className?: string;
};

export function DevBillingPanel({
  isPremium,
  isProcessing = false,
  onDevUpgrade,
  className = "",
}: DevBillingPanelProps) {
  if (!isDevBillingUiEnabled()) return null;

  return (
    <div
      className={`mt-3 space-y-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 ${className}`}
      data-testid="dev-billing-panel"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5" />
        Local dev billing
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full border-amber-500/30 bg-background/80 text-sm text-amber-900 hover:bg-amber-500/10 dark:text-amber-100"
        onClick={onDevUpgrade}
        disabled={isProcessing}
      >
        {isProcessing
          ? "[Dev] Working..."
          : isPremium
            ? "[Dev] Re-trigger Pro upgrade + welcome email"
            : "[Dev] Bypass Payment"}
      </Button>
      {isPremium ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Reset to Free under Settings → Billing to test cancel/resume emails.
        </p>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          Skips Razorpay and upgrades your Clerk account instantly.
        </p>
      )}
    </div>
  );
}
