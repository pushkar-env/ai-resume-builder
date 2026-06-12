import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useDeferredValue,
  ChangeEvent,
  MouseEvent,
} from "react";
import { useParams, useLocation } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Palette,
  LayoutTemplate,
  ArrowLeft,
  Loader2,
  FileDown,
  Star,
  Zap,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eraser,
  Sparkles,
  Wand2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Target,
  Undo,
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderGit,
  Award,
  Eye,
  EyeOff,
  Link,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { BuilderNavbar } from "@/components/layout/Navbar";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { measureResumePagedViewHeight } from "@/lib/measure-resume-paged-view";
import { SectionEditor } from "@/components/resume/SectionEditor";
import { TemplateThumbnail } from "@/components/resume/TemplateThumbnail";
import {
  getDefaultAccentColor,
  getDefaultFontFamily,
  getDefaultAtsScore,
  TEMPLATE_CONFIG,
} from "@/lib/template-config";
import { ProBadge } from "@/components/shared/ProBadge";
import { PaywallDialog } from "@/components/shared/PaywallDialog";
import { AtsPaywallDialog } from "@/components/shared/AtsPaywallDialog";
import { PremiumLoadingScreen } from "@/components/shared/PremiumLoadingScreen";
import { SEO } from "@/components/shared/SEO";
import {
  useGetResume,
  useUpdateResume,
  useGetAtsScore,
  useOptimizeResume,
  useListTemplates,
  getGetResumeQueryKey,
  getListResumesQueryKey,
  type ResumeDetail,
  useScrapeJobDetails,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { emptySectionContentForType } from "@/lib/empty-section-content";
import { buildSelfContainedExportHtml } from "@/lib/resume-export-html";
import {
  aiErrorDescription,
  createAiHeavyRequestOptions,
} from "@/lib/ai-request";
import {
  createPdfExportSignal,
  resumeOperationErrorMessage,
} from "@/lib/resume-api-request";

const ACCENT_COLORS = [
  { label: "Black", value: "#000000" },
  { label: "Blue", value: "#2563eb" },
  { label: "Slate", value: "#475569" },
  { label: "Teal", value: "#0d9488" },
  { label: "Rose", value: "#e11d48" },
  { label: "Amber", value: "#d97706" },
  { label: "Emerald", value: "#059669" },
  { label: "Indigo", value: "#4338ca" },
];

const PREVIEW_ZOOM_STEP = 0.05;
const PREVIEW_ZOOM_MIN = 0.25;
const PREVIEW_ZOOM_MAX = 3;
/** Default zoom when opening a resume on small screens (< lg). */
const MOBILE_DEFAULT_PREVIEW_ZOOM = 0.4;

function clampPreviewZoom(n: number) {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, n));
}

interface ThrottledColorPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (color: string) => void;
  isPremiumUser: boolean;
  onPaywall: () => void;
}

const ThrottledColorPicker = ({
  id,
  label,
  value,
  onChange,
  isPremiumUser,
  onPaywall,
}: ThrottledColorPickerProps) => {
  const [localValue, setLocalValue] = useState(value);
  const lastCloseTimeRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef(value);

  // Sync with prop changes (e.g. from template defaults or database load)
  useEffect(() => {
    setLocalValue(value);
    latestValueRef.current = value;
  }, [value]);

  // Handle window focus to track picker close
  useEffect(() => {
    const handleWindowFocus = () => {
      lastCloseTimeRef.current = Date.now();
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  // Flush any pending change immediately
  const flushChange = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (latestValueRef.current !== value) {
      onChange(latestValueRef.current);
    }
  }, [value, onChange]);

  const lastUpdateRef = useRef(0);

  const handleColorInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    latestValueRef.current = val;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= 80) {
      // Throttle: Update parent state immediately if at least 80ms has passed since last update
      onChange(val);
      lastUpdateRef.current = now;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Debounce backup: Queue update for when dragging/interaction stops
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChange(latestValueRef.current);
        lastUpdateRef.current = Date.now();
        timeoutRef.current = null;
      }, 80);
    }
  };

  const handleInputClick = (e: MouseEvent<HTMLInputElement>) => {
    const timeSinceLastClose = Date.now() - lastCloseTimeRef.current;
    if (timeSinceLastClose < 350) {
      // Prevent re-opening if it was just closed
      e.preventDefault();
    }
  };

  const handleInputBlur = () => {
    lastCloseTimeRef.current = Date.now();
    flushChange();
  };

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {isPremiumUser ? (
        <div className="relative flex h-9 w-full cursor-pointer touch-manipulation items-stretch rounded-md border border-input bg-background overflow-hidden hover:bg-muted/50 transition-colors">
          <span className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-[10px] font-semibold text-foreground/80">
            {localValue.toUpperCase()}
          </span>
          <span
            className="pointer-events-none absolute left-2 top-1/2 z-0 h-3 w-3 -translate-y-1/2 rounded-full border border-border"
            style={{ background: localValue }}
          />
          <input
            id={id}
            type="color"
            value={localValue}
            onChange={handleColorInputChange}
            onClick={handleInputClick}
            onBlur={handleInputBlur}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            aria-label={`Pick ${label.toLowerCase()} color`}
          />
        </div>
      ) : (
        <button
          type="button"
          className="relative flex h-9 w-full touch-manipulation items-stretch rounded-md border border-input bg-background text-left overflow-hidden hover:bg-muted/50 active:bg-muted/70 transition-colors"
          onClick={onPaywall}
          aria-label={`${label} color is a Pro feature. Tap to learn more.`}
        >
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground/80">
            {localValue.toUpperCase()}
          </span>
          <span
            className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-border"
            style={{ background: localValue }}
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" aria-hidden>
            <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
          </span>
        </button>
      )}
    </div>
  );
};

function initialPreviewZoomForViewport(): number {
  if (typeof window === "undefined") return 1;
  return window.innerWidth < 1024
    ? clampPreviewZoom(MOBILE_DEFAULT_PREVIEW_ZOOM)
    : 1;
}

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  {
    label: "Plus Jakarta Sans",
    value: "'Plus Jakarta Sans', sans-serif",
    isPremium: true,
  },
  {
    label: "IBM Plex Sans",
    value: "'IBM Plex Sans', sans-serif",
    isPremium: true,
  },
  { label: "Sora", value: "Sora, sans-serif", isPremium: true },
  {
    label: "General Sans",
    value: "'General Sans', sans-serif",
    isPremium: true,
  },
];

type Section = NonNullable<ResumeDetail["sections"]>[number];
type SectionContent = Record<string, unknown>;

/* ─── Helpers ─── */

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  downloadFileBlob(blob, filename);
}

/** Safe for Windows/macOS/Linux and mobile download APIs. */
function safeFileBaseName(title: string): string {
  const base = title.trim().replace(/\s+/g, "_") || "resume";
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120);
}

function downloadFileBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke so Safari / mobile WebKit can start the download before the blob URL disappears.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/* ─── SortableSectionItem ─── */

