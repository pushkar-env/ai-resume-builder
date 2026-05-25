import { Button, ButtonProps } from "../ui/button";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import React from "react";

interface ProButtonProps extends Omit<ButtonProps, "asChild"> {
  showIcon?: boolean;
  text?: React.ReactNode;
  effect?: "shimmer" | "sleek";
}

export const ProButton = React.forwardRef<HTMLButtonElement, ProButtonProps>(
  ({ className, showIcon = true, text = "Go Pro", effect = "shimmer", children, ...props }, ref) => {
    
    const isSleek = effect === "sleek";

    return (
      <Button
        ref={ref}
        className={cn(
          "relative overflow-hidden font-semibold transition-all shadow-md hover:shadow-lg border-0 text-white",
          "hover:-translate-y-[1px] active:translate-y-[1px] active:scale-[0.98]",
          isSleek ? "bg-gradient-to-r from-violet-500 via-pink-500 to-blue-500 hover:from-violet-400 hover:via-pink-400 hover:to-blue-400" : "bg-gradient-to-r from-violet-600 via-pink-500 to-blue-600 hover:from-violet-500 hover:via-pink-400 hover:to-blue-500",
          className
        )}
        style={!isSleek ? {
          backgroundImage: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #2563eb 100%)",
          backgroundSize: "200% 100%",
        } : undefined}
        {...props}
      >
        {!isSleek && (
          <div className="absolute inset-0 z-0 bg-[linear-gradient(110deg,transparent,45%,rgba(255,255,255,0.4),55%,transparent)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />
        )}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {showIcon && <Zap className="h-4 w-4 fill-white" />}
          {text || children}
        </div>
      </Button>
    );
  }
);

ProButton.displayName = "ProButton";
