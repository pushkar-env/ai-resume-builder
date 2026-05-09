import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { GripVertical, ChevronDown, ChevronRight, Palette, LayoutTemplate, ArrowLeft, Loader2, FileDown, Star, Zap, FileText, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { BuilderNavbar } from "@/components/layout/Navbar";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SectionEditor } from "@/components/resume/SectionEditor";
import { PaywallDialog } from "@/components/shared/PaywallDialog";
import { SEO } from "@/components/shared/SEO";
import {
  useGetResume,
  useUpdateResume,
  useGetAtsScore,
  useListTemplates,
  getGetResumeQueryKey,
  type ResumeDetail,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ACCENT_COLORS = [
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Slate", value: "#475569" },
  { label: "Teal", value: "#0d9488", isPremium: true },
  { label: "Rose", value: "#e11d48", isPremium: true },
  { label: "Amber", value: "#d97706", isPremium: true },
  { label: "Emerald", value: "#059669", isPremium: true },
  { label: "Indigo", value: "#4338ca", isPremium: true },
];

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Helvetica", value: "'Helvetica Neue', sans-serif" },
  { label: "Outfit", value: "Outfit, sans-serif", isPremium: true },
  { label: "Jakarta", value: "'Plus Jakarta Sans', sans-serif", isPremium: true },
  { label: "Playfair", value: "'Playfair Display', serif", isPremium: true },
  { label: "Merriweather", value: "Merriweather, serif", isPremium: true },
  { label: "Georgia", value: "Georgia, serif", isPremium: true },
  { label: "Garamond", value: "Garamond, serif", isPremium: true },
  { label: "Lora", value: "Lora, serif", isPremium: true },
];

type Section = NonNullable<ResumeDetail["sections"]>[number];
type SectionContent = Record<string, unknown>;

/* ─── Helpers ─── */

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a complete HTML document containing the actual rendered resume preview DOM,
 * including all stylesheets from the current document. The result is byte-identical
 * to what the user sees in the preview pane.
 */