function SortableSectionItem({
  section,
  isActive,
  onSelect,
}: {
  section: Section;
  isActive: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-3 lg:py-2 cursor-pointer transition-colors group ${
        isActive
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      }`}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-xs font-medium truncate">
        {section.title}
      </span>
      {section.isVisible === false && (
        <span className="text-[10px] text-muted-foreground">hidden</span>
      )}
      {isActive ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
      )}
    </div>
  );
}

/* ─── ExportDialog — client-side export with Free-plan watermark gate ─── */

function ExportDialog({
  open,
  onClose,
  resume,
  isPremiumUser,
  onRemoveWatermarkClick,
}: {
  open: boolean;
  onClose: () => void;
  resume: ResumeDetail;
  isPremiumUser: boolean;
  onRemoveWatermarkClick: () => void;
}) {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [freeStep, setFreeStep] = useState<"gate" | "formats">("gate");

  useEffect(() => {
    if (!open) return;
    setFreeStep(isPremiumUser ? "formats" : "gate");
  }, [open, isPremiumUser]);

  const handle = async (format: "pdf" | "docx" | "json") => {
    setLoading(format);
    try {
      const base = safeFileBaseName(resume.title ?? "");
      if (format === "json") {
        downloadBlob(
          JSON.stringify(resume, null, 2),
          `${base}.json`,
          "application/json",
        );
        toast({ title: "JSON downloaded" });
      } else if (format === "pdf") {
        const html = await buildSelfContainedExportHtml(
          resume.title || "Resume",
        );
        if (!html) {
          toast({
            title: "Could not capture resume preview",
            variant: "destructive",
          });
          return;
        }

        try {
          const token = await getToken();
          const apiUrl = import.meta.env.VITE_API_URL || "/api";
          const res = await fetch(`${apiUrl}/resumes/export-pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ html }),
            signal: createPdfExportSignal(),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(
              errData.details ||
                errData.error ||
                res.statusText ||
                "PDF generation failed",
            );
          }

          const blob = await res.blob();
          downloadFileBlob(blob, `${base}.pdf`);
          toast({ title: "PDF downloaded successfully" });
        } catch (error) {
          console.error(error);
          toast({
            title: "Failed to download PDF",
            description: resumeOperationErrorMessage(
              error,
              "Please try again in a moment.",
            ),
            variant: "destructive",
          });
        }
      } else {
        try {
          const { buildResumeDocxBlob } =
            await import("@/lib/build-resume-docx");
          const docxBlob = await buildResumeDocxBlob(resume, {
            includeWatermark: !isPremiumUser,
          });
          downloadFileBlob(docxBlob, `${base}.docx`);
          toast({
            title: "Word document downloaded",
            description:
              "Opens in Microsoft Word, Google Docs, Pages, and other compatible apps.",
          });
        } catch (err) {
          console.error("DOCX export failed", err);
          toast({
            title: "Could not create Word document",
            description:
              err instanceof Error
                ? err.message
                : "Please try again in a moment.",
            variant: "destructive",
          });
          return;
        }
      }
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const formats = [
    {
      id: "pdf" as const,
      label: "PDF Document",
      description: "ATS-optimized vector PDF, perfect for job applications",
    },
    {
      id: "docx" as const,
      label: "Word (.docx)",
      description: "Editable Office Open XML with stable layout in Word",
    },
    {
      id: "json" as const,
      label: "JSON Data",
      description: "Raw resume data (no visual watermark)",
    },
  ];

  const showFormats = isPremiumUser || freeStep === "formats";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showFormats ? "Choose export format" : "Export & watermark"}
          </DialogTitle>
          {showFormats ? (
            <DialogDescription>
              {isPremiumUser
                ? "Pick a format. Pro exports have no Resumesensei footer."
                : "PDF and Word match your on-screen preview, including the subtle footer mark. JSON is data-only."}
            </DialogDescription>
          ) : (
            <DialogDescription className="text-left text-sm leading-relaxed">
              On the Free plan, exports include a minimal Resumesensei line at
              the bottom of the page (same as in preview). Upgrade to Pro for
              clean, watermark-free PDF and Word files.
            </DialogDescription>
          )}
        </DialogHeader>

        {!showFormats ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 py-1">
            <button
              type="button"
              className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              onClick={() => setFreeStep("formats")}
              disabled={loading !== null}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Free
              </span>
              <span className="text-sm font-semibold text-foreground">
                Keep watermark
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                Continue to PDF, Word, or JSON — footer appears on PDF and Word
                like your preview.
              </span>
            </button>
            <button
              type="button"
              className="flex flex-col items-start gap-1.5 rounded-xl border-2 border-primary/30 bg-primary/[0.06] p-4 text-left shadow-sm transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              onClick={onRemoveWatermarkClick}
              disabled={loading !== null}
            >
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <ProBadge size="sm" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                Remove watermark
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                Clean exports plus all templates, unlimited AI, and ATS score
                tracking.
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {!isPremiumUser ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => setFreeStep("gate")}
              >
                ← Change watermark choice
              </button>
            ) : null}
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 group disabled:opacity-50"
                onClick={() => {
                  void handle(f.id);
                }}
                disabled={loading !== null}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileDown className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{f.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.description}
                    </p>
                  </div>
                  {loading === f.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function isResumeContentEmpty(sections: Section[]): boolean {
  if (!sections || sections.length === 0) return true;
  for (const s of sections) {
    const content = s.content as any;
    if (!content) continue;

    if (s.type === "personal") {
      if (
        (typeof content.name === "string" && content.name.trim() !== "") ||
        (typeof content.jobTitle === "string" && content.jobTitle.trim() !== "") ||
        (typeof content.email === "string" && content.email.trim() !== "") ||
        (typeof content.phone === "string" && content.phone.trim() !== "") ||
        (typeof content.location === "string" && content.location.trim() !== "")
      ) {
        return false;
      }
    } else if (s.type === "summary") {
      if (typeof content.text === "string" && content.text.trim() !== "") {
        return false;
      }
    } else if (Array.isArray(content.items) && content.items.length > 0) {
      for (const item of content.items) {
        if (!item) continue;
        const values = Object.values(item);
        if (values.some((val) => typeof val === "string" && val.trim() !== "")) {
          return false;
        }
      }
    }
  }
  return true;
}

function serializeResumeTextContent(sections: Section[]): string {
  if (!sections) return "";
  const sorted = [...sections].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.id.toString().localeCompare(b.id.toString());
  });

  let text = "";
  for (const s of sorted) {
    if (!s.isVisible) continue;
    const content = s.content as any;
    if (!content) continue;

    text += `||section:${s.type}`;
    if (s.type === "personal") {
      text += `|name:${content.name || ""}`;
      text += `|jobTitle:${content.jobTitle || ""}`;
      text += `|email:${content.email || ""}`;
      text += `|phone:${content.phone || ""}`;
      text += `|location:${content.location || ""}`;
    } else if (s.type === "summary") {
      text += `|text:${content.text || ""}`;
    } else if (Array.isArray(content.items)) {
      for (const item of content.items) {
        if (!item) continue;
        const keys = Object.keys(item).sort();
        for (const k of keys) {
          const val = item[k];
          if (typeof val === "string") {
            text += `|${k}:${val}`;
          } else if (Array.isArray(val)) {
            text += `|${k}:${val.join(",")}`;
          }
        }
      }
    }
  }
  return text;
}

function getSectionIcon(type: string) {
  switch (type) {
    case "personal":
      return User;
    case "summary":
      return FileText;
    case "experience":
      return Briefcase;
    case "education":
      return GraduationCap;
    case "skills":
      return Wrench;
    case "projects":
      return FolderGit;
    case "certifications":
      return Award;
    default:
      return FileText;
  }
}

function getSectionShortLabel(type: string, title: string) {
  switch (type) {
    case "personal":
      return "Profile";
    case "summary":
      return "Summary";
    case "experience":
      return "Work";
    case "education":
      return "Education";
    case "skills":
      return "Skills";
    case "projects":
      return "Projects";
    case "certifications":
      return "Awards";
    default:
      return title.slice(0, 10);
  }
}

function SortableRailItem({
  section,
  isActive,
  onSelect,
}: {
  section: Section;
  isActive: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getSectionIcon(section.type);
  const label = getSectionShortLabel(section.type, section.title);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group flex flex-col items-center w-full"
    >
      <span
        {...attributes}
        {...listeners}
        className="absolute left-0.5 top-5 cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-foreground z-20"
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </span>

      <button
        type="button"
        onClick={onSelect}
        className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all duration-200 relative select-none ${
          isActive
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
        } ${section.isVisible === false ? "opacity-50" : ""}`}
        title={`${section.title}${section.isVisible === false ? " (Hidden)" : ""}`}
      >
        <Icon className="h-4.5 w-4.5 mb-1 shrink-0" />
        <span className="text-[9px] font-semibold tracking-tight leading-none truncate w-full px-1.5 text-center">
          {label}
        </span>
        
        {section.isVisible === false && (
          <span className="absolute top-1 right-1 bg-muted-foreground/80 text-background rounded-full p-0.5 scale-75 border border-background">
            <EyeOff className="h-2 w-2" />
          </span>
        )}
      </button>
    </div>
  );
}

function SortableSectionMobileItem({
  section,
  isActive,
  onSelect,
}: {
  section: Section;
  isActive: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getSectionIcon(section.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border border-border p-3.5 bg-card hover:bg-muted/10 transition-colors ${
        isActive ? "border-primary/50 bg-primary/[0.01]" : ""
      }`}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </span>

      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate">
          {section.title}
        </p>
      </div>

      {section.isVisible === false && (
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
          Hidden
        </span>
      )}

      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
    </div>
  );
}

