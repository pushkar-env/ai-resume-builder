import { Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ProBadgeProps {
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function ProBadge({ className, size = "default" }: ProBadgeProps) {
  // Sizing definitions
  const sizes = {
    sm: "h-5 text-[10px] px-2 gap-1",
    default: "h-6 text-xs px-2.5 gap-1.5",
    lg: "h-7 text-sm px-3 gap-1.5",
  };
  
  const iconSizes = {
    sm: "h-2.5 w-2.5",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <div className={cn("relative group inline-flex", className)}>
      {/* Background glow (intensifies on hover) */}
      <div className="absolute inset-0 bg-violet-500 rounded-full blur-[6px] opacity-60 group-hover:opacity-100 group-hover:blur-[8px] transition-all duration-300"></div>
      
      {/* The badge itself */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Badge
          className={cn(
            "relative text-white border border-white/20 shadow-md backdrop-blur-md font-bold overflow-hidden cursor-default hover:bg-violet-500/80 transition-colors",
            "bg-gradient-to-r from-violet-600/90 via-purple-500/90 to-fuchsia-500/90",
            sizes[size]
          )}
          style={{
            // Metallic shimmer effect overlaying the background
            backgroundImage: "linear-gradient(to right, rgba(139, 92, 246, 0.9) 0%, rgba(168, 85, 247, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%), linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)",
            backgroundSize: "100% 100%, 200% 100%",
            backgroundBlendMode: "overlay"
          }}
        >
          {/* Shimmer animation element */}
          <div className="absolute inset-0 z-0 bg-[linear-gradient(110deg,transparent,45%,rgba(255,255,255,0.4),55%,transparent)] bg-[length:200%_100%] animate-shimmer pointer-events-none" />
          
          <Sparkles className={cn("relative z-10", iconSizes[size])} />
          <span className="relative z-10 tracking-wide">PRO</span>
        </Badge>
      </motion.div>
    </div>
  );
}
