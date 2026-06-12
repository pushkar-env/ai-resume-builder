import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import {
  motion,
  useAnimationControls,
  useDragControls,
  AnimatePresence,
  type Variants,
} from "framer-motion";
import {
  Plus,
  FileText,
  Copy,
  Trash2,
  MoreHorizontal,
  Clock,
  Pencil,
  FileUp,
  Loader2,
  GripVertical,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/shared/SEO";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { ResumeSkeleton } from "@/components/resume/ResumeSkeleton";
import { ScaledResumeThumbnailShell } from "@/components/resume/ScaledResumeThumbnailShell";
import { getDefaultAccentColor, TEMPLATE_CONFIG } from "@/lib/template-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Navbar } from "@/components/layout/Navbar";
import { AppFooter } from "@/components/layout/AppFooter";
import {
  useListResumes,
  useCreateResume,
  useDeleteResume,
  useDuplicateResume,
  useUpdateResume,
  useGetResume,
  useImportResume,
  createResume as createResumeApi,
  importResume as importResumeApi,
  getListResumesQueryKey,
  getGetResumeQueryKey,
  type Resume,
  useListCoverLetters,
  useCreateCoverLetter,
  useDeleteCoverLetter,
  useDuplicateCoverLetter,
  useUpdateCoverLetter,
  useGenerateCoverLetter,
  useScrapeJobDetails,
  getListCoverLettersQueryKey,
  type CoverLetter,
  type ScrapeJobResult,
} from "@workspace/api-client-react";
import { CoverLetterPreview } from "@/components/resume/CoverLetterPreview";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { PaywallDialog } from "@/components/shared/PaywallDialog";
import { PremiumLoadingScreen } from "@/components/shared/PremiumLoadingScreen";
import {
  createImportResumeOptions,
  createResumeMutationOptions,
  resumeOperationErrorMessage,
  withResumeMutationRetry,
} from "@/lib/resume-api-request";
import {
  previewCardHoverTransition,
  previewCardWhileHover,
} from "@/lib/preview-card-hover";

const templateColors: Record<string, string> = {
  modern: "bg-violet-100 text-violet-700",
  minimal: "bg-slate-100 text-slate-700",
  corporate: "bg-blue-100 text-blue-700",
  creative: "bg-pink-100 text-pink-700",
  "ats-friendly": "bg-green-100 text-green-700",
  developer: "bg-orange-100 text-orange-700",
  executive: "bg-amber-100 text-amber-700",
  startup: "bg-cyan-100 text-cyan-700",
  faang: "bg-indigo-100 text-indigo-700",
};

function timeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Lazy-load the heavy preview DOM until the card is near the viewport.
 * Keeps mobile scroll/main thread responsive when many resumes exist.
 */
export function ResumeThumbnail({
  resumeId,
  templateId,
  isDragging,
  index = 0,
}: {
  resumeId: number;
  templateId: string;
  isDragging: boolean;
  index?: number;
}) {
  const { user } = useUser();
  const showWatermark = false;
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [fontScale, setFontScale] = useState<number>(1);
  const [isReady, setIsReady] = useState(false);

  // Defer rendering the heavy preview SVG/HTML text nodes until entrance animations complete
  useEffect(() => {
    const delay = 400 + index * 60;
    const timer = setTimeout(() => setIsReady(true), delay);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: "140px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { data: resume } = useGetResume(resumeId, {
    query: {
      queryKey: getGetResumeQueryKey(resumeId),
      enabled: isReady && inView && !isDragging,
    },
  });

  // Preview zoom is persisted per resume in the builder; font/color come from the API on `resume`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(`resumeFontScale:${resumeId}`);
    const n = v ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) setFontScale(n);
  }, [resumeId]);

  if (isDragging) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5 text-primary/60 border-2 border-dashed border-primary/15 transition-all duration-300">
        <FileText
          className="h-10 w-10 mb-2 animate-bounce"
          style={{ animationDuration: "2s" }}
        />
        <span className="text-[10px] font-bold tracking-wider uppercase select-none opacity-70">
          Holding Document
        </span>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="w-full h-full min-h-[1px] relative overflow-hidden bg-white pointer-events-none [content-visibility:visible] rounded-t-xl"
    >
      {/* Skeleton overlay: visible initially, fades out when preview is ready */}
      <div
        className="absolute inset-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity: isReady && resume ? 0 : 1,
          visibility: isReady && resume ? "hidden" : "visible",
          transition: "opacity 500ms ease-in-out, visibility 500ms step-end",
        }}
      >
        <ScaledResumeThumbnailShell
          hostClassName="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none rounded-t-xl"
          measureDeps={[templateId]}
        >
          <ResumeSkeleton templateId={templateId} />
        </ScaledResumeThumbnailShell>
      </div>

      {/* Preview overlay: mounts and fades in when ready */}
      {isReady && resume && (
        <div className="absolute inset-0 animate-fade-in">
          <ScaledResumeThumbnailShell
            hostClassName="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none rounded-t-xl"
            measureDeps={[]}
          >
            <ResumePreview
              layout="continuous"
              resume={resume}
              accentColor={
                resume.accentColor ?? getDefaultAccentColor(resume.templateId)
              }
              fontScale={fontScale}
              fontColor={
                resume.fontColor ??
                (resume.templateId === "midnight" ? "#f9fafb" : "#111827")
              }
              backgroundColor={
                resume.backgroundColor ??
                (resume.templateId === "midnight" ? "#0d1117" : "#ffffff")
              }
              showWatermark={showWatermark}
            />
          </ScaledResumeThumbnailShell>
        </div>
      )}
    </div>
  );
}

