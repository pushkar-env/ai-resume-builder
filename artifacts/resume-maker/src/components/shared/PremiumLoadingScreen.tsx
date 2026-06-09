import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Pen, File } from "lucide-react";

let hasPlayedLoadingIntro = false;

export function PremiumLoadingScreen({
  title = "Loading...",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const shouldPlayIntro = useRef(!hasPlayedLoadingIntro);

  useEffect(() => {
    hasPlayedLoadingIntro = true;
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={shouldPlayIntro.current ? { opacity: 0 } : { opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
    >
      <div className="relative flex flex-col items-center">
        {/* Animated Icon Group */}
        <div className="relative mb-10 flex items-center justify-center">
          <motion.div
            initial={
              shouldPlayIntro.current ? { opacity: 0, scale: 0.8 } : false
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {/* Blank Document Background */}
            <File className="w-24 h-28 text-muted-foreground/20 stroke-[1]" />

            {/* Writing Lines inside the document */}
            <div className="absolute top-9 left-6 right-6 space-y-3">
              <motion.div
                className="h-1.5 bg-primary/25 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: ["0%", "55%", "0%"] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="h-1.5 bg-primary/25 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: ["0%", "70%", "0%"] }}
                transition={{
                  duration: 1.2,
                  delay: 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="h-1.5 bg-primary/25 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: ["0%", "85%", "0%"] }}
                transition={{
                  duration: 1.2,
                  delay: 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* Bobbing/Writing Pencil */}
            <motion.div
              className="absolute -right-6 -bottom-4 text-primary"
              animate={{
                x: [0, 15, -5, 10, 0],
                y: [0, -8, 4, -4, 0],
                rotate: [-10, 10, -5, 8, -10],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Pen className="w-12 h-12 drop-shadow-xl" />
            </motion.div>
          </motion.div>
        </div>

        {/* Text */}
        <motion.div
          initial={shouldPlayIntro.current ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-2 font-medium">
              {subtitle}
            </p>
          )}
          {!subtitle && (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <span
                className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-primary/80 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