function buildExportHtml(resumeTitle: string): string | null {
  const previewEl = document.querySelector<HTMLElement>("[data-resume-export-target]");
  if (!previewEl) return null;

  // Collect all <style> tags and stylesheet <link>s from document head
  const headEls = Array.from(document.head.children).filter((el) => {
    if (el.tagName === "STYLE") return true;
    if (el.tagName === "LINK" && (el as HTMLLinkElement).rel === "stylesheet") return true;
    return false;
  });

  // For <link>, convert to absolute URLs so the new window can fetch them
  const headHtml = headEls.map((el) => {
    if (el.tagName === "LINK") {
      const link = el as HTMLLinkElement;
      const absHref = new URL(link.href, document.baseURI).href;
      return `<link rel="stylesheet" href="${absHref}" />`;
    }
    return el.outerHTML;
  }).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${resumeTitle.replace(/[<>]/g, "")}</title>
  ${headHtml}
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    body { display: flex; justify-content: center; }
    .a4-page {
      box-shadow: none !important;
      width: 794px !important;
      min-height: 1123px !important;
      margin: 0 !important;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .a4-page { width: 794px !important; }
    }
  </style>
</head>
<body>
  ${previewEl.outerHTML}
</body>
</html>`;
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-2 cursor-pointer transition-colors group ${
        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
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
      <span className="flex-1 text-xs font-medium truncate">{section.title}</span>
      {section.isVisible === false && (
        <span className="text-[10px] text-muted-foreground">hidden</span>
      )}
      {isActive ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />}
    </div>
  );
}

/* ─── ExportDialog — fully client-side ─── */

function ExportDialog({
  open,
  onClose,
  resume,
}: {
  open: boolean;
  onClose: () => void;
  resume: ResumeDetail;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handle = async (format: "pdf" | "docx" | "json") => {
    setLoading(format);
    try {
      const name = resume.title?.replace(/\s+/g, "_") || "resume";
      if (format === "json") {
        downloadBlob(JSON.stringify(resume, null, 2), `${name}.json`, "application/json");
        toast({ title: "JSON downloaded" });
      } else {
        const html = buildExportHtml(resume.title || "Resume");
        if (!html) {
          toast({ title: "Could not capture resume preview", variant: "destructive" });
          return;
        }
        if (format === "pdf") {
          // Use a hidden iframe for printing instead of window.open popups to prevent Safari from freezing
          const iframe = document.createElement("iframe");
          iframe.style.position = "fixed";
          iframe.style.right = "0";
          iframe.style.bottom = "0";
          iframe.style.width = "0";
          iframe.style.height = "0";
          iframe.style.border = "0";
          document.body.appendChild(iframe);

          const htmlWithReady = html.replace(
            "</body>",
            `<script>
              (function(){
                function whenReady(cb){
                  var links = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
                  var pending = links.filter(function(l){ return !l.sheet; });
                  if (pending.length === 0) return cb();
                  var done = 0;
                  pending.forEach(function(l){
                    var finish = function(){ if (++done === pending.length) cb(); };
                    l.addEventListener('load', finish);
                    l.addEventListener('error', finish);
                  });
                  setTimeout(cb, 3000);
                }
                function go(){
                  var fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
                  Promise.resolve(fontsReady).then(function(){
                    requestAnimationFrame(function(){
                      window.focus();
                      window.print();
                    });
                  });
                }
                if (document.readyState === 'complete') whenReady(go);
                else window.addEventListener('load', function(){ whenReady(go); });
              })();
            </script></body>`
          );

          const doc = iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(htmlWithReady);
            doc.close();
            toast({ title: 'Print dialog opened — save as PDF', description: "On mobile, use the share button to Save to Files." });
            
            // Clean up iframe safely after a delay to ensure print dialog doesn't close immediately
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 60000);
          } else {
            toast({ title: "Failed to open print frame", variant: "destructive" });
          }
        } else {
          downloadBlob(html, `${name}.doc`, "application/msword");
          toast({ title: "Word document downloaded" });
        }
      }
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const formats = [
    { id: "pdf" as const, label: "PDF Document", description: 'Opens auto-configured print dialog for perfect ATS vector export' },
    { id: "docx" as const, label: "Word (.doc)", description: "Editable document, opens in Microsoft Word" },
    { id: "json" as const, label: "JSON Data", description: "Raw resume data for programmatic use" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Resume</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {formats.map((f) => (
            <button
              key={f.id}
              className="w-full rounded-lg border border-border p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors group disabled:opacity-50"
              onClick={() => { void handle(f.id); }}
              disabled={loading !== null}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileDown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                {loading === f.id && <Loader2 className="h-4 w-4 animate-spin ml-auto text-muted-foreground" />}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  const [localSections, setLocalSections] = useState<Section[]>([]);
  const [accentColor, setAccentColor] = useState("#7c3aed");
  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [fontColor, setFontColor] = useState<string>(() => {
    if (typeof window === "undefined" || !id) return "#111827";
    return window.localStorage.getItem(`resumeFontColor:${id}`) || "#111827";
  });
  const [fontScale, setFontScale] = useState<number>(() => {
    if (typeof window === "undefined" || !id) return 1;
    const v = window.localStorage.getItem(`resumeFontScale:${id}`);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const [templateId, setTemplateId] = useState("modern");
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTitle, setPaywallTitle] = useState("Premium Feature");
  const [paywallDescription, setPaywallDescription] = useState("This feature is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, and premium customization.");
  const [exportOpen, setExportOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sections" | "edit" | "preview">("sections");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(0.7);
  const [userScale, setUserScale] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState(1123);

  const scale = userScale ?? autoScale;

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const availableWidth = width - 48; 
      const newScale = Math.min(1, availableWidth / 794);
      setAutoScale(newScale);
    };
    
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [mobileTab]);

  useEffect(() => {
    if (!contentRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(Math.max(1123, entry.contentRect.height));
      }
    });
    obs.observe(contentRef.current);
    return () => obs.disconnect();
  }, []);

  // Track which resume ID we've initialized from so re-fetches don't overwrite local edits
  const initializedResumeIdRef = useRef<number | null>(null);

  const { data: resume, isLoading } = useGetResume(resumeId, {
    query: {
      queryKey: getGetResumeQueryKey(resumeId),
      enabled: !!resumeId,
    },
  });

  const { data: atsScoreData } = useGetAtsScore(resumeId, {
    query: {
      queryKey: ["/api/resumes", resumeId, "ats"],
      enabled: !!resumeId,
    },
  });

  const { data: templates } = useListTemplates();

  const updateResume = useUpdateResume({
    mutation: {
      onSuccess: (data) => {
        // Update cache directly — no re-fetch that would overwrite local edits
        queryClient.setQueryData(getGetResumeQueryKey(resumeId), data);
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  // Only initialize local state the first time this resume loads (not on every save/re-fetch)
  useEffect(() => {
    if (resume && resume.id !== initializedResumeIdRef.current) {
      initializedResumeIdRef.current = resume.id;
      setLocalSections((resume.sections ?? []).map((s) => ({ ...s })));
      setAccentColor(resume.accentColor ?? "#7c3aed");
      setFontFamily(resume.fontFamily ?? "Inter, sans-serif");
      setTemplateId(resume.templateId ?? "modern");
      if ((resume.sections ?? []).length > 0) {
        setActiveSectionId(resume.sections![0].id);
      }
    }
  }, [resume]);

  // Reload font scale and color when switching resumes (per-resume persistence)
  const fontScaleHydratedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    const v = window.localStorage.getItem(`resumeFontScale:${id}`);
    const n = v ? Number(v) : NaN;
    setFontScale(Number.isFinite(n) && n > 0 ? n : 1);
    
    const c = window.localStorage.getItem(`resumeFontColor:${id}`);
    setFontColor(c || "#111827");
    
    fontScaleHydratedFor.current = id;
  }, [id]);

  // Persist font scale and color per-resume
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    if (fontScaleHydratedFor.current !== id) return;
    window.localStorage.setItem(`resumeFontScale:${id}`, String(fontScale));
    window.localStorage.setItem(`resumeFontColor:${id}`, fontColor);
  }, [fontScale, fontColor, id]);

  // Reset when navigating to a different resume
  useEffect(() => {
    initializedResumeIdRef.current = null;
  }, [resumeId]);

  const scheduleSave = useCallback(
    (sections: Section[], accent: string, font: string, template: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateResume.mutate({
          id: resumeId,
          data: {
            accentColor: accent,
            fontFamily: font,
            templateId: template,
            sections: sections.map((s) => ({
              id: s.id,
              content: s.content as Record<string, unknown>,
              displayOrder: s.displayOrder,
              isVisible: s.isVisible,
            })),
          },
        });
      }, 800);
    },
    [resumeId, updateResume]
  );

  const handleSectionContentChange = useCallback(
    (sectionId: number, content: SectionContent) => {
      setLocalSections((prev) => {
        const updated = prev.map((s) =>
          s.id === sectionId ? { ...s, content } : s
        );
        scheduleSave(updated, accentColor, fontFamily, templateId);
        return updated;
      });
    },
    [accentColor, fontFamily, templateId, scheduleSave]
  );

  const handleVisibilityToggle = useCallback(
    (sectionId: number) => {
      setLocalSections((prev) => {
        const updated = prev.map((s) =>
          s.id === sectionId ? { ...s, isVisible: s.isVisible !== false ? false : true } : s
        );
        scheduleSave(updated, accentColor, fontFamily, templateId);
        return updated;
      });
    },
    [accentColor, fontFamily, templateId, scheduleSave]
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
        scheduleSave(withOrder, accentColor, fontFamily, templateId);
        return withOrder;
      });
    },
    [accentColor, fontFamily, templateId, scheduleSave]
  );

  const handleAccentChange = (color: string) => {
    const isPreset = ACCENT_COLORS.find((c) => c.value === color);
    if (!isPremiumUser && ((isPreset && isPreset.isPremium) || !isPreset)) {
      setPaywallTitle("Premium Color Picker");
      setPaywallDescription("Custom colors and premium palettes are reserved for Pro users. Upgrade to unlock all customization options.");
      setShowPaywall(true);
      return;
    }
    setAccentColor(color);
    scheduleSave(localSections, color, fontFamily, templateId);
  };

  const handleFontChange = (font: string) => {
    const fontObj = FONT_OPTIONS.find((f) => f.value === font);
    if (!isPremiumUser && fontObj?.isPremium) {
      setPaywallTitle("Premium Font");
      setPaywallDescription(`The ${fontObj.label} font is reserved for Pro users. Upgrade to unlock all premium typography options.`);
      setShowPaywall(true);
      return;
    }
    setFontFamily(font);
    scheduleSave(localSections, accentColor, font, templateId);
  };

  const handleTemplateChange = (t: string) => {
    const template = Array.isArray(templates) ? templates.find(temp => temp.id === t) : null;
    if (template?.isPremium && !isPremiumUser) {
      setPaywallTitle("Premium Template");
      setPaywallDescription("This template is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, and ATS optimization.");
      setShowPaywall(true);
      return;
    }
    setTemplateId(t);
    scheduleSave(localSections, accentColor, fontFamily, t);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeSection = localSections.find((s) => s.id === activeSectionId);

  const previewResume: ResumeDetail = resume
    ? { ...resume, sections: localSections, accentColor, fontFamily, templateId }
    : { id: resumeId, title: "", userId: "", templateId, accentColor, fontFamily, isPublic: false, shareToken: null, viewCount: 0, downloadCount: 0, createdAt: "", updatedAt: "", sections: localSections };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-12 border-b border-border bg-background flex items-center px-4 gap-3">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-border p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <SEO 
        title={`${resume?.title || 'Untitled Resume'} - Editor | ResumeAI`}
        description="Edit your professional resume with real-time AI suggestions."
      />
      <BuilderNavbar
        title={resume?.title ?? ""}
        atsScore={atsScoreData?.score}
        onExport={() => setExportOpen(true)}
        onRename={(newTitle) => {
          updateResume.mutate({
            id: resumeId,
            data: { title: newTitle },
          });
        }}
      />

      <div className="flex flex-1 overflow-hidden relative pb-14 lg:pb-0">
        {/* Left sidebar — sections */}
        <aside className={`w-full lg:w-56 border-r border-border bg-background flex-col shrink-0 overflow-hidden ${mobileTab === "sections" ? "flex" : "hidden lg:flex"}`}>
          <div className="px-3 pt-3 pb-2 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Sections</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-3 pb-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {localSections.map((s) => (
                    <SortableSectionItem
                      key={s.id}
                      section={s}
                      isActive={activeSectionId === s.id}
                      onSelect={() => {
                        setActiveSectionId(s.id);
                        if (window.innerWidth < 1024) setMobileTab("edit");
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            </div>
          </ScrollArea>

          <div className="mt-auto border-t border-border p-3 space-y-2 shrink-0">
            {/* Template selector */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Template</p>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-8 text-xs">
                  <LayoutTemplate className="h-3 w-3 mr-1.5 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Array.isArray(templates) ? templates : []).map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font selector */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Font</p>
              <Select value={fontFamily} onValueChange={handleFontChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="text-xs">
                      <div className="flex items-center justify-between w-full">
                        <span>{f.label}</span>
                        {f.isPremium && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500 ml-2" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font size */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Font Size</p>
              <Select value={String(fontScale)} onValueChange={(v) => setFontScale(Number(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.85" className="text-xs">Extra Small (85%)</SelectItem>
                  <SelectItem value="0.9" className="text-xs">Small (90%)</SelectItem>
                  <SelectItem value="1" className="text-xs">Normal (100%)</SelectItem>
                  <SelectItem value="1.1" className="text-xs">Large (110%)</SelectItem>
                  <SelectItem value="1.2" className="text-xs">Extra Large (120%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Color */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Text Color</p>
              <div className="relative h-8 w-full rounded-md border border-input overflow-hidden bg-background hover:bg-muted/50 transition-colors">
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium pointer-events-none text-foreground/80">
                  {fontColor.toUpperCase()}
                </div>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="absolute -top-4 -left-4 h-24 w-24 cursor-pointer opacity-0"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border border-border pointer-events-none" style={{ background: fontColor }} />
              </div>
            </div>

            {/* Accent color */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Accent Color</p>
              <div className="flex items-center gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 h-8 gap-2 text-xs justify-start px-2 overflow-hidden">
                      <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ background: accentColor }} />
                      <span className="truncate">{ACCENT_COLORS.find((c) => c.value === accentColor)?.label ?? "Custom"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-40 p-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      {ACCENT_COLORS.map((c) => (
                        <div key={c.value} className="relative">
                          <button
                            title={c.label}
                            className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${accentColor === c.value ? "ring-2 ring-offset-1 ring-foreground/40" : ""}`}
                            style={{ background: c.value }}
                            onClick={() => handleAccentChange(c.value)}
                          />
                          {c.isPremium && (
                            <div className="absolute -top-1 -right-1 bg-background rounded-full p-[1px]">
                              <Star className="h-2 w-2 text-amber-500 fill-amber-500" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="relative h-8 w-9 rounded-md border border-input overflow-hidden shrink-0 bg-background hover:bg-muted/50 transition-colors flex items-center justify-center">
                  <Palette className="h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="absolute -top-4 -left-4 h-24 w-24 cursor-pointer opacity-0"
                    title="Pick custom color"
                  />
                </div>
              </div>
            </div>

            <Button variant="ghost" size="sm" className="w-full gap-1.5 h-8 text-xs text-muted-foreground justify-start" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </Button>
          </div>
        </aside>

        {/* Center — section editor */}
        <div className={`w-full lg:w-80 border-r border-border bg-background flex-col shrink-0 ${mobileTab === "edit" ? "flex" : "hidden lg:flex"}`}>
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold text-foreground">
              {activeSection?.title ?? "Select a section"}
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <AnimatePresence mode="wait">
                {activeSection ? (
                  <motion.div
                    key={activeSection.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SectionEditor
                      section={activeSection as { id: number; type: string; title: string; content: SectionContent; isVisible?: boolean }}
                      onChange={(content) => handleSectionContentChange(activeSection.id, content)}
                      onVisibilityToggle={() => handleVisibilityToggle(activeSection.id)}
                      resumeId={resumeId}
                      allSections={localSections as { id: number; type: string; content: SectionContent }[]}
                    />
                  </motion.div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a section from the sidebar to edit it.</p>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Auto-save indicator */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-1.5">
            {updateResume.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Saving...</span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">Changes saved automatically</span>
            )}
          </div>
        </div>

        {/* Right — live preview */}
        <div 
          ref={containerRef}
          className={`flex-1 overflow-auto bg-muted/40 flex-col py-6 ${mobileTab === "preview" ? "flex" : "hidden lg:flex"}`}
        >
          <div className="min-w-max w-full flex flex-col items-center pb-20 relative px-4 mx-auto">
            <div className="mb-4 flex flex-col items-center justify-center gap-3">
              <span className="text-xs text-muted-foreground bg-background/50 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">Live Preview — A4</span>
              
              {/* Zoom Controls */}
              <div className="sticky top-4 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-md border border-border p-1 rounded-full shadow-sm">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setUserScale(s => Math.max(0.2, (s || autoScale) - 0.1))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[10px] font-medium w-10 text-center">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setUserScale(s => Math.min(2, (s || autoScale) + 0.1))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                {userScale !== null && (
                  <>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setUserScale(null)} title="Fit to screen">
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Dynamic Scaling Wrapper */}
            <div 
              className="relative mx-auto transition-all duration-200" 
              style={{ 
                width: `${794 * scale}px`, 
                height: `${contentHeight * scale}px` 
              }}
            >
              <div 
                className="absolute top-0 left-0 transition-transform duration-200" 
                style={{ 
                  width: "794px", 
                  transform: `scale(${scale}) translateZ(0)`, 
                  transformOrigin: "top left",
                  backfaceVisibility: "hidden",
                  WebkitFontSmoothing: "antialiased"
                }}
              >
                <div ref={contentRef} data-resume-export-target className="shadow-2xl">
                  <ResumePreview key={templateId} resume={previewResume} accentColor={accentColor} fontScale={fontScale} fontColor={fontColor} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 h-14 bg-background border-t border-border flex items-center justify-around z-50">
          <button 
            onClick={() => setMobileTab("sections")} 
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${mobileTab === "sections" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutTemplate className="h-4 w-4 mb-0.5" />
            Sections
          </button>
          <button 
            onClick={() => setMobileTab("edit")} 
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium border-l border-r border-border transition-colors ${mobileTab === "edit" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <FileText className="h-4 w-4 mb-0.5" />
            Edit
          </button>
          <button 
            onClick={() => setMobileTab("preview")} 
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${mobileTab === "preview" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Zap className="h-4 w-4 mb-0.5" />
            Preview
          </button>
        </div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} resume={previewResume} />

      <PaywallDialog 
        open={showPaywall} 
        onOpenChange={setShowPaywall}
        title={paywallTitle}
        description={paywallDescription}
      />
    </div>
  );
}
