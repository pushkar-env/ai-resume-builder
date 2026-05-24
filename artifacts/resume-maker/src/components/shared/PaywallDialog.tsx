import { Star, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function PaywallDialog({
  open,
  onOpenChange,
  title = "Premium Feature",
  description = "This feature is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, premium colors & custom fonts, and more."
}: PaywallDialogProps) {
  const [, navigate] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/20 bg-card overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
        <DialogHeader className="pt-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Star className="h-6 w-6 text-primary fill-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2 mt-4">
          <Button 
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-2 shadow-md" 
            onClick={() => navigate("/pricing")}
          >
            <Zap className="h-4 w-4 fill-white" /> Upgrade to Pro
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
