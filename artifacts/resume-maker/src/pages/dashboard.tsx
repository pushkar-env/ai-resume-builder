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
} from "@workspace/api-client-react";
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
  const showWatermark = user?.publicMetadata?.isPremium !== true;
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
      className="w-full h-full min-h-[1px] relative overflow-hidden bg-white pointer-events-none [content-visibility:visible]"
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
          hostClassName="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none"
          measureDeps={[templateId]}
        >
          <ResumeSkeleton templateId={templateId} />
        </ScaledResumeThumbnailShell>
      </div>

      {/* Preview overlay: mounts and fades in when ready */}
      {isReady && resume && (
        <div className="absolute inset-0 animate-fade-in">
          <ScaledResumeThumbnailShell
            hostClassName="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none"
            measureDeps={[
              resume.id,
              resume.templateId,
              resume.updatedAt,
              fontScale,
              showWatermark,
            ]}
          >
            <ResumePreview
              layout="continuous"
              resume={resume}
              accentColor={
                resume.accentColor ?? getDefaultAccentColor(resume.templateId)
              }
              fontScale={fontScale}
              fontColor={resume.fontColor ?? "#111827"}
              backgroundColor={resume.backgroundColor ?? "#ffffff"}
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

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
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
      const threshold = isTouch ? 24 : 8;
      const dist = Math.hypot(
        e.clientX - startPoint.current.x,
        e.clientY - startPoint.current.y,
      );
      if (dist > threshold) {
        clearTimeout(longPressTimer.current);
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

  const isDeleting = deleteId === resume.id;

  return (
    <motion.div
      variants={fadeUp}
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
        className={`h-full origin-center animate-fill-both ${
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
        onDragStart={() => {
          if (cardRef.current) {
            cardInitialRectRef.current = cardRef.current.getBoundingClientRect();
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
            } else if ((event as any).changedTouches && (event as any).changedTouches.length > 0) {
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
            const cardBottom = cardInitialRectRef.current.bottom + info.offset.y;

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
          const pointerOver = (
            pointerX >= trashLeft - pointerPadding &&
            pointerX <= trashRight + pointerPadding &&
            pointerY >= trashTop - pointerPadding &&
            pointerY <= trashBottom + pointerPadding
          );

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
                    y: -4,
                    scale: 1.012,
                    rotate: 0,
                    boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
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
          className={`h-full flex flex-col group border-border relative overflow-hidden select-none shadow transition-[box-shadow,border-color] duration-300 hover:shadow-xl hover:border-primary/45 ${
            isDraggingThis
              ? "border-primary/60 bg-background/90 backdrop-blur-md cursor-grabbing touch-none z-10"
              : "cursor-grab touch-pan-y"
          }`}
        >
          <div className="h-[220px] w-full border-b border-border/40 relative overflow-hidden shrink-0 isolate pointer-events-none">
            <ResumeThumbnail
              resumeId={resume.id}
              templateId={resume.templateId}
              isDragging={false}
              index={index}
            />
          </div>

          <CardContent className="p-5 flex-1 flex flex-col bg-card relative z-10 pointer-events-none">
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

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const coarsePointer = useCoarsePointer();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("My Resume");
  const [renameTitle, setRenameTitle] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [startWithSampleContent, setStartWithSampleContent] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDragResumeId, setActiveDragResumeId] = useState<number | null>(
    null,
  );
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isDeletedTrashPop, setIsDeletedTrashPop] = useState(false);
  const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState<number[]>([]);

  // Canvas particle burst refs & loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<any[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const trashBinRef = useRef<HTMLDivElement | null>(null);

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

    // Spawn 45 particles radiating upwards
    for (let i = 0; i < 45; i++) {
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
        decay: 0.012 + Math.random() * 0.016,
        gravity: 0.16,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        shape: Math.random() > 0.45 ? "sparkle" : (Math.random() > 0.45 ? "circle" : "square"),
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
          
          // Glow effect
          currentCtx.shadowBlur = 8;
          currentCtx.shadowColor = p.color;
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
    if (activeDragResumeId === null) return;

    const preventDefault = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    window.addEventListener("touchmove", preventDefault, { passive: false });

    return () => {
      window.removeEventListener("touchmove", preventDefault);
    };
  }, [activeDragResumeId]);

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
        await queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
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

  const handleDragDelete = useCallback(
    (id: number) => {
      // Trigger physically reactive scale pop on trash bin
      setIsDeletedTrashPop(true);
      setTimeout(() => setIsDeletedTrashPop(false), 300);

      // Play particle burst
      if (trashBinRef.current) {
        const rect = trashBinRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        triggerBurst(x, y);
      } else {
        triggerBurst(window.innerWidth / 2, window.innerHeight - 56);
      }

      // Add to optimistic deletion array, show toast immediately, & call mutation
      setOptimisticallyDeletedIds((prev) => [...prev, id]);
      toast({ title: "Resume deleted" });
      deleteResume.mutate({ id });

      // Trigger standard vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 40]);
      }
    },
    [deleteResume.mutate, triggerBurst],
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {(createResume.isPending || importResume.isPending) && (
        <PremiumLoadingScreen
          title={
            importResume.isPending ? "Importing your resume" : "Creating your resume"
          }
          subtitle={
            importResume.isPending
              ? "Extracting and structuring content with AI"
              : "Setting up sections and template"
          }
        />
      )}
      <SEO
        title="Dashboard | Resumesensei"
        description="Manage your AI-powered resumes and access premium templates."
      />
      <Navbar />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Resumes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and build your professional resumes
            </p>
          </div>
        </div>

        {resumesLoading ? (
          <PremiumLoadingScreen
            title="Fetching your resumes"
            subtitle="Preparing your dashboard"
          />
        ) : (
          <motion.div
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
            {resumeList.map((resume, index) => (
              <DashboardResumeCard
                key={resume.id}
                resume={resume}
                fadeUp={fadeUp}
                coarsePointer={coarsePointer}
                navigate={navigate}
                setRenameTitle={setRenameTitle}
                setRenameId={setRenameId}
                setDeleteId={setDeleteId}
                deleteId={deleteId}
                handleDuplicateRequest={handleDuplicateRequest}
                isDraggingThis={activeDragResumeId === resume.id}
                setActiveDragResumeId={setActiveDragResumeId}
                setIsOverTrash={setIsOverTrash}
                onDragDelete={handleDragDelete}
                index={index}
              />
            ))}
          </motion.div>
        )}
      </main>

      <AppFooter />

      {/* Bottom Trash Zone */}
      <AnimatePresence>
        {(activeDragResumeId !== null || isDeletedTrashPop) && (
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
                scale: isDeletedTrashPop ? 1.4 : (isOverTrash ? 1.25 : 1),
                borderColor: isOverTrash || isDeletedTrashPop
                  ? "rgba(244, 63, 94, 0.6)"
                  : "rgba(71, 85, 105, 0.4)",
                backgroundColor: isOverTrash || isDeletedTrashPop
                  ? "rgba(76, 5, 25, 0.95)"
                  : "rgba(15, 23, 42, 0.85)",
                boxShadow: isOverTrash || isDeletedTrashPop
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
            <DialogTitle>Rename resume</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename">New title</Label>
              <Input
                id="rename"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder="e.g. Software Engineer Resume"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameId !== null) {
                    updateResume.mutate({
                      id: renameId,
                      data: { title: renameTitle },
                    });
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
              onClick={() =>
                renameId !== null &&
                updateResume.mutate({
                  id: renameId,
                  data: { title: renameTitle },
                })
              }
              disabled={updateResume.isPending || !renameTitle.trim()}
            >
              {updateResume.isPending ? "Renaming..." : "Save changes"}
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
            <AlertDialogTitle>Delete resume?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your resume and all its content will
              be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId !== null) {
                  setOptimisticallyDeletedIds((prev) => [...prev, deleteId]);
                  toast({ title: "Resume deleted" });
                  deleteResume.mutate({ id: deleteId });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaywallDialog
        open={showPaywall}
        onOpenChange={setShowPaywall}
        title="Resume Limit Reached"
        description="Free users can only create 1 resume. Upgrade to Pro to create unlimited resumes and unlock premium templates."
      />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[150]"
      />
    </div>
  );
}