/* ─── BuilderPage ─── */

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const isPremiumUser = user?.publicMetadata?.isPremium === true;

  const resumeId = parseInt(id ?? "0");

  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [activeSidebarMode, setActiveSidebarMode] = useState<"content" | "design" | "ats">("content");
  const [localSections, setLocalSections] = useState<Section[]>([]);
  const [scannedContentText, setScannedContentText] = useState<string | null>(null);
  const [initialContentText, setInitialContentText] = useState<string | null>(null);
  const [wasInitiallyEmpty, setWasInitiallyEmpty] = useState<boolean>(false);
  const [accentColor, setAccentColor] = useState("#000000");
  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [fontColor, setFontColor] = useState("#111827");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fontScale, setFontScale] = useState<number>(() => {
    if (typeof window === "undefined" || !id) return 1.2;
    const v = window.localStorage.getItem(`resumeFontScale:${id}`);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1.2;
  });
  const [autoFit, setAutoFit] = useState<boolean>(() => {
    if (typeof window === "undefined" || !id) return true;
    const v = window.localStorage.getItem(`resumeAutoFit:${id}`);
    return v !== "false";
  });
  const [templateId, setTemplateId] = useState("modern");
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAtsPaywall, setShowAtsPaywall] = useState(false);
  const [paywallTitle, setPaywallTitle] = useState("Premium Feature");
  const [paywallDescription, setPaywallDescription] = useState(
    "This feature is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, and premium customization.",
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [atsPanelOpen, setAtsPanelOpen] = useState(false);
  const [isOptimizingWorkflow, setIsOptimizingWorkflow] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const progressSteps = useMemo(() => [
    "Analyzing target job description...",
    "Aligning resume summary with requirements...",
    "Tailoring professional experience...",
    "Refining target job title & details...",
    "Optimizing key skills matches...",
    "Auditing ATS score & final cleanup..."
  ], []);

  useEffect(() => {
    if (!isOptimizingWorkflow) return;
    setProgressStep(0);
    const interval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, progressSteps.length - 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [isOptimizingWorkflow, progressSteps]);


  const [mobileTab, setMobileTabRaw] = useState<"sections" | "edit" | "preview">(
    "sections",
  );
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** Page preview zoom (not font size). Desktop opens at 100%; mobile opens ~40%. */
  const [previewScale, setPreviewScale] = useState(() =>
    initialPreviewZoomForViewport(),
  );
  const previewScaleRef = useRef(previewScale);
  const [contentHeight, setContentHeight] = useState(1123);
  /** Bumped on section/content changes — avoids JSON.stringify on every edit for preview pagination. */
  const [previewRevision, setPreviewRevision] = useState(0);
  const bumpPreviewRevision = useCallback(() => {
    setPreviewRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    previewScaleRef.current = previewScale;
  }, [previewScale]);

  /** New resume or route change: desktop 100%; mobile preferred default (~40%). */
  useEffect(() => {
    setPreviewScale(initialPreviewZoomForViewport());
  }, [resumeId]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let raf1 = 0;
    let raf2 = 0;
    let raf3 = 0;
    const measure = () => {
      const next = measureResumePagedViewHeight(el);
      setContentHeight((prev) => (prev === next ? prev : next));
    };

    /** Triple RAF: pagination layout + mobile tab visibility need extra paint before heights are stable */
    const schedule = () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          raf3 = requestAnimationFrame(measure);
        });
      });
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    const paged = el.querySelector(".resume-paged-view");
    if (paged) ro.observe(paged);
    window.addEventListener("resize", schedule);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
    };
  }, [
    resumeId,
    previewRevision,
    templateId,
    fontScale,
    mobileTab,
    isPremiumUser,
  ]);

  /** Mobile: fit whole page in viewport. Desktop / wide: snap back to 100%. */
  const handleFitPreview = useCallback(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) {
      setPreviewScale(1);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const availableWidth = Math.max(1, width - 48);
    const availableHeight = Math.max(1, height - 140);
    const byWidth = availableWidth / 794;
    const byHeight = availableHeight / Math.max(1123, contentHeight);
    setPreviewScale(clampPreviewZoom(Math.min(1, byWidth, byHeight)));
  }, [contentHeight]);

  // Pinch-to-zoom — apply scale synchronously each move (avoid RAF lerping fights with gestures).
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number | null>(null);

  // Track which resume ID we've initialized from so re-fetches don't overwrite local edits
  const initializedResumeIdRef = useRef<number | null>(null);

  const { data: resume, isLoading } = useGetResume(resumeId, {
    query: {
      queryKey: getGetResumeQueryKey(resumeId),
      enabled: !!resumeId,
    },
  });

  /* Bind after skeleton unmount — ref is missing until the main editor DOM exists. Re-bind when Preview tab mounts on mobile. */
  useEffect(() => {
    if (isLoading) return;
    const el = containerRef.current;
    if (!el) return;

    const fingerDist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = fingerDist(e.touches);
        pinchStartScaleRef.current = previewScaleRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (
        e.touches.length === 2 &&
        pinchStartDistRef.current !== null &&
        pinchStartScaleRef.current !== null &&
        pinchStartDistRef.current > 8
      ) {
        e.preventDefault();
        const d = fingerDist(e.touches);
        const ratio = d / pinchStartDistRef.current;
        setPreviewScale(clampPreviewZoom(pinchStartScaleRef.current * ratio));
      }
    };

    const resetPinch = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null;
        pinchStartScaleRef.current = null;
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", resetPinch);
    el.addEventListener("touchcancel", resetPinch);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", resetPinch);
      el.removeEventListener("touchcancel", resetPinch);
    };
  }, [isLoading, mobileTab]);

  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [jobUrlText, setJobUrlText] = useState("");
  const { mutateAsync: scrapeJob, isPending: isScraping } = useScrapeJobDetails();
  const [scannedJobDescription, setScannedJobDescription] = useState("");
  const [scanTimestamp, setScanTimestamp] = useState<number>(0);

  const hasAtsScoreInDb = useMemo(() => {
    if (resume?.atsScore === null || resume?.atsScore === undefined) return false;
    const dbJd = (resume.atsJobDescription || "").trim();
    const currentJd = (scannedJobDescription || "").trim();
    return dbJd === currentJd;
  }, [resume?.atsScore, resume?.atsJobDescription, scannedJobDescription]);

  // Initialize job description from resume details
  useEffect(() => {
    if (resume?.atsJobDescription && !jobDescriptionText && !scannedJobDescription) {
      const trimmedJd = resume.atsJobDescription.trim();
      setJobDescriptionText(trimmedJd);
      setScannedJobDescription(trimmedJd);
    }
  }, [resume?.atsJobDescription, resumeId]);

  const { data: atsScoreData, isFetching: isAtsFetching, error: atsScanError } = useGetAtsScore(
    resumeId,
    {
      jobDescription: scannedJobDescription || undefined,
      forceScan: scanTimestamp > 0 ? true : undefined,
    },
    {
      query: {
        queryKey: ["/api/resumes", resumeId, "ats", scannedJobDescription, scanTimestamp],
        enabled: !!resumeId && isPremiumUser && scanTimestamp > 0,
        retry: 1,
      },
      request: createAiHeavyRequestOptions(),
    },
  );

  // Invalidate resume query on success to fetch updated ats fields and timestamp
  useEffect(() => {
    if (atsScoreData && scanTimestamp !== 0) {
      setScanTimestamp(0);
      
      // Save current content as the scanned baseline
      const serialContent = serializeResumeTextContent(localSections);
      setScannedContentText(serialContent);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`ats_scanned_sections_${resumeId}`, serialContent);
      }

      // Synchronously write the ATS fields and align updatedAt to prevent stale blink warnings
      queryClient.setQueryData(getGetResumeQueryKey(resumeId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          atsScore: atsScoreData.score,
          atsFeedback: atsScoreData.feedback,
          atsPassedChecks: atsScoreData.passedChecks,
          atsFailedChecks: atsScoreData.failedChecks,
          atsUpdatedAt: atsScoreData.atsUpdatedAt,
          atsJobDescription: scannedJobDescription ? scannedJobDescription.trim() : null,
          updatedAt: atsScoreData.atsUpdatedAt,
        };
      });

      void queryClient.invalidateQueries({
        queryKey: getGetResumeQueryKey(resumeId),
      });

      setIsOptimizingWorkflow(false);
    }
  }, [atsScoreData, scanTimestamp, resumeId, queryClient, scannedJobDescription, localSections]);

  // Handle ATS Scan errors to prevent loading screens from getting stuck
  useEffect(() => {
    if (atsScanError && scanTimestamp !== 0) {
      setScanTimestamp(0);
      setIsOptimizingWorkflow(false);
      toast({
        title: "Scan Failed",
        description: "Failed to recalculate ATS score after optimization.",
        variant: "destructive",
      });
    }
  }, [atsScanError, scanTimestamp]);

  const activeAtsData = atsScoreData || (hasAtsScoreInDb && resume ? {
    score: resume.atsScore ?? 0,
    maxScore: 100,
    feedback: resume.atsFeedback || [],
    passedChecks: resume.atsPassedChecks || [],
    failedChecks: resume.atsFailedChecks || [],
    atsUpdatedAt: resume.atsUpdatedAt,
  } : null);

  const isAtsOutdated = useMemo(() => {
    if (!resume) return false;

    // Case 1: An AI scan has been executed (activeAtsData is non-null)
    if (activeAtsData?.atsUpdatedAt) {
      if (scannedContentText !== null) {
        const currentSerialContent = serializeResumeTextContent(localSections);
        return currentSerialContent !== scannedContentText;
      }
      const updatedAtTime = new Date(resume.updatedAt).getTime();
      const atsUpdatedAtTime = new Date(activeAtsData.atsUpdatedAt).getTime();
      return updatedAtTime > atsUpdatedAtTime + 2000;
    }

    // Case 2: Resume has never been scanned (activeAtsData is null)
    // Show the exclamation mark once they make any text modifications from the initial state
    if (initialContentText !== null) {
      const currentSerialContent = serializeResumeTextContent(localSections);
      return currentSerialContent !== initialContentText;
    }

    return false;
  }, [resume, activeAtsData?.atsUpdatedAt, scannedContentText, initialContentText, localSections]);

  const displayedAtsScore = useMemo(() => {
    if (isResumeContentEmpty(localSections)) {
      return 0;
    }
    if (activeAtsData?.score !== undefined && activeAtsData?.score !== null) {
      return activeAtsData.score;
    }
    if (wasInitiallyEmpty) {
      return 0;
    }
    return getDefaultAtsScore(templateId);
  }, [localSections, activeAtsData?.score, wasInitiallyEmpty, templateId]);

  const handleScan = (jobDesc?: string) => {
    flushSave();
    setScannedJobDescription(jobDesc ? jobDesc.trim() : "");
    setScanTimestamp(Date.now());
  };

  const [previousSections, setPreviousSections] = useState<any[] | null>(null);
  const [previousAtsData, setPreviousAtsData] = useState<{
    score: number | null;
    passedChecks: string[] | null;
    failedChecks: string[] | null;
    feedback: string[] | null;
    atsUpdatedAt: string | null;
    atsJobDescription: string | null;
  } | null>(null);
  const [optimizationSummary, setOptimizationSummary] = useState<string | null>(null);

  const optimizeResumeMutation = useOptimizeResume({
    request: createAiHeavyRequestOptions(),
    mutation: {
      onSuccess: (data, variables) => {
        const resumeData = data.resume;
        // Update local resume query cache
        queryClient.setQueryData(getGetResumeQueryKey(resumeId), resumeData);
        
        // Update local states
        const nextSections = (resumeData.sections ?? []).map((s) => ({ ...s }));
        setLocalSections(nextSections);
        
        if (resumeData.accentColor) setAccentColor(resumeData.accentColor);
        if (resumeData.fontFamily) setFontFamily(resumeData.fontFamily);
        if (resumeData.fontColor) setFontColor(resumeData.fontColor);
        if (resumeData.backgroundColor) setBackgroundColor(resumeData.backgroundColor);
        if (resumeData.templateId) setTemplateId(resumeData.templateId);
        
        setOptimizationSummary(data.summary || "");

        toast({
          title: "Optimization Complete",
          description: "Your resume has been aligned and optimized by AI.",
        });
        
        // Trigger page recalculations
        bumpPreviewRevision();
        
        // Recalculate ATS Score against the scanned job description
        const jd = variables?.data?.jobDescription || "";
        handleScan(jd);
      },
      onError: (err: unknown) => {
        setIsOptimizingWorkflow(false);
        toast({
          title: "Optimization Failed",
          description: aiErrorDescription(err, "Failed to optimize resume."),
          variant: "destructive",
        });
      },
    },
  });

  const { data: templates } = useListTemplates();

  const templateList = useMemo(
    () => (Array.isArray(templates) ? templates : []),
    [templates],
  );

  const updateResume = useUpdateResume({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetResumeQueryKey(resumeId), data);
        void queryClient.invalidateQueries({
          queryKey: getListResumesQueryKey(),
        });
      },
      // Handle errors per-save attempt to avoid stale failures showing toasts.
    },
  });

  const saveSeqRef = useRef(0);
  const latestSaveSeqRef = useRef(0);

  // Only initialize local state the first time this resume loads (not on every save/re-fetch).
  // Preserve the user's currently selected section whenever it still exists.
  useEffect(() => {
    if (resume && resume.id !== initializedResumeIdRef.current) {
      initializedResumeIdRef.current = resume.id;
      const nextSections = (resume.sections ?? []).map((s) => ({ ...s }));
      setLocalSections(nextSections);
      setAccentColor(
        resume.accentColor ?? getDefaultAccentColor(resume.templateId),
      );
      setFontFamily(
        resume.fontFamily ?? getDefaultFontFamily(resume.templateId),
      );
      const defaultBg = resume.templateId === "midnight" ? "#0d1117" : "#ffffff";
      const defaultFg = resume.templateId === "midnight" ? "#f9fafb" : "#111827";
      setFontColor(resume.fontColor ?? defaultFg);
      setBackgroundColor(resume.backgroundColor ?? defaultBg);
      setTemplateId(resume.templateId ?? "modern");
      setActiveSectionId((prevActiveId) => {
        if (nextSections.length === 0) return null;
        if (
          prevActiveId != null &&
          nextSections.some((s) => s.id === prevActiveId)
        ) {
          return prevActiveId;
        }
        return nextSections[0].id;
      });

      // Initialize or load scanned content text cache for isAtsOutdated logic
      const serialContent = serializeResumeTextContent(nextSections);
      setInitialContentText(serialContent);
      setWasInitiallyEmpty(isResumeContentEmpty(nextSections));
      
      let loadedScannedContent: string | null = null;
      if (typeof window !== "undefined") {
        loadedScannedContent = window.localStorage.getItem(`ats_scanned_sections_${resume.id}`);
      }
      
      const hasAts = resume.atsScore !== null && resume.atsScore !== undefined;
      const atsUpdatedAtTime = resume.atsUpdatedAt ? new Date(resume.atsUpdatedAt).getTime() : 0;
      const updatedAtTime = resume.updatedAt ? new Date(resume.updatedAt).getTime() : 0;
      const isAtsCleanOnDb = hasAts && atsUpdatedAtTime >= updatedAtTime - 2000;
      
      if (hasAts && (isAtsCleanOnDb || !loadedScannedContent)) {
        setScannedContentText(serialContent);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(`ats_scanned_sections_${resume.id}`, serialContent);
        }
      } else if (loadedScannedContent) {
        setScannedContentText(loadedScannedContent);
      }
    }
  }, [resume]);

  // Reload font scale and color when switching resumes (per-resume persistence)
  const fontScaleHydratedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    const v = window.localStorage.getItem(`resumeFontScale:${id}`);
    const n = v ? Number(v) : NaN;
    setFontScale(Number.isFinite(n) && n > 0 ? n : 1.2);
    const autoFitVal = window.localStorage.getItem(`resumeAutoFit:${id}`);
    setAutoFit(autoFitVal !== "false");

    fontScaleHydratedFor.current = id;
  }, [id]);

  // Persist font scale and auto fit per-resume
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    if (fontScaleHydratedFor.current !== id) return;
    window.localStorage.setItem(`resumeFontScale:${id}`, String(fontScale));
    window.localStorage.setItem(`resumeAutoFit:${id}`, String(autoFit));
  }, [fontScale, autoFit, id]);

  // Reset when navigating to a different resume
  useEffect(() => {
    initializedResumeIdRef.current = null;
  }, [resumeId]);

  const scheduleSave = useCallback(
    (
      sections: Section[],
      accent: string,
      font: string,
      template: string,
      fColor: string,
      bColor: string,
    ) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const seq = ++saveSeqRef.current;
      latestSaveSeqRef.current = seq;
      saveTimeoutRef.current = setTimeout(() => {
        updateResume.mutate(
          {
            id: resumeId,
            data: {
              accentColor: accent,
              fontFamily: font,
              fontColor: fColor,
              backgroundColor: bColor,
              templateId: template,
              sections: sections.map((s) => ({
                id: s.id,
                content: s.content as Record<string, unknown>,
                displayOrder: s.displayOrder,
                isVisible: s.isVisible,
              })),
            },
          },
          {
            onError: (err: unknown) => {
              // Only show errors for the latest attempted save.
              if (seq !== latestSaveSeqRef.current) return;
              const msg = (err as { message?: string })?.message ?? "";
              // Ignore common "request cancelled" style errors.
              if (/aborted|cancelled|canceled|AbortError/i.test(msg)) return;
              toast({
                title: "Failed to save",
                description: msg || undefined,
                variant: "destructive",
              });
            },
          },
        );
      }, 800);
    },
    [resumeId, updateResume],
  );

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      
      const seq = ++saveSeqRef.current;
      latestSaveSeqRef.current = seq;
      
      updateResume.mutate(
        {
          id: resumeId,
          data: {
            accentColor,
            fontFamily,
            fontColor,
            backgroundColor,
            templateId,
            sections: localSections.map((s) => ({
              id: s.id,
              content: s.content as Record<string, unknown>,
              displayOrder: s.displayOrder,
              isVisible: s.isVisible,
            })),
          },
        },
        {
          onError: (err: unknown) => {
            if (seq !== latestSaveSeqRef.current) return;
            const msg = (err as { message?: string })?.message ?? "";
            if (/aborted|cancelled|canceled|AbortError/i.test(msg)) return;
            toast({
              title: "Failed to save",
              description: msg || undefined,
              variant: "destructive",
            });
          },
        }
      );
    }
  }, [
    resumeId,
    updateResume,
    accentColor,
    fontFamily,
    fontColor,
    backgroundColor,
    templateId,
    localSections,
  ]);

  /**
   * Mobile tab switch — commit any in-flight IME composition / focused input,
   * then flush the debounced save, before actually toggling the visible panel.
   *
   * Why this is needed:
   * On mobile soft keyboards (especially iOS), switching away from the edit
   * panel hides the input via CSS (`display:none`). The browser cancels any
   * active IME composition without firing a final `onChange`, so the last
   * character(s) the user typed are silently lost. By blurring the active
   * element first, we force the composition to commit and its `onChange` to
   * fire *before* the panel is hidden.
   */
  const switchMobileTab = useCallback(
    (tab: "sections" | "edit" | "preview") => {
      // 1. Blur the active element to commit any pending IME composition.
      //    This forces the browser to fire compositionend → onChange
      //    while the input is still visible in the DOM.
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        typeof (active as HTMLElement).blur === "function"
      ) {
        (active as HTMLElement).blur();
      }

      // 2. Use rAF to let the blur-triggered onChange propagate through
      //    React's state update cycle before we switch tabs. This ensures
      //    localSections has the latest value when the preview renders.
      requestAnimationFrame(() => {
        setMobileTabRaw(tab);
        // 3. Flush any pending debounced save so the server is in sync.
        flushSave();
      });
    },
    [flushSave],
  );
  const handleSectionContentChange = useCallback(
    (sectionId: number, content: SectionContent) => {
      setLocalSections((prev) => {
        const updated = prev.map((s) =>
          s.id === sectionId ? { ...s, content } : s,
        );
        scheduleSave(
          updated,
          accentColor,
          fontFamily,
          templateId,
          fontColor,
          backgroundColor,
        );
        return updated;
      });
      bumpPreviewRevision();
    },
    [
      accentColor,
      fontFamily,
      templateId,
      fontColor,
      backgroundColor,
      scheduleSave,
      bumpPreviewRevision,
    ],
  );

  const handleVisibilityToggle = useCallback(
    (sectionId: number) => {
      setLocalSections((prev) => {
        const updated = prev.map((s) =>
          s.id === sectionId
            ? { ...s, isVisible: s.isVisible !== false ? false : true }
            : s,
        );
        scheduleSave(
          updated,
          accentColor,
          fontFamily,
          templateId,
          fontColor,
          backgroundColor,
        );
        return updated;
      });
      bumpPreviewRevision();
    },
    [
      accentColor,
      fontFamily,
      templateId,
      fontColor,
      backgroundColor,
      scheduleSave,
      bumpPreviewRevision,
    ],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setLocalSections((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        const reordered = [...prev];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        const withOrder = reordered.map((s, i) => ({ ...s, displayOrder: i }));
        scheduleSave(
          withOrder,
          accentColor,
          fontFamily,
          templateId,
          fontColor,
          backgroundColor,
        );
        return withOrder;
      });
      bumpPreviewRevision();
    },
    [
      accentColor,
      fontFamily,
      templateId,
      fontColor,
      backgroundColor,
      scheduleSave,
      bumpPreviewRevision,
    ],
  );

  const handleAccentChange = (color: string) => {
    const isPreset = ACCENT_COLORS.find((c) => c.value === color);
    if (!isPremiumUser && !isPreset) {
      setPaywallTitle("Premium Color Picker");
      setPaywallDescription(
        "Custom colors and premium palettes are reserved for Pro users. Upgrade to unlock all customization options.",
      );
      setShowPaywall(true);
      return;
    }
    setAccentColor(color);
    scheduleSave(
      localSections,
      color,
      fontFamily,
      templateId,
      fontColor,
      backgroundColor,
    );
    bumpPreviewRevision();
  };

  const handleFontChange = (font: string) => {
    const fontObj = FONT_OPTIONS.find((f) => f.value === font);
    if (!isPremiumUser && fontObj?.isPremium) {
      setPaywallTitle("Premium Font");
      setPaywallDescription(
        `The ${fontObj.label} font is reserved for Pro users. Upgrade to unlock all premium typography options.`,
      );
      setShowPaywall(true);
      return;
    }
    setFontFamily(font);
    scheduleSave(
      localSections,
      accentColor,
      font,
      templateId,
      fontColor,
      backgroundColor,
    );
    bumpPreviewRevision();
  };

  const handleTemplateChange = (t: string) => {
    const template = templateList.find((temp) => temp.id === t) ?? null;
    if (template?.isPremium && !isPremiumUser) {
      setPaywallTitle("Premium Template");
      setPaywallDescription(
        "This template is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, and ATS optimization.",
      );
      setShowPaywall(true);
      return;
    }
    setTemplateId(t);
    const newFont = getDefaultFontFamily(t);
    setFontFamily(newFont);
    const newAccent = getDefaultAccentColor(t);
    setAccentColor(newAccent);
    const newBg = t === "midnight" ? "#0d1117" : "#ffffff";
    const newFg = t === "midnight" ? "#f9fafb" : "#111827";
    setBackgroundColor(newBg);
    setFontColor(newFg);
    scheduleSave(
      localSections,
      newAccent,
      newFont,
      t,
      newFg,
      newBg,
    );
    bumpPreviewRevision();
  };

  const showFontColorPaywall = useCallback(() => {
    setPaywallTitle("Premium Text Color");
    setPaywallDescription(
      "Custom text colors are reserved for Pro users. Upgrade to unlock full color customization.",
    );
    setShowPaywall(true);
  }, []);

  const showBackgroundColorPaywall = useCallback(() => {
    setPaywallTitle("Premium Background Color");
    setPaywallDescription(
      "Custom background colors are reserved for Pro users. Upgrade to unlock full color customization.",
    );
    setShowPaywall(true);
  }, []);

  const showAccentCustomPaywall = useCallback(() => {
    setPaywallTitle("Premium Color Picker");
    setPaywallDescription(
      "Custom colors and premium palettes are reserved for Pro users. Upgrade to unlock all customization options.",
    );
    setShowPaywall(true);
  }, []);

  const handleFontColorChange = (color: string) => {
    if (!isPremiumUser) {
      showFontColorPaywall();
      return;
    }
    setFontColor(color);
    scheduleSave(
      localSections,
      accentColor,
      fontFamily,
      templateId,
      color,
      backgroundColor,
    );
    bumpPreviewRevision();
  };

  const handleBackgroundColorChange = (color: string) => {
    if (!isPremiumUser) {
      showBackgroundColorPaywall();
      return;
    }
    setBackgroundColor(color);
    scheduleSave(
      localSections,
      accentColor,
      fontFamily,
      templateId,
      fontColor,
      color,
    );
    bumpPreviewRevision();
  };

  const handleClearAllSections = useCallback(() => {
    setWasInitiallyEmpty(true);
    setLocalSections((prev) => {
      const updated = prev.map((s) => ({
        ...s,
        content: emptySectionContentForType(s.type) as SectionContent,
      }));
      scheduleSave(
        updated,
        accentColor,
        fontFamily,
        templateId,
        fontColor,
        backgroundColor,
      );
      return updated;
    });
    setClearAllOpen(false);
    bumpPreviewRevision();
    toast({
      title: "Resume content cleared",
      description: "All sections are now empty.",
    });
  }, [
    accentColor,
    fontFamily,
    templateId,
    fontColor,
    backgroundColor,
    scheduleSave,
    bumpPreviewRevision,
    toast,
  ]);

  const handleScrapeJobUrl = useCallback(async () => {
    if (!jobUrlText.trim()) return;
    try {
      const result = await scrapeJob({ data: { url: jobUrlText.trim() } });
      toast({
        title: "Job details imported",
        description: "Successfully fetched job posting details.",
      });

      if (result.description) {
        setJobDescriptionText(result.description);
      }

      if (result.jobTitle) {
        const personalSection = localSections.find((s) => s.type === "personal");
        if (personalSection) {
          const currentContent = (personalSection.content || {}) as any;
          const updatedContent = {
            ...currentContent,
            jobTitle: result.jobTitle,
          };
          handleSectionContentChange(personalSection.id, updatedContent);
          toast({
            title: "Updated Target Job Role",
            description: `Set target role to "${result.jobTitle}".`,
          });
        }
      }

    } catch (err: any) {
      toast({
        title: "Failed to import job details",
        description: err?.message || "Please check the URL or paste the description manually.",
        variant: "destructive",
      });
    }
  }, [jobUrlText, scrapeJob, localSections, handleSectionContentChange, toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    /* Long-press to drag on touch — avoids fighting vertical scroll in the sections list. */
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeSection = localSections.find((s) => s.id === activeSectionId);

  const previewResume: ResumeDetail = resume
    ? {
        ...resume,
        sections: localSections,
        accentColor,
        fontFamily,
        fontColor,
        backgroundColor,
        templateId,
      }
    : {
        id: resumeId,
        title: "",
        userId: "",
        templateId,
        accentColor,
        fontFamily,
        fontColor,
        backgroundColor,
        isPublic: false,
        shareToken: null,
        viewCount: 0,
        downloadCount: 0,
        createdAt: "",
        updatedAt: "",
        sections: localSections,
      };

  const deferredPreview = useDeferredValue({
    resume: previewResume,
    revision: previewRevision,
  });

  if (isLoading) {
    return <PremiumLoadingScreen title="Setting up your workspace" />;
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <SEO
        title={`${resume?.title || "Untitled Resume"} - Editor | Resumesensei`}
        description="Edit your professional resume with real-time AI suggestions."
        robots="noindex, nofollow"
      />
      <BuilderNavbar
        title={resume?.title ?? ""}
        atsScore={isPremiumUser ? displayedAtsScore : undefined}
        isAtsOutdated={isPremiumUser ? isAtsOutdated : false}
        isAtsFetching={isPremiumUser ? isAtsFetching : false}
        atsPremiumLocked={!isPremiumUser}
        onAtsPremiumClick={() => {
          setShowAtsPaywall(true);
        }}
        onAtsScoreClick={() => {
          setActiveSidebarMode("ats");
          if (window.innerWidth < 1024) setMobileTabRaw("edit");
        }}
        onExport={() => setExportOpen(true)}
        onRename={(newTitle) => {
          // Optimistically update the title in the cache before the request fires.
          // onMutate is not supported in per-call mutate() options (only onSuccess/onError/onSettled are).
          void queryClient.cancelQueries({
            queryKey: getGetResumeQueryKey(resumeId),
          });
          const previous = queryClient.getQueryData<ResumeDetail>(
            getGetResumeQueryKey(resumeId),
          );
          if (previous) {
            queryClient.setQueryData<ResumeDetail>(
              getGetResumeQueryKey(resumeId),
              {
                ...previous,
                title: newTitle,
              },
            );
          }
          updateResume.mutate(
            { id: resumeId, data: { title: newTitle } },
            {
              onError: () => {
                // Roll back to the previous cache value on failure.
                if (previous) {
                  queryClient.setQueryData(
                    getGetResumeQueryKey(resumeId),
                    previous,
                  );
                }
              },
            },
          );
        }}
      />

      <div className="flex flex-1 overflow-hidden relative pb-14 lg:pb-0">
        {/* Unified Left Edit Panel */}
        <aside
          className={`w-full lg:w-[560px] border-r border-border bg-background flex shrink-0 overflow-hidden min-h-0 ${
            mobileTab === "sections" || mobileTab === "edit" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* 1. Far-left navigation rail (desktop only) */}
          <div className="hidden lg:flex w-[76px] border-r border-border bg-muted/10 flex-col items-center py-4 shrink-0 justify-between select-none">
            <div className="flex flex-col items-center gap-4 w-full">
              {/* Design Tab */}
              <button
                type="button"
                onClick={() => setActiveSidebarMode("design")}
                className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                  activeSidebarMode === "design"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
                title="Design & Template Styles"
              >
                <Palette className="h-4.5 w-4.5 mb-1 shrink-0" />
                <span className="text-[9px] font-semibold tracking-tight leading-none text-center">
                  Design
                </span>
              </button>

              <div className="w-8 h-px bg-border/60" />

              {/* Sortable Content Sections */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localSections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2.5 w-full flex flex-col items-center">
                    {localSections.map((s) => (
                      <SortableRailItem
                        key={s.id}
                        section={s}
                        isActive={activeSidebarMode === "content" && activeSectionId === s.id}
                        onSelect={() => {
                          setActiveSidebarMode("content");
                          setActiveSectionId(s.id);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* ATS Audit Tab at bottom */}
            <div className="w-full flex flex-col items-center">
              <div className="w-8 h-px bg-border/60 mb-4" />
              <button
                type="button"
                onClick={() => {
                  if (!isPremiumUser) {
                    setShowAtsPaywall(true);
                    return;
                  }
                  setActiveSidebarMode("ats");
                }}
                className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all duration-200 relative ${
                  activeSidebarMode === "ats"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
                title="ATS Score & Auditor"
              >
                {!isPremiumUser && (
                  <span className="absolute top-1 right-1 text-amber-500">
                    <Star className="h-2.5 w-2.5 fill-current" />
                  </span>
                )}
                <Zap className={`h-4.5 w-4.5 mb-1 shrink-0 ${activeSidebarMode === "ats" ? "text-primary-foreground fill-current" : "text-amber-500 fill-amber-500/20"}`} />
                <span className="text-[9px] font-semibold tracking-tight leading-none text-center">
                  ATS Audit
                </span>
                {isAtsOutdated && isPremiumUser && (
                  <span className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center rounded-full bg-amber-500 shadow-sm ring-1 ring-background" />
                )}
              </button>
            </div>
          </div>

          {/* 2. Main Edit Panel Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
            {/* Header (only shown if not in Mobile Dashboard view) */}
            {!(mobileTab === "sections" && window.innerWidth < 1024) && (
              <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden h-8 w-8 p-0"
                    onClick={() => setMobileTabRaw("sections")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-sm font-bold text-foreground truncate">
                    {activeSidebarMode === "design"
                      ? "Design & Style"
                      : activeSidebarMode === "ats"
                        ? "ATS Auditor"
                        : activeSection?.title ?? "Select a section"}
                  </h2>
                </div>
                
                {/* Visibility Toggle directly in the header for sections */}
                {activeSidebarMode === "content" && activeSection && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleVisibilityToggle(activeSection.id)}
                  >
                    {activeSection.isVisible !== false ? (
                      <>
                        <Eye className="h-4 w-4 text-primary" />
                        <span className="hidden sm:inline">Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 text-muted-foreground/60" />
                        <span className="hidden sm:inline text-muted-foreground/60">Hidden</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Scrollable Form Body */}
            <ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:!min-w-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
              {/* Mobile Dashboard View */}
              {mobileTab === "sections" && window.innerWidth < 1024 ? (
                <div className="p-4 space-y-4 lg:hidden">
                  {/* Quick Dashboard Navigation & Clear Data Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/dashboard")}
                      className="h-10 gap-2 text-xs font-semibold border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-sm flex items-center justify-center"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                      Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setClearAllOpen(true)}
                      className="h-10 gap-2 text-xs font-semibold border-border bg-card text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 rounded-xl transition-all shadow-sm flex items-center justify-center"
                      disabled={localSections.length === 0}
                    >
                      <Eraser className="h-3.5 w-3.5 shrink-0" />
                      Clear Data
                    </Button>
                  </div>

                  {/* System Quick Cards (Design & ATS Auditor) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Design Card */}
                    <button
                      onClick={() => {
                        setActiveSidebarMode("design");
                        setMobileTabRaw("edit");
                      }}
                      className={`flex flex-col items-start p-4 rounded-xl border border-border bg-card shadow-sm hover:bg-muted/30 transition-all text-left ${
                        activeSidebarMode === "design" ? "border-primary/50 bg-primary/[0.02]" : ""
                      }`}
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                        <Palette className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-foreground">Design & Style</span>
                      <span className="text-[10px] text-muted-foreground mt-1 leading-normal">
                        Templates, fonts & colors
                      </span>
                    </button>

                    {/* ATS Auditor Card */}
                    <button
                      onClick={() => {
                        if (!isPremiumUser) {
                          setShowAtsPaywall(true);
                          return;
                        }
                        setActiveSidebarMode("ats");
                        setMobileTabRaw("edit");
                      }}
                      className={`flex flex-col items-start p-4 rounded-xl border border-border bg-card shadow-sm hover:bg-muted/30 transition-all text-left relative ${
                        activeSidebarMode === "ats" ? "border-primary/50 bg-primary/[0.02]" : ""
                      }`}
                    >
                      {!isPremiumUser && (
                        <span className="absolute top-2 right-2 text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </span>
                      )}
                      <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                        <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                      </div>
                      <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        ATS Auditor
                        {isAtsOutdated && isPremiumUser && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1 leading-normal">
                        Score & keyword matching
                      </span>
                    </button>
                  </div>

                  {/* Sections Header */}
                  <div className="pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                      Resume Sections
                    </h3>
                    
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={localSections.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {localSections.map((s) => {
                            const isActive = activeSidebarMode === "content" && activeSectionId === s.id;
                            return (
                              <SortableSectionMobileItem
                                key={s.id}
                                section={s}
                                isActive={isActive}
                                onSelect={() => {
                                  setActiveSidebarMode("content");
                                  setActiveSectionId(s.id);
                                  setMobileTabRaw("edit");
                                }}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              ) : (
                /* Desktop and active Edit Views */
                <div className="p-5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    {activeSidebarMode === "design" && (
                      <motion.div
                        key="design"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="space-y-6"
                      >
                      {/* Template Gallery */}
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                          Choose Template
                        </h3>
                        <div className="grid grid-cols-2 gap-3.5">
                          {templateList.map((t) => {
                            const isSelected = templateId === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleTemplateChange(t.id)}
                                className={`flex flex-col text-left rounded-xl border-2 p-2 bg-card shadow-sm hover:border-primary/50 transition-all duration-200 relative overflow-hidden group ${
                                  isSelected ? "border-primary ring-1 ring-primary/20" : "border-border"
                                }`}
                              >
                                <div
                                  className="aspect-[3/4] w-full rounded-lg relative overflow-hidden border border-border/40 mb-2"
                                  style={{ background: TEMPLATE_CONFIG[t.id]?.bg ?? "#f8fafc" }}
                                >
                                  <TemplateThumbnail
                                    templateId={t.id}
                                    accent={isSelected ? accentColor : getDefaultAccentColor(t.id)}
                                    showWatermark={!isPremiumUser}
                                  />
                                  {t.isPremium && !isPremiumUser && (
                                    <span className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-1 shadow-md z-10">
                                      <Star className="h-3 w-3 fill-current" />
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-xs font-bold truncate">{t.name}</span>
                                  {isSelected && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-t border-border/60 my-4" />

                      {/* Typography Section */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Typography
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {/* Font Family */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Font Family</Label>
                            <Select value={fontFamily} onValueChange={handleFontChange}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FONT_OPTIONS.map((f) => (
                                  <SelectItem key={f.value} value={f.value} className="text-xs">
                                    <div className="flex items-center justify-between w-full">
                                      <span>{f.label}</span>
                                      {f.isPremium && !isPremiumUser && (
                                        <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500 ml-2" />
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Font Size */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Font Size</Label>
                            <Select
                              value={String(fontScale)}
                              onValueChange={(v) => {
                                setFontScale(Number(v));
                                bumpPreviewRevision();
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1" className="text-xs">Normal (100%)</SelectItem>
                                <SelectItem value="1.1" className="text-xs">Large (110%)</SelectItem>
                                <SelectItem value="1.2" className="text-xs">Extra Large (120%)</SelectItem>
                                <SelectItem value="1.35" className="text-xs">Huge (135%)</SelectItem>
                                <SelectItem value="1.5" className="text-xs">Massive (150%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Auto Fit Switch */}
                        <div className="flex items-center justify-between bg-muted/30 border border-border/50 rounded-xl p-3">
                          <div className="space-y-0.5">
                            <Label htmlFor="auto-fit" className="text-xs font-semibold text-foreground cursor-pointer">
                              Auto-Fit Page
                            </Label>
                            <p className="text-[10px] text-muted-foreground leading-normal">
                              Adjust spacing to fit content on the page perfectly.
                            </p>
                          </div>
                          <Switch
                            id="auto-fit"
                            checked={autoFit}
                            onCheckedChange={(v) => {
                              setAutoFit(v);
                              bumpPreviewRevision();
                            }}
                          />
                        </div>
                      </div>

                      <div className="border-t border-border/60 my-4" />

                      {/* Color Customization */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Color Theme
                        </h3>

                        <div className="grid grid-cols-3 gap-3">
                          <ThrottledColorPicker
                            id={`resume-accent-color-${resumeId}`}
                            label="Accent"
                            value={accentColor}
                            onChange={handleAccentChange}
                            isPremiumUser={isPremiumUser}
                            onPaywall={showAccentCustomPaywall}
                          />

                          <ThrottledColorPicker
                            id={`resume-font-color-${resumeId}`}
                            label="Text"
                            value={fontColor}
                            onChange={handleFontColorChange}
                            isPremiumUser={isPremiumUser}
                            onPaywall={showFontColorPaywall}
                          />

                          <ThrottledColorPicker
                            id={`resume-bg-color-${resumeId}`}
                            label="Background"
                            value={backgroundColor}
                            onChange={handleBackgroundColorChange}
                            isPremiumUser={isPremiumUser}
                            onPaywall={showBackgroundColorPaywall}
                          />
                        </div>
                      </div>
                      </motion.div>
                    )}

                    {/* ATS AUDITOR MODE */}
                    {activeSidebarMode === "ats" && (
                      <motion.div
                        key="ats"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="space-y-6"
                      >
                      <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                            <Target className="h-4 w-4 text-primary shrink-0" />
                            Job Description Match
                          </h4>
                          {scannedJobDescription && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                              Active Scan
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="ats-job-url" className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                              <Link className="h-3.5 w-3.5 text-primary shrink-0" />
                              Import from Job Posting URL
                            </Label>
                            <div className="flex gap-2">
                              <input
                                id="ats-job-url"
                                type="url"
                                placeholder="Paste LinkedIn, Indeed, or job listing URL..."
                                value={jobUrlText}
                                onChange={(e) => setJobUrlText(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={handleScrapeJobUrl}
                                disabled={isScraping || !jobUrlText.trim()}
                                className="h-9 text-xs px-3 font-semibold shrink-0"
                              >
                                {isScraping ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Import"
                                )}
                              </Button>
                            </div>
                          </div>

                          {(() => {
                            const personalSection = localSections.find((s) => s.type === "personal");
                            const currentJobTitle = (personalSection?.content as any)?.jobTitle || "";
                            return (
                              <div className="space-y-1.5">
                                <Label htmlFor="ats-job-title" className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                                  Target Job Title
                                </Label>
                                <input
                                  id="ats-job-title"
                                  type="text"
                                  placeholder="e.g. Software Engineer..."
                                  value={currentJobTitle}
                                  onChange={(e) => {
                                    if (personalSection) {
                                      const currentContent = (personalSection.content || {}) as any;
                                      const updatedContent = {
                                        ...currentContent,
                                        jobTitle: e.target.value,
                                      };
                                      handleSectionContentChange(personalSection.id, updatedContent);
                                    }
                                  }}
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </div>
                            );
                          })()}

                          <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-border/60"></div>
                            <span className="flex-shrink mx-2 text-[9px] text-muted-foreground uppercase font-bold tracking-wider">or Paste Job Description</span>
                            <div className="flex-grow border-t border-border/60"></div>
                          </div>

                          <textarea
                            value={jobDescriptionText}
                            onChange={(e) => setJobDescriptionText(e.target.value)}
                            placeholder="Paste the target job description here to calculate a tailored ATS compatibility score and get optimized keywords/suggestions..."
                            className="w-full min-h-[100px] text-xs p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y leading-relaxed"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleScan(jobDescriptionText)}
                              disabled={isAtsFetching}
                              className="flex-1 text-xs h-9 gap-1.5 font-semibold"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isAtsFetching ? "animate-spin" : ""}`} />
                              Scan Now
                            </Button>
                            
                            {jobDescriptionText && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setJobDescriptionText("")}
                                disabled={isAtsFetching}
                                className="h-9 text-xs px-3 hover:bg-muted"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* AI Optimize Button */}
                        {activeAtsData && (
                          <div className="pt-3 border-t border-border mt-1 space-y-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                flushSave();
                                if (resume) {
                                  if (resume.sections) {
                                    setPreviousSections(
                                      resume.sections.map((s) => ({
                                        id: s.id,
                                        type: s.type,
                                        title: s.title,
                                        content: s.content ? JSON.parse(JSON.stringify(s.content)) : null,
                                        displayOrder: s.displayOrder,
                                        isVisible: s.isVisible,
                                      }))
                                    );
                                  }
                                  setPreviousAtsData({
                                    score: resume.atsScore ?? null,
                                    passedChecks: resume.atsPassedChecks ?? null,
                                    failedChecks: resume.atsFailedChecks ?? null,
                                    feedback: resume.atsFeedback ?? null,
                                    atsUpdatedAt: resume.atsUpdatedAt ?? null,
                                    atsJobDescription: resume.atsJobDescription ?? null,
                                  });
                                }
                                const activeJd = jobDescriptionText ? jobDescriptionText.trim() : "";
                                setScannedJobDescription(activeJd);
                                setIsOptimizingWorkflow(true);

                                optimizeResumeMutation.mutate({
                                  id: resumeId,
                                  data: {
                                    jobDescription: activeJd || undefined,
                                  },
                                });
                                toast({
                                  title: "AI Optimization Started",
                                  description: "AI is analyzing and refining your resume content in the background...",
                                });
                              }}
                              disabled={optimizeResumeMutation.isPending}
                              className="w-full text-xs h-9 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              {scannedJobDescription ? "Optimize Resume with AI" : "Improve Resume with AI"}
                            </Button>

                            {/* AI Optimization Summary */}
                            {optimizationSummary && (
                              <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                    AI Changes Summary
                                  </h5>
                                  {previousSections && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (previousSections) {
                                          updateResume.mutate({
                                            id: resumeId,
                                            data: {
                                              sections: previousSections,
                                              atsScore: previousAtsData?.score,
                                              atsPassedChecks: previousAtsData?.passedChecks,
                                              atsFailedChecks: previousAtsData?.failedChecks,
                                              atsFeedback: previousAtsData?.feedback,
                                              atsUpdatedAt: previousAtsData?.atsUpdatedAt,
                                              atsJobDescription: previousAtsData?.atsJobDescription,
                                            },
                                          }, {
                                            onSuccess: (updatedData) => {
                                              const restoredSections = (updatedData.sections ?? []).map((s) => ({ ...s }));
                                              setLocalSections(restoredSections);
                                              if (previousAtsData) {
                                                setScannedJobDescription(previousAtsData.atsJobDescription || "");
                                              }
                                              setPreviousSections(null);
                                              setPreviousAtsData(null);
                                              setOptimizationSummary(null);
                                              toast({
                                                title: "Optimization Undone",
                                                description: "Your resume and original ATS score have been restored.",
                                              });
                                              bumpPreviewRevision();
                                            }
                                          });
                                        }
                                      }}
                                      disabled={updateResume.isPending}
                                      className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-primary gap-1"
                                    >
                                      <Undo className="h-2.5 w-2.5" />
                                      Undo
                                    </Button>
                                  )}
                                </div>
                                <div className="text-xs text-foreground/80 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                  {optimizationSummary.split("\n").filter(Boolean).map((line, idx) => {
                                    const cleanLine = line.replace(/^[\s*-]+/, "").trim();
                                    if (!cleanLine) return null;
                                    
                                    const parts = cleanLine.split(":**");
                                    if (parts.length === 2 && parts[0].startsWith("**")) {
                                      const title = parts[0].replace(/^\*\*/, "");
                                      return (
                                        <p key={idx} className="leading-relaxed text-[11px]">
                                          <strong className="text-foreground font-semibold">{title}:</strong>{parts[1]}
                                        </p>
                                      );
                                    }
                                    
                                    return <p key={idx} className="leading-relaxed text-[11px]">• {cleanLine}</p>;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Separator */}
                      <div className="border-t border-border/80 my-2" />

                      {/* Audit Results */}
                      {isAtsFetching ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <div className="text-center">
                            <p className="text-sm font-semibold">Running AI Audit...</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
                              Analyzing keyword density, achievement quantification, and job alignment.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Outdated Score Alert */}
                          {isAtsOutdated && activeAtsData && (
                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300 flex items-start justify-between gap-3 shadow-sm">
                              <div className="flex gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                                <div>
                                  <p className="font-semibold">Score Outdated</p>
                                  <p className="text-muted-foreground mt-0.5 leading-relaxed">
                                    You have edited the resume since the last scan. Run a rescan to get updated metrics.
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleScan(scannedJobDescription)}
                                className="h-7 text-[10px] px-2.5 font-bold hover:bg-amber-500/10 border-amber-500/20 text-amber-600 hover:text-amber-700 shrink-0 bg-background"
                              >
                                Rescan
                              </Button>
                            </div>
                          )}

                          {/* Score Circle & Verdict */}
                          <div className="flex items-center gap-6 p-4 rounded-xl border border-border bg-muted/40">
                            <div className="relative flex items-center justify-center shrink-0">
                              <svg className="w-24 h-24 transform -rotate-90">
                                <circle
                                  cx="48"
                                  cy="48"
                                  r="40"
                                  className="stroke-muted"
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                <circle
                                  cx="48"
                                  cy="48"
                                  r="40"
                                  className={`transition-all duration-500 ${
                                    displayedAtsScore >= 80
                                      ? "stroke-green-500"
                                      : displayedAtsScore >= 60
                                        ? "stroke-yellow-500"
                                        : "stroke-red-500"
                                  }`}
                                  strokeWidth="8"
                                  strokeDasharray={2 * Math.PI * 40}
                                  strokeDashoffset={
                                    2 * Math.PI * 40 * (1 - displayedAtsScore / 100)
                                  }
                                  strokeLinecap="round"
                                  fill="transparent"
                                />
                              </svg>
                              <span className="absolute text-2xl font-bold">
                                {displayedAtsScore}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-bold text-base">
                                {displayedAtsScore >= 80
                                  ? "Excellent Compatibility"
                                  : displayedAtsScore >= 60
                                    ? "Good Match, but improvable"
                                    : displayedAtsScore > 0
                                      ? "Needs Critical Optimization"
                                      : "Empty Resume"}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {displayedAtsScore >= 80
                                  ? "Your resume is highly optimized for applicant tracking systems. Excellent work!"
                                  : displayedAtsScore >= 60
                                    ? "A few optimizations could significantly improve your parser matching and keyword alignment."
                                    : displayedAtsScore > 0
                                      ? "Your resume is missing critical elements or alignment for the target job role. Please check details below."
                                      : "This resume is empty. Please enter your professional experience and details to calculate your ATS score."}
                              </p>
                            </div>
                          </div>

                          {/* Target Job Title Indicator */}
                          {(() => {
                            const personal = localSections.find((s) => s.type === "personal")?.content as any;
                            const titleStr = personal?.jobTitle || resume?.title || "Not specified";
                            return (
                              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-border bg-card text-xs">
                                <Target className="h-4 w-4 text-primary shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <span className="text-muted-foreground">Audit target job role:</span>
                                  <strong className="block text-foreground truncate mt-0.5">{titleStr}</strong>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Audit Details */}
                          {activeAtsData ? (
                            <>
                              {/* Failed / Critical Fixes */}
                              {Array.isArray(activeAtsData.failedChecks) && activeAtsData.failedChecks.length > 0 && (
                                <div className="space-y-3">
                                  <h5 className="text-xs font-semibold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    Critical Fixes ({activeAtsData.failedChecks.length})
                                  </h5>
                                  <ul className="space-y-2">
                                    {activeAtsData.failedChecks.map((check: string, idx: number) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-red-500/10 bg-red-500/5 text-xs text-foreground leading-relaxed"
                                      >
                                        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                        <span>{check}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Feedback / Recommendations */}
                              {Array.isArray(activeAtsData.feedback) && activeAtsData.feedback.length > 0 && (
                                <div className="space-y-3">
                                  <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                    Improvement Recommendations ({activeAtsData.feedback.length})
                                  </h5>
                                  <ul className="space-y-2">
                                    {activeAtsData.feedback.map((item: string, idx: number) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-500/10 bg-amber-500/5 text-xs text-foreground leading-relaxed"
                                      >
                                        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Passed Checks */}
                              {Array.isArray(activeAtsData.passedChecks) && activeAtsData.passedChecks.length > 0 && (
                                <div className="space-y-3">
                                  <h5 className="text-xs font-semibold uppercase tracking-wider text-green-500 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    Passed Checks ({activeAtsData.passedChecks.length})
                                  </h5>
                                  <ul className="space-y-2">
                                    {activeAtsData.passedChecks.map((check: string, idx: number) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-green-500/10 bg-green-500/5 text-xs text-foreground leading-relaxed"
                                      >
                                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>{check}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                              <AlertCircle className="h-6 w-6 mb-2 text-primary/70" />
                              <p className="text-xs font-semibold text-foreground">Baseline Score Displayed</p>
                              <p className="text-[11px] max-w-[280px] mt-1 leading-relaxed">
                                This is the baseline template compatibility score. Paste a target job description above and scan to generate tailored suggestions.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      </motion.div>
                    )}

                    {/* CONTENT EDIT MODE */}
                    {activeSidebarMode === "content" && (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                      >
                      {activeSection ? (
                        <motion.div
                          key={activeSection.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          <SectionEditor
                            section={
                              activeSection as {
                                id: number;
                                type: string;
                                title: string;
                                content: SectionContent;
                                isVisible?: boolean;
                              }
                            }
                            onChange={(content) =>
                              handleSectionContentChange(activeSection.id, content)
                            }
                            onVisibilityToggle={() =>
                              handleVisibilityToggle(activeSection.id)
                            }
                            resumeId={resumeId}
                            allSections={
                              localSections as {
                                id: number;
                                type: string;
                                content: SectionContent;
                              }[]
                            }
                            templateId={templateId}
                          />
                        </motion.div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select a section to edit it.
                        </p>
                      )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>

            {/* Pinned Footer (only shown if not in Mobile Dashboard view) */}
            {!(mobileTab === "sections" && window.innerWidth < 1024) && (
              <div className="border-t border-border p-3 lg:p-3.5 shrink-0 bg-background flex flex-row items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setMobileTabRaw("sections");
                    } else {
                      navigate("/dashboard");
                    }
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  <span>Back</span>
                </Button>

                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="flex items-center gap-1.5">
                    {updateResume.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Saving...</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Saved</span>
                    )}
                  </div>

                  {activeSidebarMode === "content" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="hidden lg:flex gap-1.5 h-8 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all shadow-sm"
                      onClick={() => setClearAllOpen(true)}
                      disabled={localSections.length === 0}
                    >
                      <Eraser className="h-3.5 w-3.5 shrink-0" />
                      <span>Clear</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right — live preview */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-x-auto overflow-y-auto bg-muted/40 flex-col py-6 touch-pan-x touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] lg:flex ${
            mobileTab === "preview"
              ? "flex"
              : "max-lg:fixed max-lg:-left-[100vw] max-lg:top-0 max-lg:z-0 max-lg:opacity-0 max-lg:pointer-events-none max-lg:w-[794px] max-lg:overflow-visible"
          }`}
          aria-hidden={mobileTab !== "preview" ? true : undefined}
        >
          {/* min-w-max + w-max lets content exceed viewport width so horizontal scroll works on touch (touch-pan-y alone blocked sideways panning). */}
          <div className="min-w-max w-max max-w-none flex flex-col items-center pb-20 relative px-4 mx-auto">
            <div className="mb-4 flex flex-col items-center justify-center gap-3">
              <span className="text-xs text-muted-foreground bg-background/50 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                Live Preview — A4
              </span>

              {/* Zoom Controls */}
              <div className="sticky top-4 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-md border border-border p-1 rounded-full shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    setPreviewScale((s) =>
                      clampPreviewZoom(s - PREVIEW_ZOOM_STEP),
                    )
                  }
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[10px] font-medium w-14 text-center tabular-nums">
                  {(Math.round(previewScale * 1000) / 10).toFixed(1)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    setPreviewScale((s) =>
                      clampPreviewZoom(s + PREVIEW_ZOOM_STEP),
                    )
                  }
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={handleFitPreview}
                  title="Fit whole page on small screens; reset to 100% on desktop"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Dynamic Scaling Wrapper */}
            <div
              className="relative mx-auto shadow-2xl rounded-lg overflow-hidden"
              style={{
                width: `${794 * previewScale}px`,
                minHeight: `${contentHeight * previewScale}px`,
              }}
            >
              <div
                className="absolute top-0 left-0 will-change-transform"
                style={{
                  width: "794px",
                  transform: `scale(${previewScale}) translateZ(0)`,
                  transformOrigin: "top left",
                  backfaceVisibility: "hidden",
                  WebkitFontSmoothing: "antialiased",
                }}
              >
                <div
                  ref={contentRef}
                  data-resume-export-target
                >
                  <ResumePreview
                    key={templateId}
                    resume={deferredPreview.resume}
                    contentRevision={deferredPreview.revision}
                    accentColor={accentColor}
                    fontScale={fontScale}
                    fontColor={fontColor}
                    backgroundColor={backgroundColor}
                    showWatermark={!isPremiumUser}
                    autoFit={autoFit}
                  />
                </div>
              </div>

              {/* Localized Premium Magic Wand Overlay */}
              {isOptimizingWorkflow && (
                <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[4px] z-30 flex items-start justify-center p-6 text-center animate-in fade-in duration-300">
                  {/* Sticky Progress Panel */}
                  <div className="sticky top-[30vh] mx-auto w-full max-w-[320px] sm:max-w-[345px] rounded-2xl border border-white/20 dark:border-zinc-800 bg-white/75 dark:bg-zinc-900/80 backdrop-blur-xl p-8 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 overflow-hidden">
                    <div
                      className="absolute -inset-10 blur-2xl pointer-events-none rounded-full"
                      style={{ backgroundImage: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)" }}
                    />
                    
                    {/* Glowing Orb & Reverse Rotating Rings Animation */}
                    <div className="relative w-24 h-24 flex items-center justify-center">
                      {/* Inner glowing pulse */}
                      <motion.div
                        className="absolute w-14 h-14 rounded-full bg-gradient-to-tr from-primary/30 to-purple-500/30 blur-md"
                        animate={{
                          scale: [0.8, 1.2, 0.8],
                          opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />

                      {/* Spinning Orbit Ring 1 */}
                      <motion.div
                        className="absolute w-20 h-20 rounded-full border-2 border-dashed border-primary/40 dark:border-primary/50"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 8,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />

                      {/* Spinning Orbit Ring 2 */}
                      <motion.div
                        className="absolute w-16 h-16 rounded-full border border-dotted border-purple-500/40 dark:border-purple-500/60"
                        animate={{ rotate: -360 }}
                        transition={{
                          duration: 6,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />

                      {/* Glowing Core */}
                      <motion.div
                        className="relative z-10 w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.5)]"
                        animate={{
                          scale: [0.95, 1.05, 0.95],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <Wand2 className="h-5 w-5 text-white" />
                      </motion.div>

                      {/* Floating Sparkles */}
                      <motion.div
                        className="absolute"
                        animate={{
                          x: [0, 24, 0],
                          y: [0, -24, 0],
                          scale: [0, 1, 0],
                          opacity: [0, 0.8, 0],
                        }}
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          delay: 0,
                          ease: "easeInOut",
                        }}
                      >
                        <Sparkles className="h-4 w-4 text-amber-400 fill-amber-400" />
                      </motion.div>

                      <motion.div
                        className="absolute"
                        animate={{
                          x: [0, -28, 0],
                          y: [0, 20, 0],
                          scale: [0, 0.8, 0],
                          opacity: [0, 0.6, 0],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          delay: 0.8,
                          ease: "easeInOut",
                        }}
                      >
                        <Sparkles className="h-3 w-3 text-purple-400 fill-purple-400" />
                      </motion.div>

                      <motion.div
                        className="absolute"
                        animate={{
                          x: [0, 20, 0],
                          y: [0, 24, 0],
                          scale: [0, 0.9, 0],
                          opacity: [0, 0.7, 0],
                        }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          delay: 1.5,
                          ease: "easeInOut",
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary fill-primary" />
                      </motion.div>
                    </div>

                    {/* Progress steps & details */}
                    <div className="space-y-4 z-10 w-full">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                          </span>
                          <h4 className="text-sm font-bold tracking-tight text-foreground dark:text-zinc-100">
                            {progressSteps[progressStep]}
                          </h4>
                        </div>
                        <p className="text-[10px] text-primary/85 dark:text-primary/95 font-medium tracking-wide uppercase mt-1">
                          {optimizeResumeMutation.isPending ? "AI Optimization in progress" : "ATS Evaluation in progress"}
                        </p>
                      </div>

                      <p className="text-[11px] text-muted-foreground/90 dark:text-zinc-400 leading-relaxed px-2">
                        {optimizeResumeMutation.isPending
                          ? "AI is tailoring your bullet points, skills, and summary for the job description. This may take up to 30 seconds."
                          : "Analyzing keyword density, achievement quantification, and job alignment. This may take a few seconds."}
                      </p>
                      
                      {/* Premium gradient progress bar container */}
                      <div className="pt-2 w-full">
                        <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-primary via-purple-500 to-amber-500"
                            initial={{ width: "0%" }}
                            animate={{
                              width: `${((progressStep + 1) / progressSteps.length) * 100}%`
                            }}
                            transition={{
                              duration: 1.5,
                              ease: "easeInOut"
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground/85 dark:text-zinc-400 mt-1.5 px-0.5">
                          <span>Step {progressStep + 1} of {progressSteps.length}</span>
                          <span>{Math.round(((progressStep + 1) / progressSteps.length) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 h-14 bg-background border-t border-border flex items-center justify-around z-50">
          <button
            onPointerDown={() => switchMobileTab("sections")}
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${mobileTab === "sections" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutTemplate className="h-4 w-4 mb-0.5" />
            Sections
          </button>
          <button
            onPointerDown={() => switchMobileTab("edit")}
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium border-l border-r border-border transition-colors ${mobileTab === "edit" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <FileText className="h-4 w-4 mb-0.5" />
            Edit
          </button>
          <button
            onPointerDown={() => switchMobileTab("preview")}
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${mobileTab === "preview" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Zap className="h-4 w-4 mb-0.5" />
            Preview
          </button>
        </div>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        resume={previewResume}
        isPremiumUser={isPremiumUser}
        onRemoveWatermarkClick={() => {
          setExportOpen(false);
          setPaywallTitle("Watermark-free exports");
          setPaywallDescription(
            "Pro removes the Resumesensei footer from PDF and Word exports. You also unlock every template, unlimited AI writing help, and ATS score tracking.",
          );
          setShowPaywall(true);
        }}
      />

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all resume content?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes text and entries from every section (personal
              details, summary, experience, education, skills, projects, and
              certifications). Your section order and visibility are kept. This
              cannot be undone from here except by retyping or reloading if not
              yet saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearAllSections}
            >
              Clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaywallDialog
        open={showPaywall}
        onOpenChange={setShowPaywall}
        title={paywallTitle}
        description={paywallDescription}
      />

      <AtsPaywallDialog
        open={showAtsPaywall}
        onOpenChange={setShowAtsPaywall}
      />



    </div>
  );
}