const DashboardResumeCard = memo(function DashboardResumeCard({
  resume,
  fadeUp,
  coarsePointer,
  navigate,
  setRenameTitle,
  setRenameId,
  setDeleteId,
  deleteId,
  handleDuplicateRequest,
  isDraggingThis,
  setActiveDragResumeId,
  setIsOverTrash,
  onDragDelete,
  index,
  onCreateCoverLetter,
}: {
  resume: Resume;
  fadeUp: Variants;
  coarsePointer: boolean;
  navigate: (path: string) => void;
  setRenameTitle: (t: string) => void;
  setRenameId: (id: number | null) => void;
  setDeleteId: (id: number | null) => void;
  deleteId: number | null;
  handleDuplicateRequest: (id: number) => void;
  isDraggingThis: boolean;
  setActiveDragResumeId: (id: number | null) => void;
  setIsOverTrash: (over: boolean) => void;
  onDragDelete: (id: number) => void;
  index: number;
  onCreateCoverLetter: (id: number, title: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInitialRectRef = useRef<DOMRect | null>(null);
  const [resumeMenuOpen, setResumeMenuOpen] = useState(false);
  const menuSlipRef = useRef(false);
  const menuStartRef = useRef({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const isDragging = useRef(false);
  const dragControls = useDragControls();
  const longPressTimer = useRef<any>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const currentOverTrash = useRef(false);
  const hasDragged = useRef(false);
  const isPointerDownThisCard = useRef(false);
  const wasDraggableDuringTouch = useRef(false);

  // Close options menu when scrolling anywhere on mobile or desktop
  useEffect(() => {
    if (!resumeMenuOpen) return;

    const handleScroll = () => {
      setResumeMenuOpen(false);
    };

    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [resumeMenuOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow left click / standard touch to drag
    if (e.button !== 0 || resumeMenuOpen) return;

    // Ignore if clicking on buttons or menu trigger
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("[role='menuitem']") ||
      target.closest(".dropdown-menu-trigger")
    ) {
      return;
    }

    // Close options menu if open
    setResumeMenuOpen(false);

    startPoint.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
    currentOverTrash.current = false;
    isPointerDownThisCard.current = true;
    wasDraggableDuringTouch.current = false;

    const nativeEvent = e.nativeEvent;
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      wasDraggableDuringTouch.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
      dragControls.start(nativeEvent);
      setActiveDragResumeId(resume.id);
    }, 280);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) {
      const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      const threshold = isTouch ? 24 : 5;
      const dist = Math.hypot(
        e.clientX - startPoint.current.x,
        e.clientY - startPoint.current.y,
      );
      if (isTouch) {
        if (dist > threshold) {
          clearTimeout(longPressTimer.current);
        }
      } else {
        if (isPointerDownThisCard.current && dist > threshold) {
          clearTimeout(longPressTimer.current);
          isDragging.current = true;
          hasDragged.current = true;
          dragControls.start(e.nativeEvent);
          setActiveDragResumeId(resume.id);
        }
      }
    }
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
    if (!isPointerDownThisCard.current) {
      return;
    }
    isPointerDownThisCard.current = false;

    if (isDragging.current) {
      isDragging.current = false;
      setActiveDragResumeId(null);
      setIsOverTrash(false);
      currentOverTrash.current = false;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDraggableDuringTouch.current || hasDragged.current) {
      wasDraggableDuringTouch.current = false;
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.closest &&
      (target.closest("button") ||
        target.closest(".dropdown-menu-trigger") ||
        target.closest("[role='menuitem']"))
    ) {
      return;
    }

    if (resumeMenuOpen) {
      setResumeMenuOpen(false);
      return;
    }

    navigate(`/builder/${resume.id}`);
  };

  const handlePointerCancel = () => {
    clearTimeout(longPressTimer.current);
    isPointerDownThisCard.current = false;
    if (isDragging.current) {
      isDragging.current = false;
      setActiveDragResumeId(null);
      setIsOverTrash(false);
      currentOverTrash.current = false;
    }
  };

  useEffect(() => {
    const handleWindowPointerUp = () => {
      clearTimeout(longPressTimer.current);
      isPointerDownThisCard.current = false;
      if (isDragging.current) {
        isDragging.current = false;
        setActiveDragResumeId(null);
        setIsOverTrash(false);
        currentOverTrash.current = false;
      }
    };

    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, []);

  const isDeleting = deleteId === resume.id;

  return (
    <motion.div
      layout="position"
      transition={{
        layout: {
          type: "spring",
          stiffness: 220,
          damping: 28,
          mass: 0.7,
        },
      }}
      variants={fadeUp}
      exit={{
        opacity: 0,
        scale: 0.85,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      className={`h-full relative select-none no-touch-callout ${
        isDraggingThis ? "touch-none" : "touch-pan-y"
      }`}
      style={{
        zIndex: isDraggingThis ? 50 : 1,
        willChange: isDraggingThis ? "transform" : "auto",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isDraggingThis && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center text-center p-6 pointer-events-none select-none z-0">
          <FileText className="h-8 w-8 text-primary/40 mb-2 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-primary/40 uppercase">
            Moving Resume
          </span>
        </div>
      )}
      <motion.div
        ref={cardRef}
        className={`h-full origin-center animate-fill-both rounded-xl ${
          isDraggingThis ? "touch-none" : "touch-pan-y"
        }`}
        style={{
          transformStyle: isDraggingThis ? "preserve-3d" : "flat",
          backfaceVisibility: isDraggingThis ? "hidden" : "visible",
        }}
        initial={{
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
        drag={!resumeMenuOpen}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragSnapToOrigin={true}
        onDragStart={() => {
          if (cardRef.current) {
            cardInitialRectRef.current =
              cardRef.current.getBoundingClientRect();
          }
        }}
        onDrag={(event, info) => {
          hasDragged.current = true;

          // Get viewport-relative pointer coordinates from raw event or fallback
          let pointerX = (event as any).clientX;
          let pointerY = (event as any).clientY;

          if (pointerX === undefined || pointerY === undefined) {
            if ((event as any).touches && (event as any).touches.length > 0) {
              pointerX = (event as any).touches[0].clientX;
              pointerY = (event as any).touches[0].clientY;
            } else if (
              (event as any).changedTouches &&
              (event as any).changedTouches.length > 0
            ) {
              pointerX = (event as any).changedTouches[0].clientX;
              pointerY = (event as any).changedTouches[0].clientY;
            } else {
              // Fallback to Framer Motion point relative to viewport by subtracting document scroll
              pointerX = info.point.x - window.scrollX;
              pointerY = info.point.y - window.scrollY;
            }
          }

          // Calculate viewport-relative trash bin bounds mathematically
          const trashLeft = window.innerWidth / 2 - 32;
          const trashRight = window.innerWidth / 2 + 32;
          const trashTop = window.innerHeight - 88;
          const trashBottom = window.innerHeight - 24;

          const currentOver = currentOverTrash.current;

          // Check if the card itself overlaps the trash bin (reflow-free using initial rect + offset)
          let cardOver = false;
          if (cardInitialRectRef.current) {
            const cardLeft = cardInitialRectRef.current.left + info.offset.x;
            const cardRight = cardInitialRectRef.current.right + info.offset.x;
            const cardTop = cardInitialRectRef.current.top + info.offset.y;
            const cardBottom =
              cardInitialRectRef.current.bottom + info.offset.y;

            // Hysteresis padding: card must penetrate 20px to activate, 0px to deactivate
            const cardPadding = currentOver ? 0 : -20;
            cardOver = !(
              cardRight < trashLeft - cardPadding ||
              cardLeft > trashRight + cardPadding ||
              cardBottom < trashTop - cardPadding ||
              cardTop > trashBottom + cardPadding
            );
          }

          // Check if the pointer is within a generous box of the trash bin
          const pointerPadding = currentOver ? 48 : 24;
          const pointerOver =
            pointerX >= trashLeft - pointerPadding &&
            pointerX <= trashRight + pointerPadding &&
            pointerY >= trashTop - pointerPadding &&
            pointerY <= trashBottom + pointerPadding;

          // Over is true if either the card intersects or the pointer hovers over the bin area
          const over = cardOver || pointerOver;

          if (over !== currentOver) {
            currentOverTrash.current = over;
            setIsOverTrash(over);
            if (over && navigator.vibrate) {
              navigator.vibrate(15);
            }
          }
        }}
        onDragEnd={(event, info) => {
          isDragging.current = false;
          setActiveDragResumeId(null);
          setIsOverTrash(false);

          if (currentOverTrash.current) {
            onDragDelete(resume.id);
          }
          currentOverTrash.current = false;
        }}
        animate={
          isDeleting
            ? {
                x: 0,
                scale: 0,
                opacity: 0,
                y: 150,
                rotate: 0,
                transition: { duration: 0.3, ease: "easeInOut" },
              }
            : isDraggingThis
              ? {
                  scale: 1.04,
                  rotate: -1.5,
                  boxShadow: "0 20px 35px rgba(0,0,0,0.12)",
                  opacity: 0.92,
                  transition: { type: "spring", stiffness: 300, damping: 25 },
                }
              : isHovered && !resumeMenuOpen
                ? {
                    x: 0,
                    y: -6,
                    scale: 1,
                    rotate: 0,
                    boxShadow:
                      "0 14px 24px -6px rgba(0,0,0,0.12), 0 6px 12px -4px rgba(0,0,0,0.08)",
                    transition: previewCardHoverTransition,
                  }
                : {
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotate: 0,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    transition: previewCardHoverTransition,
                  }
        }
        onHoverStart={() => {
          if (coarsePointer || isDraggingThis) return;
          setIsHovered(true);
        }}
        onHoverEnd={() => {
          setIsHovered(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
      >
        <Card
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          className={`h-full flex flex-col group border-border relative overflow-hidden select-none shadow transition-[box-shadow,border-color] duration-300 hover:shadow-xl hover:border-primary/45 ${
            isDraggingThis
              ? "border-primary/60 bg-background/90 backdrop-blur-md cursor-grabbing touch-none z-10"
              : "cursor-grab touch-pan-y"
          }`}
        >
          <div className="h-[220px] w-full rounded-t-xl border-b border-border/40 relative overflow-hidden shrink-0 isolate pointer-events-none">
            <ResumeThumbnail
              resumeId={resume.id}
              templateId={resume.templateId}
              isDragging={isDraggingThis}
              index={index}
            />
          </div>

          <CardContent className="p-5 flex-1 flex flex-col bg-card relative z-10 pointer-events-none rounded-b-xl">
            <div className="flex items-start justify-between mb-auto pointer-events-auto">
              <div className="flex-1 min-w-0 pr-14 md:pr-6 pointer-events-none">
                <h3 className="font-semibold text-base truncate mb-1">
                  {resume.title}
                </h3>
                <span
                  className={`inline-block text-[11px] px-2.5 py-0.5 rounded-md font-medium ${templateColors[resume.templateId] ?? "bg-muted text-muted-foreground"}`}
                >
                  {resume.templateId.charAt(0).toUpperCase() +
                    resume.templateId.slice(1)}{" "}
                  Template
                </span>
              </div>
              <DropdownMenu
                modal={false}
                open={resumeMenuOpen}
                onOpenChange={(next: boolean) => {
                  if (coarsePointer && next && menuSlipRef.current) {
                    menuSlipRef.current = false;
                    return;
                  }
                  setResumeMenuOpen(next);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`dropdown-menu-trigger h-10 w-10 min-h-10 min-w-10 md:h-7 md:w-7 md:min-h-0 md:min-w-0 p-0 absolute top-3 right-3 md:top-4 md:right-4 bg-background/80 backdrop-blur-sm shadow-sm md:shadow-none focus-visible:ring-0 focus:outline-none [-webkit-tap-highlight-color:transparent] touch-manipulation z-25 transition-opacity duration-200 ${
                      coarsePointer
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      clearTimeout(longPressTimer.current);
                      if (!coarsePointer) return;
                      if (e.pointerType !== "touch" && e.pointerType !== "pen")
                        return;
                      menuSlipRef.current = false;
                      menuStartRef.current = { x: e.clientX, y: e.clientY };
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        /* noop */
                      }
                    }}
                    onPointerMove={(e) => {
                      if (!coarsePointer) return;
                      if (!e.currentTarget.hasPointerCapture(e.pointerId))
                        return;
                      const s = menuStartRef.current;
                      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12)
                        menuSlipRef.current = true;
                    }}
                    onPointerUp={(e) => {
                      if (coarsePointer) {
                        try {
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          }
                        } catch {
                          /* noop */
                        }
                      }
                    }}
                    onPointerCancel={(e) => {
                      if (coarsePointer) {
                        try {
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          }
                        } catch {
                          /* noop */
                        }
                      }
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 z-30">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/builder/${resume.id}`);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    Open Editor
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateRequest(resume.id);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameTitle(resume.title ?? "");
                      setRenameId(resume.id);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateCoverLetter(resume.id, resume.title ?? "");
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
                    Create Cover Letter
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(resume.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center text-xs text-muted-foreground mt-6 pt-4 border-t border-border/50">
              <Clock className="h-3.5 w-3.5 mr-1.5 opacity-70" />
              Updated {timeAgo(resume.updatedAt)}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
});

const DashboardCoverLetterCard = memo(function DashboardCoverLetterCard({
  coverLetter,
  fadeUp,
  coarsePointer,
  navigate,
  setRenameTitle,
  setRenameId,
  setDeleteId,
  deleteId,
  handleDuplicateRequest,
  index,
  user,
  isDraggingThis,
  setActiveDragCoverLetterId,
  setIsOverTrash,
  onDragDelete,
}: {
  coverLetter: CoverLetter;
  fadeUp: Variants;
  coarsePointer: boolean;
  navigate: (path: string) => void;
  setRenameTitle: (t: string) => void;
  setRenameId: (id: number | null) => void;
  setDeleteId: (id: number | null) => void;
  deleteId: number | null;
  handleDuplicateRequest: (id: number) => void;
  index: number;
  user: any;
  isDraggingThis: boolean;
  setActiveDragCoverLetterId: (id: number | null) => void;
  setIsOverTrash: (over: boolean) => void;
  onDragDelete: (id: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInitialRectRef = useRef<DOMRect | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuSlipRef = useRef(false);
  const menuStartRef = useRef({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const isDragging = useRef(false);
  const dragControls = useDragControls();
  const longPressTimer = useRef<any>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const currentOverTrash = useRef(false);
  const hasDragged = useRef(false);
  const isPointerDownThisCard = useRef(false);
  const wasDraggableDuringTouch = useRef(false);
  const isDeleting = deleteId === coverLetter.id;

  // Close options menu when scrolling anywhere on mobile or desktop
  useEffect(() => {
    if (!menuOpen) return;

    const handleScroll = () => {
      setMenuOpen(false);
    };

    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [menuOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow left click / standard touch to drag
    if (e.button !== 0 || menuOpen) return;

    // Ignore if clicking on buttons or menu trigger
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("[role='menuitem']") ||
      target.closest(".dropdown-menu-trigger")
    ) {
      return;
    }

    // Close options menu if open
    setMenuOpen(false);

    startPoint.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
    currentOverTrash.current = false;
    isPointerDownThisCard.current = true;
    wasDraggableDuringTouch.current = false;

    const nativeEvent = e.nativeEvent;
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      wasDraggableDuringTouch.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
      dragControls.start(nativeEvent);
      setActiveDragCoverLetterId(coverLetter.id);
    }, 280);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) {
      const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      const threshold = isTouch ? 24 : 5;
      const dist = Math.hypot(
        e.clientX - startPoint.current.x,
        e.clientY - startPoint.current.y,
      );
      if (isTouch) {
        if (dist > threshold) {
          clearTimeout(longPressTimer.current);
        }
      } else {
        if (isPointerDownThisCard.current && dist > threshold) {
          clearTimeout(longPressTimer.current);
          isDragging.current = true;
          hasDragged.current = true;
          dragControls.start(e.nativeEvent);
          setActiveDragCoverLetterId(coverLetter.id);
        }
      }
    }
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
    if (!isPointerDownThisCard.current) {
      return;
    }
    isPointerDownThisCard.current = false;

    if (isDragging.current) {
      isDragging.current = false;
      setActiveDragCoverLetterId(null);
      setIsOverTrash(false);
      currentOverTrash.current = false;
    }
  };

  const handlePointerCancel = () => {
    clearTimeout(longPressTimer.current);
    isPointerDownThisCard.current = false;
    if (isDragging.current) {
      isDragging.current = false;
      setActiveDragCoverLetterId(null);
      setIsOverTrash(false);
      currentOverTrash.current = false;
    }
  };

  useEffect(() => {
    const handleWindowPointerUp = () => {
      clearTimeout(longPressTimer.current);
      isPointerDownThisCard.current = false;
      if (isDragging.current) {
        isDragging.current = false;
        setActiveDragCoverLetterId(null);
        setIsOverTrash(false);
        currentOverTrash.current = false;
      }
    };

    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (wasDraggableDuringTouch.current || hasDragged.current) {
      wasDraggableDuringTouch.current = false;
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.closest &&
      (target.closest("button") ||
        target.closest(".dropdown-menu-trigger") ||
        target.closest("[role='menuitem']"))
    ) {
      return;
    }

    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    navigate(`/cover-letter-builder/${coverLetter.id}`);
  };

  // Load linked resume if it exists
  const { data: linkedResume } = useGetResume(coverLetter.resumeId as number, {
    query: {
      enabled: !!coverLetter.resumeId,
      queryKey: getGetResumeQueryKey(coverLetter.resumeId as number),
    },
  });

  // Resolve personal info fallbacks from linked resume
  let resolvedName = (coverLetter as any).senderName || "";
  if (!resolvedName && linkedResume?.sections) {
    const personalSection = linkedResume.sections.find(
      (s) => s.type === "personal",
    );
    if (personalSection?.content) {
      const c = personalSection.content as any;
      resolvedName = c.name || c.fullName || "";
    }
  }
  const senderName = resolvedName || user?.fullName || "Your Name";

  let resolvedEmail = (coverLetter as any).senderEmail || "";
  if (!resolvedEmail && linkedResume?.sections) {
    const personalSection = linkedResume.sections.find(
      (s) => s.type === "personal",
    );
    if (personalSection?.content) {
      const c = personalSection.content as any;
      resolvedEmail = c.email || "";
    }
  }
  const senderEmail =
    resolvedEmail ||
    user?.primaryEmailAddress?.emailAddress ||
    "your.email@example.com";

  let resolvedPhone = (coverLetter as any).senderPhone || "";
  if (!resolvedPhone && linkedResume?.sections) {
    const personalSection = linkedResume.sections.find(
      (s) => s.type === "personal",
    );
    if (personalSection?.content) {
      const c = personalSection.content as any;
      resolvedPhone = c.phone || "";
    }
  }
  const senderPhone = resolvedPhone || "";

  let resolvedLocation = (coverLetter as any).senderLocation || "";
  if (!resolvedLocation && linkedResume?.sections) {
    const personalSection = linkedResume.sections.find(
      (s) => s.type === "personal",
    );
    if (personalSection?.content) {
      const c = personalSection.content as any;
      resolvedLocation = c.location || "";
    }
  }
  const senderLocation = resolvedLocation || "";

  // Accent color fallbacks
  const accentColor =
    coverLetter.accentColor || linkedResume?.accentColor || "#1e3a8a";
  const fontFamily = coverLetter.fontFamily || "sans";
  const showWatermark = false;

  return (
    <motion.div
      layout="position"
      transition={{
        layout: {
          type: "spring",
          stiffness: 220,
          damping: 28,
          mass: 0.7,
        },
      }}
      variants={fadeUp}
      exit={{
        opacity: 0,
        scale: 0.85,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      className={`h-full relative select-none no-touch-callout ${
        isDraggingThis ? "touch-none" : "touch-pan-y"
      }`}
      style={{
        zIndex: isDraggingThis ? 50 : 1,
        willChange: isDraggingThis ? "transform" : "auto",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isDraggingThis && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center text-center p-6 pointer-events-none select-none z-0">
          <FileText className="h-8 w-8 text-primary/40 mb-2 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-primary/40 uppercase">
            Moving Cover Letter
          </span>
        </div>
      )}
      <motion.div
        ref={cardRef}
        className={`h-full origin-center animate-fill-both rounded-xl ${
          isDraggingThis ? "touch-none" : "touch-pan-y"
        }`}
        style={{
          transformStyle: isDraggingThis ? "preserve-3d" : "flat",
          backfaceVisibility: isDraggingThis ? "hidden" : "visible",
        }}
        initial={{
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
        drag={!menuOpen}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragSnapToOrigin={true}
        onDragStart={() => {
          if (cardRef.current) {
            cardInitialRectRef.current =
              cardRef.current.getBoundingClientRect();
          }
        }}
        onDrag={(event, info) => {
          hasDragged.current = true;

          // Get viewport-relative pointer coordinates from raw event or fallback
          let pointerX = (event as any).clientX;
          let pointerY = (event as any).clientY;

          if (pointerX === undefined || pointerY === undefined) {
            if ((event as any).touches && (event as any).touches.length > 0) {
              pointerX = (event as any).touches[0].clientX;
              pointerY = (event as any).touches[0].clientY;
            } else if (
              (event as any).changedTouches &&
              (event as any).changedTouches.length > 0
            ) {
              pointerX = (event as any).changedTouches[0].clientX;
              pointerY = (event as any).changedTouches[0].clientY;
            } else {
              // Fallback to Framer Motion point relative to viewport by subtracting document scroll
              pointerX = info.point.x - window.scrollX;
              pointerY = info.point.y - window.scrollY;
            }
          }

          // Calculate viewport-relative trash bin bounds mathematically
          const trashLeft = window.innerWidth / 2 - 32;
          const trashRight = window.innerWidth / 2 + 32;
          const trashTop = window.innerHeight - 88;
          const trashBottom = window.innerHeight - 24;

          const currentOver = currentOverTrash.current;

          // Check if the card itself overlaps the trash bin (reflow-free using initial rect + offset)
          let cardOver = false;
          if (cardInitialRectRef.current) {
            const cardLeft = cardInitialRectRef.current.left + info.offset.x;
            const cardRight = cardInitialRectRef.current.right + info.offset.x;
            const cardTop = cardInitialRectRef.current.top + info.offset.y;
            const cardBottom =
              cardInitialRectRef.current.bottom + info.offset.y;

            // Hysteresis padding: card must penetrate 20px to activate, 0px to deactivate
            const cardPadding = currentOver ? 0 : -20;
            cardOver = !(
              cardRight < trashLeft - cardPadding ||
              cardLeft > trashRight + cardPadding ||
              cardBottom < trashTop - cardPadding ||
              cardTop > trashBottom + cardPadding
            );
          }

          // Check if the pointer is within a generous box of the trash bin
          const pointerPadding = currentOver ? 48 : 24;
          const pointerOver =
            pointerX >= trashLeft - pointerPadding &&
            pointerX <= trashRight + pointerPadding &&
            pointerY >= trashTop - pointerPadding &&
            pointerY <= trashBottom + pointerPadding;

          // Over is true if either the card intersects or the pointer hovers over the bin area
          const over = cardOver || pointerOver;

          if (over !== currentOver) {
            currentOverTrash.current = over;
            setIsOverTrash(over);
            if (over && navigator.vibrate) {
              navigator.vibrate(15);
            }
          }
        }}
        onDragEnd={(event, info) => {
          isDragging.current = false;
          setActiveDragCoverLetterId(null);
          setIsOverTrash(false);

          if (currentOverTrash.current) {
            onDragDelete(coverLetter.id);
          }
          currentOverTrash.current = false;
        }}
        animate={
          isDeleting
            ? {
                x: 0,
                scale: 0,
                opacity: 0,
                y: 150,
                rotate: 0,
                transition: { duration: 0.3, ease: "easeInOut" },
              }
            : isDraggingThis
              ? {
                  scale: 1.04,
                  rotate: -1.5,
                  boxShadow: "0 20px 35px rgba(0,0,0,0.12)",
                  opacity: 0.92,
                  transition: { type: "spring", stiffness: 300, damping: 25 },
                }
              : isHovered && !menuOpen
                ? {
                    x: 0,
                    y: -6,
                    scale: 1,
                    rotate: 0,
                    boxShadow:
                      "0 14px 24px -6px rgba(0,0,0,0.12), 0 6px 12px -4px rgba(0,0,0,0.08)",
                    transition: previewCardHoverTransition,
                  }
                : {
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotate: 0,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    transition: previewCardHoverTransition,
                  }
        }
        onHoverStart={() => {
          if (coarsePointer || isDraggingThis) return;
          setIsHovered(true);
        }}
        onHoverEnd={() => {
          setIsHovered(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
      >
        <Card
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          className={`h-full flex flex-col group border-border relative overflow-hidden select-none shadow transition-[box-shadow,border-color] duration-300 hover:shadow-xl hover:border-primary/45 ${
            isDraggingThis
              ? "border-primary/60 bg-background/90 backdrop-blur-md cursor-grabbing touch-none z-10"
              : "cursor-grab touch-pan-y"
          }`}
        >
          {/* Cover Letter Thumbnail / Preview container */}
          <div className="h-[220px] w-full rounded-t-xl border-b border-border/40 relative overflow-hidden shrink-0 isolate pointer-events-none bg-white">
            {isDraggingThis ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5 text-primary/60 border-2 border-dashed border-primary/15 transition-all duration-300">
                <FileText
                  className="h-10 w-10 mb-2 animate-bounce"
                  style={{ animationDuration: "2s" }}
                />
                <span className="text-[10px] font-bold tracking-wider uppercase select-none opacity-70">
                  Holding Document
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 animate-fade-in">
                <ScaledResumeThumbnailShell
                  hostClassName="absolute inset-0 overflow-hidden bg-white [&_.a4-page]:!shadow-none rounded-t-xl"
                  measureDeps={[
                    coverLetter.id,
                    coverLetter.templateId,
                    accentColor,
                    fontFamily,
                  ]}
                >
                  <CoverLetterPreview
                    content={
                      coverLetter.generatedContent ||
                      "Dear Hiring Manager,\n\nI am writing to express my interest..."
                    }
                    senderName={senderName}
                    senderEmail={senderEmail}
                    senderPhone={senderPhone}
                    senderLocation={senderLocation}
                    recipientName={
                      coverLetter.hiringManagerName || "Hiring Manager"
                    }
                    companyName={coverLetter.companyName || "Company Name"}
                    companyLocation={coverLetter.companyLocation || ""}
                    jobTitle={coverLetter.jobTitle || "Job Title"}
                    templateId={coverLetter.templateId || "classic"}
                    accentColor={accentColor}
                    fontFamily={fontFamily}
                    zoom={1}
                    showWatermark={showWatermark}
                  />
                </ScaledResumeThumbnailShell>
              </div>
            )}
          </div>

          <CardContent className="p-5 flex-1 flex flex-col bg-card relative z-10 pointer-events-none rounded-b-xl">
            <div className="flex items-start justify-between mb-auto pointer-events-auto">
              <div className="flex-1 min-w-0 pr-14 md:pr-6 pointer-events-none">
                <h3 className="font-semibold text-base truncate mb-1 text-slate-900 dark:text-slate-100">
                  {coverLetter.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate mb-2">
                  {coverLetter.jobTitle && coverLetter.companyName
                    ? `${coverLetter.jobTitle} at ${coverLetter.companyName}`
                    : coverLetter.jobTitle ||
                      coverLetter.companyName ||
                      "Draft"}
                </p>
                <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 capitalize">
                  {coverLetter.templateId || "Classic"} Template
                </span>
              </div>
              <DropdownMenu
                modal={false}
                open={menuOpen}
                onOpenChange={(next: boolean) => {
                  if (coarsePointer && next && menuSlipRef.current) {
                    menuSlipRef.current = false;
                    return;
                  }
                  setMenuOpen(next);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`dropdown-menu-trigger h-10 w-10 min-h-10 min-w-10 md:h-7 md:w-7 md:min-h-0 md:min-w-0 p-0 absolute top-3 right-3 md:top-4 md:right-4 bg-background/80 backdrop-blur-sm shadow-sm md:shadow-none focus-visible:ring-0 focus:outline-none [-webkit-tap-highlight-color:transparent] touch-manipulation z-25 transition-opacity duration-200 ${
                      coarsePointer
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      clearTimeout(longPressTimer.current);
                      if (!coarsePointer) return;
                      if (e.pointerType !== "touch" && e.pointerType !== "pen")
                        return;
                      menuSlipRef.current = false;
                      menuStartRef.current = { x: e.clientX, y: e.clientY };
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        /* noop */
                      }
                    }}
                    onPointerMove={(e) => {
                      if (!coarsePointer) return;
                      if (!e.currentTarget.hasPointerCapture(e.pointerId))
                        return;
                      const s = menuStartRef.current;
                      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12)
                        menuSlipRef.current = true;
                    }}
                    onPointerUp={(e) => {
                      if (coarsePointer) {
                        try {
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          }
                        } catch {
                          /* noop */
                        }
                      }
                    }}
                    onPointerCancel={(e) => {
                      if (coarsePointer) {
                        try {
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          }
                        } catch {
                          /* noop */
                        }
                      }
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 z-30">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/cover-letter-builder/${coverLetter.id}`);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    Open Editor
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateRequest(coverLetter.id);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameTitle(coverLetter.title ?? "");
                      setRenameId(coverLetter.id);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(coverLetter.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center text-xs text-muted-foreground mt-6 pt-4 border-t border-border/50">
              <Clock className="h-3.5 w-3.5 mr-1.5 opacity-70" />
              Updated {timeAgo(coverLetter.updatedAt)}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
});

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const coarsePointer = useCoarsePointer();
  const [activeTab, setActiveTab] = useState<"resumes" | "cover-letters">(
    () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      return tab === "cover-letters" ? "cover-letters" : "resumes";
    },
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createCoverLetterOpen, setCreateCoverLetterOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteType, setDeleteType] = useState<"resume" | "cover-letter">(
    "resume",
  );
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameType, setRenameType] = useState<"resume" | "cover-letter">(
    "resume",
  );
  const [newTitle, setNewTitle] = useState("My Resume");
  const [renameTitle, setRenameTitle] = useState("");
  const [startWithSampleContent, setStartWithSampleContent] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDragResumeId, setActiveDragResumeId] = useState<number | null>(
    null,
  );
  const [activeDragCoverLetterId, setActiveDragCoverLetterId] = useState<
    number | null
  >(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isDeletedTrashPop, setIsDeletedTrashPop] = useState(false);
  const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState<
    number[]
  >([]);

  // Canvas particle burst refs & loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<any[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const trashBinRef = useRef<HTMLDivElement | null>(null);

  // Refetch lists on mount to ensure fresh database state is loaded
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCoverLettersQueryKey() });
    // Invalidate all individual resume detail queries to ensure updated sections are loaded
    queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        query.queryKey[0].startsWith("/api/resumes"),
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Synchronize activeTab to URL search parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentTab = params.get("tab");
    if (currentTab !== activeTab) {
      params.set("tab", activeTab);
      const newSearch = params.toString();
      const newPath =
        window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState(null, "", newPath);
    }
  }, [activeTab]);

  const triggerBurst = useCallback((startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Vibrant gradient colors matching premium tags
    const colors = [
      "#f43f5e", // rose-500
      "#ec4899", // pink-500
      "#a855f7", // purple-500
      "#eab308", // yellow-500
      "#3b82f6", // blue-500
      "#10b981", // emerald-500
      "#f97316", // orange-500
    ];

    // Fewer particles on touch/mobile to avoid GPU stalls during layout reflow
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    const particleCount = isMobile ? 22 : 40;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.PI * 1.5 + (Math.random() - 0.5) * Math.PI * 0.75;
      const speed = 4 + Math.random() * 9;
      particlesRef.current.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5 + Math.random() * 5.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.014 + Math.random() * 0.018,
        gravity: 0.16,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        shape:
          Math.random() > 0.45
            ? "sparkle"
            : Math.random() > 0.45
              ? "circle"
              : "square",
      });
    }

    if (!animationFrameRef.current) {
      const tick = () => {
        const currentCanvas = canvasRef.current;
        if (!currentCanvas) return;
        const currentCtx = currentCanvas.getContext("2d");
        if (!currentCtx) return;

        currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.alpha -= p.decay;
          p.rotation += p.rotationSpeed;

          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }

          currentCtx.save();
          currentCtx.globalAlpha = p.alpha;
          currentCtx.translate(p.x, p.y);
          currentCtx.rotate(p.rotation);
          currentCtx.fillStyle = p.color;

          if (p.shape === "circle") {
            currentCtx.beginPath();
            currentCtx.arc(0, 0, p.size, 0, Math.PI * 2);
            currentCtx.fill();
          } else if (p.shape === "sparkle") {
            currentCtx.beginPath();
            currentCtx.moveTo(0, -p.size * 1.6);
            currentCtx.lineTo(p.size * 0.4, -p.size * 0.4);
            currentCtx.lineTo(p.size * 1.6, 0);
            currentCtx.lineTo(p.size * 0.4, p.size * 0.4);
            currentCtx.lineTo(0, p.size * 1.6);
            currentCtx.lineTo(-p.size * 0.4, p.size * 0.4);
            currentCtx.lineTo(-p.size * 1.6, 0);
            currentCtx.lineTo(-p.size * 0.4, -p.size * 0.4);
            currentCtx.closePath();
            currentCtx.fill();
          } else {
            currentCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          }
          currentCtx.restore();
        }

        if (particles.length > 0) {
          animationFrameRef.current = requestAnimationFrame(tick);
        } else {
          animationFrameRef.current = null;
        }
      };
      animationFrameRef.current = requestAnimationFrame(tick);
    }
  }, []);

  // Prevent native page scrolling / pointercancel triggers on touch devices when a card is dragging
  useEffect(() => {
    if (activeDragResumeId === null && activeDragCoverLetterId === null) return;

    const preventDefault = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    window.addEventListener("touchmove", preventDefault, { passive: false });

    return () => {
      window.removeEventListener("touchmove", preventDefault);
    };
  }, [activeDragResumeId, activeDragCoverLetterId]);

  const { user } = useUser();
  const isPremiumUser = user?.publicMetadata?.isPremium === true;

  const { data: resumes, isLoading: resumesLoading } = useListResumes();
  const resumeList = useMemo(() => {
    const list = Array.isArray(resumes) ? resumes : [];
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted.filter((r) => !optimisticallyDeletedIds.includes(r.id));
  }, [resumes, optimisticallyDeletedIds]);

  // Clean up orphaned local storage keys (e.g. after a local DB wipe or deletion)
  useEffect(() => {
    if (!resumes || typeof window === "undefined") return;
    const validIds = new Set(resumes.map((r: Resume) => r.id));
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("resumeFontScale:")) {
        const idStr = key.replace("resumeFontScale:", "");
        if (idStr && !validIds.has(parseInt(idStr))) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  }, [resumes]);

  const handleCreateRequest = () => {
    setCreateOpen(true);
  };

  const importResume = useImportResume({
    request: createImportResumeOptions(),
    mutation: {
      mutationFn: ({ data }) =>
        withResumeMutationRetry(() =>
          importResumeApi(data, createImportResumeOptions()),
        ),
      onSuccess: (data: Resume) => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        toast({ title: "Resume imported successfully" });
        navigate(`/builder/${data.id}`);
      },
      onError: (error: any) => {
        toast({
          title: "Failed to import resume",
          description: resumeOperationErrorMessage(
            error,
            "Ensure the file is a valid PDF or DOCX.",
          ),
          variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    },
  });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Pass the file to the mutation
    importResume.mutate({ data: { file } });
  };

  const createResume = useCreateResume({
    request: createResumeMutationOptions(),
    mutation: {
      mutationFn: ({ data }) =>
        withResumeMutationRetry(() =>
          createResumeApi(data, createResumeMutationOptions()),
        ),
      onSuccess: (data: Resume) => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        setCreateOpen(false);
        navigate(`/builder/${data.id}`);
      },
      onError: (error: any) =>
        toast({
          title: "Failed to create resume",
          description: resumeOperationErrorMessage(
            error,
            "Unknown error occurred",
          ),
          variant: "destructive",
        }),
    },
  });

  const deleteResume = useDeleteResume({
    mutation: {
      onSuccess: async (data, variables) => {
        setDeleteId(null);
        await queryClient.invalidateQueries({
          queryKey: getListResumesQueryKey(),
        });
        setOptimisticallyDeletedIds((prev) =>
          prev.filter((id) => id !== variables.id),
        );
      },
      onError: (error, variables) => {
        setDeleteId(null);
        setOptimisticallyDeletedIds((prev) =>
          prev.filter((id) => id !== variables.id),
        );
        toast({ title: "Failed to delete resume", variant: "destructive" });
      },
    },
  });

  const { data: coverLetters, isLoading: coverLettersLoading } =
    useListCoverLetters();
  const coverLetterList = useMemo(() => {
    const list = Array.isArray(coverLetters) ? coverLetters : [];
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted.filter((c) => !optimisticallyDeletedIds.includes(c.id));
  }, [coverLetters, optimisticallyDeletedIds]);

  const deleteCoverLetter = useDeleteCoverLetter({
    mutation: {
      onSuccess: async (data, variables) => {
        setDeleteId(null);
        await queryClient.invalidateQueries({
          queryKey: getListCoverLettersQueryKey(),
        });
        setOptimisticallyDeletedIds((prev) =>
          prev.filter((id) => id !== variables.id),
        );
      },
      onError: (error, variables) => {
        setDeleteId(null);
        setOptimisticallyDeletedIds((prev) =>
          prev.filter((id) => id !== variables.id),
        );
        toast({
          title: "Failed to delete cover letter",
          variant: "destructive",
        });
      },
    },
  });

  const duplicateCoverLetter = useDuplicateCoverLetter({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListCoverLettersQueryKey(),
        });
        toast({ title: "Cover letter duplicated" });
      },
      onError: () => {
        toast({
          title: "Failed to duplicate cover letter",
          variant: "destructive",
        });
      },
    },
  });

  const handleDuplicateCoverLetterRequest = useCallback(
    (id: number) => {
      duplicateCoverLetter.mutate({ id });
    },
    [duplicateCoverLetter.mutate],
  );

  const updateCoverLetter = useUpdateCoverLetter({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListCoverLettersQueryKey(),
        });
        setRenameId(null);
        toast({ title: "Cover letter renamed" });
      },
      onError: () =>
        toast({
          title: "Failed to rename cover letter",
          variant: "destructive",
        }),
    },
  });

  const generateCoverLetter = useGenerateCoverLetter({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: getListCoverLettersQueryKey(),
        });
        toast({ title: "Cover letter generated successfully" });
        setCreateCoverLetterOpen(false);
        if (clTitle.trim() && clTitle !== "My Cover Letter") {
          updateCoverLetter.mutate({ id: data.id, data: { title: clTitle } });
        }
        navigate(`/cover-letter-builder/${data.id}`);
      },
      onError: (error: any) => {
        toast({
          title: "Failed to generate cover letter",
          description: error?.message || "Unknown error occurred",
          variant: "destructive",
        });
      },
    },
  });

  const handleDragDeleteResume = useCallback(
    (id: number) => {
      // 1. Trigger physically reactive scale pop on trash bin
      setIsDeletedTrashPop(true);
      setTimeout(() => setIsDeletedTrashPop(false), 300);

      // 2. Play particle burst immediately (canvas runs independently)
      if (trashBinRef.current) {
        const rect = trashBinRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        triggerBurst(x, y);
      } else {
        triggerBurst(window.innerWidth / 2, window.innerHeight - 56);
      }

      // 3. Vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 40]);
      }

      // 4. Defer DOM removal by one frame so the burst animation starts
      //    before the heavy layout FLIP recalculation on remaining cards.
      //    This prevents the particle burst + layout reflow from competing
      //    for the same frame budget on mobile GPUs.
      requestAnimationFrame(() => {
        setOptimisticallyDeletedIds((prev) => [...prev, id]);
        toast({ title: "Resume deleted" });
        deleteResume.mutate({ id });
      });
    },
    [deleteResume.mutate, triggerBurst],
  );

  const handleDragDeleteCoverLetter = useCallback(
    (id: number) => {
      // 1. Trigger physically reactive scale pop on trash bin
      setIsDeletedTrashPop(true);
      setTimeout(() => setIsDeletedTrashPop(false), 300);

      // 2. Play particle burst immediately
      if (trashBinRef.current) {
        const rect = trashBinRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        triggerBurst(x, y);
      } else {
        triggerBurst(window.innerWidth / 2, window.innerHeight - 56);
      }

      // 3. Vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 40]);
      }

      // 4. Defer DOM removal by one frame (same pattern as resume delete)
      requestAnimationFrame(() => {
        setOptimisticallyDeletedIds((prev) => [...prev, id]);
        toast({ title: "Cover letter deleted" });
        deleteCoverLetter.mutate({ id });
      });
    },
    [deleteCoverLetter.mutate, triggerBurst],
  );

  const duplicateResume = useDuplicateResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        toast({ title: "Resume duplicated" });
      },
    },
  });

  const handleDuplicateRequest = useCallback(
    (id: number) => {
      duplicateResume.mutate({ id });
    },
    [duplicateResume.mutate],
  );

  const updateResume = useUpdateResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        setRenameId(null);
        toast({ title: "Resume renamed" });
      },
      onError: () =>
        toast({ title: "Failed to rename resume", variant: "destructive" }),
    },
  });

  const stagger = useMemo(
    () =>
      coarsePointer
        ? { hidden: {}, visible: { transition: { staggerChildren: 0 } } }
        : { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } },
    [coarsePointer],
  );

  const fadeUp = useMemo(
    () =>
      coarsePointer
        ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
        : {
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          },
    [coarsePointer],
  );

  const [clTitle, setClTitle] = useState("My Cover Letter");
  const [clResumeId, setClResumeId] = useState<number | "">("");
  const [clJobTitle, setClJobTitle] = useState("");
  const [clCompanyName, setClCompanyName] = useState("");
  const [clHiringManager, setClHiringManager] = useState("");
  const [clCompanyLocation, setClCompanyLocation] = useState("");
  const [clJobDescription, setClJobDescription] = useState("");
  const [clJobUrl, setClJobUrl] = useState("");
  const [clTone, setClTone] = useState("professional");
  const [clExpLevel, setClExpLevel] = useState("mid");
  const [clCustomInstructions, setClCustomInstructions] = useState("");
  const [clTemplateId, setClTemplateId] = useState("classic");

  const handleCreateCoverLetterFromResume = useCallback(
    (resumeId: number, resumeTitle: string) => {
      setActiveTab("cover-letters");
      setClResumeId(resumeId);
      setClTitle(`Cover Letter - ${resumeTitle}`);
      setClJobTitle("");
      setClCompanyName("");
      setClHiringManager("");
      setClCompanyLocation("");
      setClJobDescription("");
      setClJobUrl("");
      setClTone("professional");
      setClExpLevel("mid");
      setClCustomInstructions("");
      setCreateCoverLetterOpen(true);
    },
    [],
  );

  const scrapeJob = useScrapeJobDetails({
    mutation: {
      onSuccess: (data: ScrapeJobResult) => {
        toast({ title: "Job details scraped successfully" });
        if (data.jobTitle) setClJobTitle(data.jobTitle);
        if (data.companyName) setClCompanyName(data.companyName);
        if (data.description) setClJobDescription(data.description);
      },
      onError: (err: any) => {
        toast({
          title: "Failed to scrape job URL",
          description:
            err?.message || "Please paste the job description manually.",
          variant: "destructive",
        });
      },
    },
  });

  const handleScrapeJobUrl = () => {
    if (!clJobUrl) return;
    scrapeJob.mutate({ data: { url: clJobUrl } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnimatePresence>
        {(createResume.isPending ||
          importResume.isPending ||
          generateCoverLetter.isPending) && (
          <PremiumLoadingScreen
            key="dashboard-action-loading"
            title={
              importResume.isPending
                ? "Importing your resume"
                : generateCoverLetter.isPending
                  ? "Generating your Cover Letter"
                  : "Creating your resume"
            }
            subtitle={
              importResume.isPending
                ? "Extracting and structuring content with AI"
                : generateCoverLetter.isPending
                  ? "Tailoring tone and content to match job requirements..."
                  : "Setting up sections and template"
            }
          />
        )}
      </AnimatePresence>
      <SEO
        title="Dashboard | Resumesensei"
        description="Manage your AI-powered resumes and access premium templates."
        robots="noindex, nofollow"
      />
      <Navbar />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-indigo-200 dark:to-violet-200">
              {activeTab === "resumes" ? "My Resumes" : "My Cover Letters"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "resumes"
                ? "Manage and build your professional resumes"
                : "Generate and tailor cover letters for job openings"}
            </p>
          </div>

          {/* Gorgeous animated tab controller */}
          <div className="relative p-1 bg-slate-100/80 backdrop-blur-sm border border-slate-200/50 rounded-xl flex items-center w-fit self-start sm:self-auto shadow-sm">
            <button
              onClick={() => setActiveTab("resumes")}
              className={`relative px-4 py-2 text-xs font-semibold rounded-lg transition-colors z-10 duration-200 flex items-center gap-2 ${
                activeTab === "resumes"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Resumes
              {activeTab === "resumes" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white border border-slate-200/40 rounded-lg shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("cover-letters")}
              className={`relative px-4 py-2 text-xs font-semibold rounded-lg transition-colors z-10 duration-200 flex items-center gap-2 ${
                activeTab === "cover-letters"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Cover Letters
              {activeTab === "cover-letters" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white border border-slate-200/40 rounded-lg shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "resumes" ? (
            resumesLoading ? (
              <PremiumLoadingScreen
                key="dashboard-resumes-loading"
                title="Fetching your resumes"
                subtitle="Preparing your dashboard"
              />
            ) : (
              <motion.div
                key="dashboard-resumes-content"
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full"
              >
                {/* Create New Card */}
                <motion.div variants={fadeUp}>
                  <div
                    onClick={handleCreateRequest}
                    className="h-full min-h-[160px] rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group p-6 text-center"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm">Create New Resume</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start from a blank template
                    </p>
                  </div>
                </motion.div>

                {/* Import Card */}
                <motion.div variants={fadeUp}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                  />
                  <div
                    onClick={handleImportClick}
                    className={`h-full min-h-[160px] rounded-xl border-2 border-dashed border-border transition-all duration-300 flex flex-col items-center justify-center text-center p-6
                    ${importResume.isPending ? "opacity-70 cursor-not-allowed bg-muted/30" : "hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group"}
                  `}
                  >
                    {importResume.isPending ? (
                      <>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        </div>
                        <h3 className="font-medium text-sm">Importing...</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Extracting with AI
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <FileUp className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-medium text-sm">Import Resume</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload PDF or DOCX
                        </p>
                      </>
                    )}
                  </div>
                </motion.div>

                {/* Existing Resumes */}
                <AnimatePresence mode="popLayout">
                  {resumeList.map((resume, index) => (
                    <DashboardResumeCard
                      key={resume.id}
                      resume={resume}
                      fadeUp={fadeUp}
                      coarsePointer={coarsePointer}
                      navigate={navigate}
                      setRenameTitle={setRenameTitle}
                      setRenameId={(id) => {
                        setRenameType("resume");
                        setRenameId(id);
                      }}
                      setDeleteId={(id) => {
                        setDeleteType("resume");
                        setDeleteId(id);
                      }}
                      deleteId={deleteId}
                      handleDuplicateRequest={handleDuplicateRequest}
                      isDraggingThis={activeDragResumeId === resume.id}
                      setActiveDragResumeId={setActiveDragResumeId}
                      setIsOverTrash={setIsOverTrash}
                      onDragDelete={handleDragDeleteResume}
                      index={index}
                      onCreateCoverLetter={handleCreateCoverLetterFromResume}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )
          ) : coverLettersLoading ? (
            <PremiumLoadingScreen
              key="dashboard-cover-letters-loading"
              title="Fetching your cover letters"
              subtitle="Preparing your dashboard"
            />
          ) : (
            <motion.div
              key="dashboard-cover-letters-content"
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full"
            >
              {/* Generate Cover Letter Card */}
              <motion.div variants={fadeUp}>
                <div
                  onClick={() => setCreateCoverLetterOpen(true)}
                  className="h-full min-h-[160px] rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group p-6 text-center"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    Generate Cover Letter
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI-tailored to any job description
                  </p>
                </div>
              </motion.div>

              {/* Cover Letters List */}
              <AnimatePresence mode="popLayout">
                {coverLetterList.map((cl, idx) => (
                  <DashboardCoverLetterCard
                    key={cl.id}
                    coverLetter={cl}
                    fadeUp={fadeUp}
                    coarsePointer={coarsePointer}
                    navigate={navigate}
                    setRenameTitle={setRenameTitle}
                    setRenameId={(id) => {
                      setRenameType("cover-letter");
                      setRenameId(id);
                    }}
                    setDeleteId={(id) => {
                      setDeleteType("cover-letter");
                      setDeleteId(id);
                    }}
                    deleteId={deleteId}
                    handleDuplicateRequest={handleDuplicateCoverLetterRequest}
                    index={idx}
                    user={user}
                    isDraggingThis={activeDragCoverLetterId === cl.id}
                    setActiveDragCoverLetterId={setActiveDragCoverLetterId}
                    setIsOverTrash={setIsOverTrash}
                    onDragDelete={handleDragDeleteCoverLetter}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AppFooter />

      {/* Bottom Trash Zone */}
      <AnimatePresence>
        {(activeDragResumeId !== null ||
          activeDragCoverLetterId !== null ||
          isDeletedTrashPop) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-24 h-24 z-[100] pointer-events-none flex items-center justify-center"
          >
            <motion.div
              ref={trashBinRef}
              animate={{
                scale: isDeletedTrashPop ? 1.4 : isOverTrash ? 1.25 : 1,
                borderColor:
                  isOverTrash || isDeletedTrashPop
                    ? "rgba(244, 63, 94, 0.6)"
                    : "rgba(71, 85, 105, 0.4)",
                backgroundColor:
                  isOverTrash || isDeletedTrashPop
                    ? "rgba(76, 5, 25, 0.95)"
                    : "rgba(15, 23, 42, 0.85)",
                boxShadow:
                  isOverTrash || isDeletedTrashPop
                    ? "0 0 30px rgba(244, 63, 94, 0.4), inset 0 0 12px rgba(244, 63, 94, 0.2)"
                    : "0 10px 30px rgba(0, 0, 0, 0.25)",
              }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              style={{
                willChange: "transform",
                transform: "translateZ(0)",
              }}
              className="flex items-center justify-center w-16 h-16 rounded-full border backdrop-blur-md pointer-events-none"
            >
              <div
                className={isOverTrash ? "animate-trash-vibrate" : ""}
                style={{
                  willChange: "transform",
                  transform: "translateZ(0)",
                }}
              >
                <Trash2
                  className={`h-6 w-6 transition-colors duration-150 ${
                    isOverTrash ? "text-rose-400" : "text-slate-400"
                  }`}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) setStartWithSampleContent(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new resume</DialogTitle>
            <DialogDescription>
              Choose a title and whether to start from sample content or empty
              sections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Resume title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Software Engineer Resume"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const cfg = TEMPLATE_CONFIG["silicon-valley"] ?? {
                      accent: "#000000",
                    };
                    createResume.mutate({
                      data: {
                        title: newTitle,
                        templateId: "silicon-valley",
                        accentColor: cfg.accent,
                        startPrefilled: startWithSampleContent,
                      },
                    });
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1 pr-0 sm:pr-2">
                <Label htmlFor="start-sample" className="text-sm font-medium">
                  Sample starter content
                </Label>
                <p
                  id="start-sample-hint"
                  className="text-xs text-muted-foreground leading-snug"
                >
                  When on, your new resume includes example text so layouts look
                  filled. Turn off to start with empty fields for each template
                  section.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                <span className="text-xs text-muted-foreground sm:hidden">
                  Sample content
                </span>
                <Switch
                  id="start-sample"
                  checked={startWithSampleContent}
                  onCheckedChange={setStartWithSampleContent}
                  aria-describedby="start-sample-hint"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                const cfg = TEMPLATE_CONFIG["silicon-valley"] ?? {
                  accent: "#000000",
                };
                createResume.mutate({
                  data: {
                    title: newTitle,
                    templateId: "silicon-valley",
                    accentColor: cfg.accent,
                    startPrefilled: startWithSampleContent,
                  },
                });
              }}
              disabled={createResume.isPending || !newTitle.trim()}
            >
              {createResume.isPending ? "Creating..." : "Create resume"}
            </Button>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renameId !== null}
        onOpenChange={(o) => !o && setRenameId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename {renameType === "resume" ? "resume" : "cover letter"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename">New title</Label>
              <Input
                id="rename"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder={
                  renameType === "resume"
                    ? "e.g. Software Engineer Resume"
                    : "e.g. Cover Letter for Stripe"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameId !== null) {
                    if (renameType === "resume") {
                      updateResume.mutate({
                        id: renameId,
                        data: { title: renameTitle },
                      });
                    } else {
                      updateCoverLetter.mutate({
                        id: renameId,
                        data: { title: renameTitle },
                      });
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameId !== null) {
                  if (renameType === "resume") {
                    updateResume.mutate({
                      id: renameId,
                      data: { title: renameTitle },
                    });
                  } else {
                    updateCoverLetter.mutate({
                      id: renameId,
                      data: { title: renameTitle },
                    });
                  }
                }
              }}
              disabled={
                (renameType === "resume"
                  ? updateResume.isPending
                  : updateCoverLetter.isPending) || !renameTitle.trim()
              }
            >
              {(
                renameType === "resume"
                  ? updateResume.isPending
                  : updateCoverLetter.isPending
              )
                ? "Renaming..."
                : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Cover Letter dialog */}
      <Dialog
        open={createCoverLetterOpen}
        onOpenChange={setCreateCoverLetterOpen}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Tailored Cover Letter</DialogTitle>
            <DialogDescription>
              AI will analyze your resume and target job listing to write a
              personalized, high-conversion cover letter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-slate-800 dark:text-slate-100">
            <div className="space-y-2">
              <Label htmlFor="cl-title" className="text-slate-700 dark:text-slate-200 font-medium">
                Document Title
              </Label>
              <Input
                id="cl-title"
                value={clTitle}
                onChange={(e) => setClTitle(e.target.value)}
                placeholder="e.g. Cover Letter for Software Engineer at Google"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cl-resume" className="text-slate-700 dark:text-slate-200 font-medium">
                Reference Resume
              </Label>
              <select
                id="cl-resume"
                value={clResumeId}
                onChange={(e) =>
                  setClResumeId(e.target.value ? Number(e.target.value) : "")
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 custom-select text-slate-900 dark:text-slate-100"
              >
                <option value="">
                  -- Select a Resume (Highly Recommended) --
                </option>
                {resumeList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-3 text-slate-900 dark:text-slate-100">
                Job Details
              </h4>

              <div className="flex gap-2 mb-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label
                    htmlFor="cl-url"
                    className="text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Scrape Job Posting URL (Optional)
                  </Label>
                  <Input
                    id="cl-url"
                    value={clJobUrl}
                    onChange={(e) => setClJobUrl(e.target.value)}
                    placeholder="https://linkedin.com/jobs/view/... or any job site"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!clJobUrl || scrapeJob.isPending}
                  onClick={handleScrapeJobUrl}
                >
                  {scrapeJob.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Scrape"
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cl-job-title"
                    className="text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Job Title
                  </Label>
                  <Input
                    id="cl-job-title"
                    value={clJobTitle}
                    onChange={(e) => setClJobTitle(e.target.value)}
                    placeholder="e.g. Frontend Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cl-company"
                    className="text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Company Name
                  </Label>
                  <Input
                    id="cl-company"
                    value={clCompanyName}
                    onChange={(e) => setClCompanyName(e.target.value)}
                    placeholder="e.g. Stripe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cl-hiring-manager"
                    className="text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Hiring Manager (Optional)
                  </Label>
                  <Input
                    id="cl-hiring-manager"
                    value={clHiringManager}
                    onChange={(e) => setClHiringManager(e.target.value)}
                    placeholder="e.g. Recruiting Team"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cl-location"
                    className="text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Company Location (Optional)
                  </Label>
                  <Input
                    id="cl-location"
                    value={clCompanyLocation}
                    onChange={(e) => setClCompanyLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cl-desc" className="text-slate-700 dark:text-slate-200 font-medium">
                  Job Description
                </Label>
                <textarea
                  id="cl-desc"
                  rows={4}
                  value={clJobDescription}
                  onChange={(e) => setClJobDescription(e.target.value)}
                  placeholder="Paste the job description keywords, requirements, and responsibilities here..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col justify-between h-full gap-1.5">
                <Label htmlFor="cl-tone" className="text-slate-700 dark:text-slate-200 font-medium">
                  Tone
                </Label>
                <select
                  id="cl-tone"
                  value={clTone}
                  onChange={(e) => setClTone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-select text-slate-900 dark:text-slate-100"
                >
                  <option value="professional">Professional</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="conversational">Conversational</option>
                  <option value="bold">Bold & Confident</option>
                  <option value="academic">Academic/Detailed</option>
                </select>
              </div>

              <div className="flex flex-col justify-between h-full gap-1.5">
                <Label htmlFor="cl-exp" className="text-slate-700 dark:text-slate-200 font-medium">
                  Exp. Level
                </Label>
                <select
                  id="cl-exp"
                  value={clExpLevel}
                  onChange={(e) => setClExpLevel(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-select text-slate-900 dark:text-slate-100"
                >
                  <option value="entry">Entry-Level</option>
                  <option value="mid">Mid-Level</option>
                  <option value="senior">Senior-Level</option>
                </select>
              </div>

              <div className="flex flex-col justify-between h-full gap-1.5">
                <Label
                  htmlFor="cl-template"
                  className="text-slate-700 dark:text-slate-200 font-medium"
                >
                  Template Style
                </Label>
                <select
                  id="cl-template"
                  value={clTemplateId}
                  onChange={(e) => setClTemplateId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-select text-slate-900 dark:text-slate-100"
                >
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                  <option value="creative">Creative</option>
                  <option value="elegant">Elegant</option>
                  <option value="professional">Professional</option>
                  <option value="startup">Startup</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="cl-instructions"
                className="text-slate-700 dark:text-slate-200 font-medium"
              >
                Custom Instructions (Optional)
              </Label>
              <textarea
                id="cl-instructions"
                rows={2}
                value={clCustomInstructions}
                onChange={(e) => setClCustomInstructions(e.target.value)}
                placeholder="e.g. Focus on my experience with cloud systems. Keep the introduction short."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row mt-4">
            <Button
              onClick={() => {
                generateCoverLetter.mutate({
                  data: {
                    flowType: clJobUrl
                      ? "jobUrl"
                      : clResumeId
                        ? "resume"
                        : "jobDescription",
                    resumeId: clResumeId || undefined,
                    jobTitle: clJobTitle,
                    companyName: clCompanyName,
                    companyLocation: clCompanyLocation || undefined,
                    hiringManagerName: clHiringManager || undefined,
                    jobDescription: clJobDescription || undefined,
                    tone: clTone,
                    experienceLevel: clExpLevel,
                    customInstructions: clCustomInstructions || undefined,
                    jobUrl: clJobUrl || undefined,
                  },
                });
              }}
              disabled={
                generateCoverLetter.isPending ||
                !clTitle.trim() ||
                !clJobTitle.trim() ||
                !clCompanyName.trim()
              }
              className={`text-xs sm:text-sm font-bold py-2.5 h-11 px-5 shadow-md transition-all duration-300 relative overflow-hidden ${
                generateCoverLetter.isPending
                  ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white cursor-not-allowed shadow-purple-500/20"
                  : "bg-primary hover:opacity-95 text-primary-foreground shadow-primary/10"
              }`}
            >
              {generateCoverLetter.isPending && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  style={{ backgroundSize: "200% 200%" }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {generateCoverLetter.isPending ? (
                  <>
                    <motion.svg
                      className="h-4.5 w-4.5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="opacity-25"
                      />
                      <motion.circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="56"
                        initial={{ strokeDashoffset: 56, rotate: 0 }}
                        animate={{
                          strokeDashoffset: [56, 14, 56],
                          rotate: [0, 360, 720],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </motion.svg>
                    <span>Generating Cover Letter...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate Cover Letter
                  </>
                )}
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setCreateCoverLetterOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteType === "resume" ? "resume" : "cover letter"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your{" "}
              {deleteType === "resume" ? "resume" : "cover letter"} and all its
              content will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId !== null) {
                  setOptimisticallyDeletedIds((prev) => [...prev, deleteId]);
                  if (deleteType === "resume") {
                    toast({ title: "Resume deleted" });
                    deleteResume.mutate({ id: deleteId });
                  } else {
                    toast({ title: "Cover letter deleted" });
                    deleteCoverLetter.mutate({ id: deleteId });
                  }
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[150]"
      />
    </div>
  );
}
