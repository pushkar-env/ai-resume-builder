import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  FileDown,
  Sparkles,
  Wand2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Eye,
  Edit,
  History,
  FileText,
  Palette,
  Briefcase,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Sliders,
  Check,
  Star,
  Move,
  RotateCcw,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
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
} from "@/components/ui/dialog";
import {
  useGetCoverLetter,
  useUpdateCoverLetter,
  useRegenerateCoverLetter,
  useGetCoverLetterVersions,
  useRestoreCoverLetterVersion,
  useAuditCoverLetterAts,
  useScrapeJobDetails,
  useListResumes,
  useGetResume,
  useExportCoverLetterPdf,
  getGetResumeQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/shared/SEO";
import { CoverLetterPreview, parseCoverLetterContent } from "@/components/resume/CoverLetterPreview";
import { buildCoverLetterDocx } from "@/lib/build-cover-letter-docx";
import { buildSelfContainedExportHtml } from "@/lib/resume-export-html";
import { PremiumLoadingScreen } from "@/components/shared/PremiumLoadingScreen";
import { PaywallDialog } from "@/components/shared/PaywallDialog";

const ACCENT_COLORS = [
  { label: "Classic Black", value: "#1A1A1A" },
  { label: "Royal Blue", value: "#1e3a8a" },
  { label: "Deep Slate", value: "#334155" },
  { label: "Teal Forest", value: "#0f766e" },
  { label: "Crimson Rose", value: "#be123c" },
  { label: "Elegant Violet", value: "#6d28d9" },
  { label: "Warm Bronze", value: "#7c2d12" },
];

const TEMPLATES = [
  { id: "classic", name: "Classic Corporate" },
  { id: "modern", name: "Modern Minimal" },
  { id: "minimal", name: "Zinc Minimalist" },
  { id: "creative", name: "Creative Edge", isPremium: true },
  { id: "elegant", name: "Elegant Editorial" },
  { id: "professional", name: "Executive Professional", isPremium: true },
  { id: "startup", name: "Tech Startup", isPremium: true },
];

const TONES = [
  { value: "professional", label: "Professional & Polished" },
  { value: "confident", label: "Confident & Assertive" },
  { value: "enthusiastic", label: "Enthusiastic & Warm" },
  { value: "creative", label: "Creative & Narrative" },
  { value: "humble", label: "Humble & Collaborative" },
];

const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry Level / Internship" },
  { value: "mid", label: "Mid-Career (2-5 years)" },
  { value: "senior", label: "Senior/Lead (5+ years)" },
  { value: "executive", label: "Director / VP / Executive" },
];

const COVER_LETTER_WIDTH = 794;
const COVER_LETTER_HEIGHT = 1123;
const MIN_PREVIEW_ZOOM = 0.3;
const MAX_PREVIEW_ZOOM = 2;

export default function CoverLetterBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const coverLetterId = parseInt(id || "", 10);
  const { toast } = useToast();
  const { user } = useUser();
  const isPremiumUser = user?.publicMetadata?.isPremium === true;
  const showWatermark = !isPremiumUser;

  // Active tab on mobile (editor vs preview)
  const [activeMobileTab, setActiveMobileTab] = useState<"edit" | "preview">("edit");

  // Local state for auto-save fields to prevent excess API calls on every keystroke
  const [localTitle, setLocalTitle] = useState("");
  const [localJobTitle, setLocalJobTitle] = useState("");
  const [localCompanyName, setLocalCompanyName] = useState("");
  const [localHiringManager, setLocalHiringManager] = useState("");
  const [localLocation, setLocalLocation] = useState("");
  const [localJobDescription, setLocalJobDescription] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localCustomInstructions, setLocalCustomInstructions] = useState("");
  const [localJobUrl, setLocalJobUrl] = useState("");
  const [localSenderName, setLocalSenderName] = useState("");
  const [localSenderEmail, setLocalSenderEmail] = useState("");
  const [localSenderPhone, setLocalSenderPhone] = useState("");
  const [localSenderLocation, setLocalSenderLocation] = useState("");

  const [localDate, setLocalDate] = useState("");
  const [localBody, setLocalBody] = useState("");
  const [localClosing, setLocalClosing] = useState("");
  const [localSignature, setLocalSignature] = useState("");
  const [localShowSignatureDesign, setLocalShowSignatureDesign] = useState(true);
  const [localFontSize, setLocalFontSize] = useState<number>(16);

  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Local style overrides (since cover letter model doesn't store fonts/colors directly)
  const [localFontFamily, setLocalFontFamily] = useState("sans");
  const [localAccentColor, setLocalAccentColor] = useState("#1e3a8a");
  const [localTemplateId, setLocalTemplateId] = useState("classic");
  const [localTone, setLocalTone] = useState("professional");
  const [localExperienceLevel, setLocalExperienceLevel] = useState("mid");

  // Preview canvas state
  const [zoom, setZoom] = useState(0.65);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 24 });
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const previewPanRef = useRef(previewPan);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastGestureCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);
  const hasPositionedPreviewRef = useRef(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTitle, setPaywallTitle] = useState("Premium Template");
  const [paywallDescription, setPaywallDescription] = useState(
    "This template layout is reserved for Pro users. Upgrade to unlock all premium template layouts, unlimited AI writing assistance, and ATS optimization."
  );

  // Queries & Mutations
  const {
    data: coverLetter,
    isLoading: isLoadingLetter,
    refetch: refetchLetter,
  } = useGetCoverLetter(coverLetterId);

  const { data: resumesList } = useListResumes();

  // Selected linked resume query
  const linkedResumeId = coverLetter?.resumeId || undefined;
  const { data: linkedResume } = useGetResume(linkedResumeId as number, {
    query: {
      enabled: !!linkedResumeId,
      queryKey: getGetResumeQueryKey(linkedResumeId as number),
    },
  });

  const { data: versions, refetch: refetchVersions } = useGetCoverLetterVersions(coverLetterId);

  const { mutateAsync: updateLetter, isPending: isUpdating } = useUpdateCoverLetter();
  const { mutateAsync: regenerateLetter, isPending: isRegenerating } = useRegenerateCoverLetter();
  const { mutateAsync: restoreVersion, isPending: isRestoring } = useRestoreCoverLetterVersion();
  const { mutateAsync: runAtsAudit, isPending: isAuditing } = useAuditCoverLetterAts();
  const { mutateAsync: scrapeJob, isPending: isScraping } = useScrapeJobDetails();
  const { mutateAsync: exportPdf, isPending: isExportingPdf } = useExportCoverLetterPdf();

  // AI generation step cycling
  const [generationStep, setGenerationStep] = useState(0);
  const generationSteps = useMemo(() => [
    "Analyzing job description...",
    "Aligning professional experience...",
    "Crafting introductory hooks...",
    "Optimizing tone & vocabulary...",
    "Finalizing letter layout..."
  ], []);

  useEffect(() => {
    if (!isRegenerating) {
      setGenerationStep(0);
      return;
    }
    const interval = setInterval(() => {
      setGenerationStep((prev) => (prev < generationSteps.length - 1 ? prev + 1 : prev));
    }, 2800);
    return () => clearInterval(interval);
  }, [isRegenerating, generationSteps]);

  // Sync database cover letter data to local state on initial load or version restores
  useEffect(() => {
    const isReady = coverLetter && (!coverLetter.resumeId || linkedResume);
    if (isReady && !hasLoadedInitial) {
      setLocalTitle(coverLetter.title || "");
      setLocalJobTitle(coverLetter.jobTitle || "");
      setLocalCompanyName(coverLetter.companyName || "");
      setLocalHiringManager(coverLetter.hiringManagerName || "");
      setLocalLocation(coverLetter.companyLocation || "");
      setLocalJobDescription(coverLetter.jobDescription || "");
      
      const rawContent = coverLetter.generatedContent || "";
      setLocalContent(rawContent);
      
      let initialDate = "";
      let initialBody = "";
      let initialClosing = "";
      let initialSignature = "";
      let initialShowSignatureDesign = true;
      let initialFontSize = 16;

      try {
        const parsedJson = JSON.parse(rawContent);
        if (parsedJson && (parsedJson.body !== undefined || parsedJson.closing !== undefined || parsedJson.signature !== undefined)) {
          initialDate = parsedJson.date || "";
          initialBody = parsedJson.body || "";
          initialClosing = parsedJson.closing || "";
          initialSignature = parsedJson.signature || "";
          initialShowSignatureDesign = parsedJson.showSignatureDesign !== undefined ? parsedJson.showSignatureDesign : true;
          initialFontSize = parsedJson.fontSize !== undefined ? Number(parsedJson.fontSize) : 16;
        } else {
          throw new Error("Not JSON");
        }
      } catch {
        const parsed = parseCoverLetterContent(
          rawContent,
          coverLetter.hiringManagerName || "Hiring Manager",
          (coverLetter as any).senderName || user?.fullName || "Your Name",
          (coverLetter as any).senderEmail || user?.primaryEmailAddress?.emailAddress || "email@example.com",
          (coverLetter as any).senderPhone,
          (coverLetter as any).senderLocation,
          coverLetter.companyName,
          coverLetter.companyLocation,
          coverLetter.jobTitle
        );
        initialDate = parsed.date;
        initialBody = parsed.salutation 
          ? `${parsed.salutation}\n\n${parsed.paragraphs.join("\n\n")}` 
          : parsed.paragraphs.join("\n\n");
        initialClosing = parsed.signOff;
        initialSignature = parsed.senderName;
        initialShowSignatureDesign = parsed.showSignatureDesign !== undefined ? parsed.showSignatureDesign : true;
      }

      const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      if (!initialDate || initialDate.toLowerCase() === "[date]" || initialDate.trim() === "") {
        initialDate = today;
      }

      setLocalDate(initialDate);
      setLocalBody(initialBody);
      setLocalClosing(initialClosing);
      setLocalSignature(initialSignature);
      setLocalShowSignatureDesign(initialShowSignatureDesign);
      setLocalFontSize(initialFontSize);

      setLocalCustomInstructions(coverLetter.customInstructions || "");
      
      // Determine font family from cover letter or default to sans
      if (coverLetter.fontFamily) {
        setLocalFontFamily(coverLetter.fontFamily);
      } else {
        setLocalFontFamily("sans");
      }

      // Determine accent color from cover letter or fall back to linked resume/default
      if (coverLetter.accentColor) {
        setLocalAccentColor(coverLetter.accentColor);
      } else if (linkedResume?.accentColor) {
        setLocalAccentColor(linkedResume.accentColor);
      } else {
        setLocalAccentColor("#1e3a8a");
      }

      // Initialize sender info
      let initialName = (coverLetter as any).senderName || "";
      if (!initialName) {
        if (linkedResume?.sections) {
          const personalSection = linkedResume.sections.find((s) => s.type === "personal");
          if (personalSection?.content) {
            const c = personalSection.content as any;
            if (c.name || c.fullName) initialName = c.name || c.fullName;
          }
        }
      }
      if (!initialName) {
        initialName = user?.fullName || "Your Name";
      }
      setLocalSenderName(initialName);

      let initialEmail = (coverLetter as any).senderEmail || "";
      if (!initialEmail) {
        if (linkedResume?.sections) {
          const personalSection = linkedResume.sections.find((s) => s.type === "personal");
          if (personalSection?.content) {
            const c = personalSection.content as any;
            if (c.email) initialEmail = c.email;
          }
        }
      }
      if (!initialEmail) {
        initialEmail = user?.primaryEmailAddress?.emailAddress || "email@example.com";
      }
      setLocalSenderEmail(initialEmail);

      let initialPhone = (coverLetter as any).senderPhone || "";
      if (!initialPhone) {
        if (linkedResume?.sections) {
          const personalSection = linkedResume.sections.find((s) => s.type === "personal");
          if (personalSection?.content) {
            const c = personalSection.content as any;
            if (c.phone) initialPhone = c.phone;
          }
        }
      }
      setLocalSenderPhone(initialPhone);

      let initialLocation = (coverLetter as any).senderLocation || "";
      if (!initialLocation) {
        if (linkedResume?.sections) {
          const personalSection = linkedResume.sections.find((s) => s.type === "personal");
          if (personalSection?.content) {
            const c = personalSection.content as any;
            if (c.location) initialLocation = c.location;
          }
        }
      }
      setLocalSenderLocation(initialLocation);

      // Determine template ID
      if (coverLetter.templateId) {
        setLocalTemplateId(coverLetter.templateId);
      } else {
        setLocalTemplateId("classic");
      }

      // Determine tone
      if (coverLetter.tone) {
        setLocalTone(coverLetter.tone);
      } else {
        setLocalTone("professional");
      }

      // Determine experience level
      if (coverLetter.experienceLevel) {
        setLocalExperienceLevel(coverLetter.experienceLevel);
      } else {
        setLocalExperienceLevel("mid");
      }

      setHasLoadedInitial(true);
    }
  }, [coverLetter, linkedResume, hasLoadedInitial, user]);

  // Serialize states to JSON for generatedContent auto-saving
  useEffect(() => {
    if (!hasLoadedInitial) return;
    const serializedJson = JSON.stringify({
      date: localDate,
      body: localBody,
      closing: localClosing,
      signature: localSignature,
      showSignatureDesign: localShowSignatureDesign,
      fontSize: localFontSize,
    });
    setLocalContent(serializedJson);
  }, [localDate, localBody, localClosing, localSignature, localShowSignatureDesign, localFontSize, hasLoadedInitial]);

  const commitPreviewTransform = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      const viewport = previewViewportRef.current;
      const clampedZoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, nextZoom));
      let clampedPan = nextPan;

      if (viewport) {
        const { width, height } = viewport.getBoundingClientRect();
        const scaledWidth = COVER_LETTER_WIDTH * clampedZoom;
        const scaledHeight = COVER_LETTER_HEIGHT * clampedZoom;
        const visibleEdge = Math.min(96, Math.max(48, Math.min(width, height) * 0.18));

        clampedPan = {
          x: Math.min(width - visibleEdge, Math.max(visibleEdge - scaledWidth, nextPan.x)),
          y: Math.min(height - visibleEdge, Math.max(visibleEdge - scaledHeight, nextPan.y)),
        };
      }

      zoomRef.current = clampedZoom;
      previewPanRef.current = clampedPan;
      setZoom(clampedZoom);
      setPreviewPan(clampedPan);
    },
    [],
  );

  const fitPreviewToViewport = useCallback(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;

    const padding = width < 640 ? 24 : 40;
    const fittedZoom = Math.min(
      0.72,
      Math.max(
        MIN_PREVIEW_ZOOM,
        Math.min(
          (width - padding * 2) / COVER_LETTER_WIDTH,
          (height - padding * 2) / COVER_LETTER_HEIGHT,
        ),
      ),
    );

    commitPreviewTransform(fittedZoom, {
      x: (width - COVER_LETTER_WIDTH * fittedZoom) / 2,
      y: Math.max(padding, (height - COVER_LETTER_HEIGHT * fittedZoom) / 2),
    });
    hasPositionedPreviewRef.current = true;
  }, [commitPreviewTransform]);

  const zoomPreviewAt = useCallback(
    (nextZoom: number, anchor?: { x: number; y: number }) => {
      const viewport = previewViewportRef.current;
      const currentZoom = zoomRef.current;
      const currentPan = previewPanRef.current;
      const point =
        anchor ??
        (viewport
          ? {
              x: viewport.clientWidth / 2,
              y: viewport.clientHeight / 2,
            }
          : { x: 0, y: 0 });
      const clampedZoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, nextZoom));
      const contentX = (point.x - currentPan.x) / currentZoom;
      const contentY = (point.y - currentPan.y) / currentZoom;

      commitPreviewTransform(clampedZoom, {
        x: point.x - contentX * clampedZoom,
        y: point.y - contentY * clampedZoom,
      });
    },
    [commitPreviewTransform],
  );

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      if (!hasPositionedPreviewRef.current) {
        fitPreviewToViewport();
        return;
      }
      commitPreviewTransform(zoomRef.current, previewPanRef.current);
    });

    observer.observe(viewport);
    fitPreviewToViewport();
    return () => observer.disconnect();
  }, [commitPreviewTransform, fitPreviewToViewport]);

  useEffect(() => {
    if (activeMobileTab === "preview") {
      requestAnimationFrame(() => {
        if (!hasPositionedPreviewRef.current) fitPreviewToViewport();
      });
    }
  }, [activeMobileTab, fitPreviewToViewport]);

  const getPreviewPoint = useCallback((clientX: number, clientY: number) => {
    const rect = previewViewportRef.current?.getBoundingClientRect();
    return rect
      ? { x: clientX - rect.left, y: clientY - rect.top }
      : { x: clientX, y: clientY };
  }, []);

  const handlePreviewPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointersRef.current.set(
        event.pointerId,
        getPreviewPoint(event.clientX, event.clientY),
      );

      const points = Array.from(activePointersRef.current.values());
      if (points.length === 1) {
        lastGestureCenterRef.current = points[0];
        lastPinchDistanceRef.current = null;
      } else {
        const [first, second] = points;
        lastGestureCenterRef.current = {
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        };
        lastPinchDistanceRef.current = Math.hypot(
          second.x - first.x,
          second.y - first.y,
        );
      }
      setIsPreviewDragging(true);
    },
    [getPreviewPoint],
  );

  const handlePreviewPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(event.pointerId)) return;
      event.preventDefault();
      activePointersRef.current.set(
        event.pointerId,
        getPreviewPoint(event.clientX, event.clientY),
      );

      const points = Array.from(activePointersRef.current.values());
      if (points.length >= 2) {
        const [first, second] = points;
        const center = {
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        };
        const distance = Math.max(
          1,
          Math.hypot(second.x - first.x, second.y - first.y),
        );
        const previousCenter = lastGestureCenterRef.current ?? center;
        const previousDistance = lastPinchDistanceRef.current ?? distance;
        const currentZoom = zoomRef.current;
        const currentPan = previewPanRef.current;
        const contentX = (previousCenter.x - currentPan.x) / currentZoom;
        const contentY = (previousCenter.y - currentPan.y) / currentZoom;
        const nextZoom = currentZoom * (distance / previousDistance);

        commitPreviewTransform(nextZoom, {
          x: center.x - contentX * nextZoom,
          y: center.y - contentY * nextZoom,
        });
        lastGestureCenterRef.current = center;
        lastPinchDistanceRef.current = distance;
        return;
      }

      const point = points[0];
      const previousPoint = lastGestureCenterRef.current ?? point;
      commitPreviewTransform(zoomRef.current, {
        x: previewPanRef.current.x + point.x - previousPoint.x,
        y: previewPanRef.current.y + point.y - previousPoint.y,
      });
      lastGestureCenterRef.current = point;
    },
    [commitPreviewTransform, getPreviewPoint],
  );

  const handlePreviewPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      activePointersRef.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const points = Array.from(activePointersRef.current.values());
      if (points.length === 0) {
        lastGestureCenterRef.current = null;
        lastPinchDistanceRef.current = null;
        setIsPreviewDragging(false);
      } else {
        lastGestureCenterRef.current = points[0];
        lastPinchDistanceRef.current = null;
      }
    },
    [],
  );

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const anchor = getPreviewPoint(event.clientX, event.clientY);
        zoomPreviewAt(zoomRef.current * Math.exp(-event.deltaY * 0.0025), anchor);
        return;
      }

      commitPreviewTransform(zoomRef.current, {
        x: previewPanRef.current.x - event.deltaX,
        y: previewPanRef.current.y - event.deltaY,
      });
    },
    [commitPreviewTransform, getPreviewPoint, zoomPreviewAt],
  );

  const handlePreviewKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const panStep = event.shiftKey ? 80 : 32;
      const panBy = (x: number, y: number) => {
        commitPreviewTransform(zoomRef.current, {
          x: previewPanRef.current.x + x,
          y: previewPanRef.current.y + y,
        });
      };

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          panBy(panStep, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          panBy(-panStep, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          panBy(0, panStep);
          break;
        case "ArrowDown":
          event.preventDefault();
          panBy(0, -panStep);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomPreviewAt(zoomRef.current + 0.1);
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomPreviewAt(zoomRef.current - 0.1);
          break;
        case "0":
          event.preventDefault();
          fitPreviewToViewport();
          break;
      }
    },
    [commitPreviewTransform, fitPreviewToViewport, zoomPreviewAt],
  );

  useEffect(() => {
    if (!hasLoadedInitial) return;
    setIsDirty(true);
    setSaveStatus("saving");
  }, [
    localTitle,
    localJobTitle,
    localCompanyName,
    localHiringManager,
    localLocation,
    localJobDescription,
    localContent,
    localCustomInstructions,
    localSenderName,
    localSenderEmail,
    localSenderPhone,
    localSenderLocation,
    localDate,
    localBody,
    localClosing,
    localSignature,
    localShowSignatureDesign,
    localFontSize,
  ]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirty || !coverLetter) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        await updateLetter({
          id: coverLetterId,
          data: {
            title: localTitle,
            jobTitle: localJobTitle,
            companyName: localCompanyName,
            hiringManagerName: localHiringManager,
            companyLocation: localLocation,
            jobDescription: localJobDescription,
            generatedContent: localContent,
            customInstructions: localCustomInstructions,
            senderName: localSenderName,
            senderEmail: localSenderEmail,
            senderPhone: localSenderPhone,
            senderLocation: localSenderLocation,
          },
        });
        setSaveStatus("saved");
        setIsDirty(false);
      } catch (err) {
        setSaveStatus("error");
        toast({
          title: "Auto-save failed",
          description: "Could not save your changes. Please check your connection.",
          variant: "destructive",
        });
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [
    isDirty,
    localTitle,
    localJobTitle,
    localCompanyName,
    localHiringManager,
    localLocation,
    localJobDescription,
    localContent,
    localCustomInstructions,
    localSenderName,
    localSenderEmail,
    localSenderPhone,
    localSenderLocation,
    coverLetter,
  ]);

  // Immediate synchronous save helper
  const saveChangesImmediately = async () => {
    if (!coverLetter) return;
    try {
      await updateLetter({
        id: coverLetterId,
        data: {
          title: localTitle,
          jobTitle: localJobTitle,
          companyName: localCompanyName,
          hiringManagerName: localHiringManager,
          companyLocation: localLocation,
          jobDescription: localJobDescription,
          generatedContent: localContent,
          customInstructions: localCustomInstructions,
          fontFamily: localFontFamily,
          accentColor: localAccentColor,
          senderName: localSenderName,
          senderEmail: localSenderEmail,
          senderPhone: localSenderPhone,
          senderLocation: localSenderLocation,
        },
      });
    } catch (err) {
      console.error("Immediate save failed", err);
    }
  };

  // Window unload and component unmount listener
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirty) {
        saveChangesImmediately();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isDirty) {
        saveChangesImmediately();
      }
    };
  }, [
    isDirty,
    localTitle,
    localJobTitle,
    localCompanyName,
    localHiringManager,
    localLocation,
    localJobDescription,
    localContent,
    localCustomInstructions,
    localFontFamily,
    localAccentColor,
    localSenderName,
    localSenderEmail,
    localSenderPhone,
    localSenderLocation,
    coverLetter,
  ]);



  // Handles updating styling or single fields immediately
  const handleSaveField = async (
    fieldName: string,
    value: any,
  ) => {
    if (!coverLetter) return;
    try {
      await updateLetter({
        id: coverLetterId,
        data: {
          [fieldName]: value,
        },
      });
      refetchLetter();
      refetchVersions();
    } catch (err) {
      toast({
        title: "Save failed",
        description: "Could not save settings.",
        variant: "destructive",
      });
    }
  };

  // Scrape details from Job URL
  const handleScrapeUrl = async () => {
    if (!localJobUrl.trim()) return;
    try {
      const scraped = await scrapeJob({ data: { url: localJobUrl } });
      if (scraped.jobTitle) setLocalJobTitle(scraped.jobTitle);
      if (scraped.companyName) setLocalCompanyName(scraped.companyName);
      if (scraped.description) setLocalJobDescription(scraped.description);

      // Save to db
      await updateLetter({
        id: coverLetterId,
        data: {
          jobTitle: scraped.jobTitle || localJobTitle,
          companyName: scraped.companyName || localCompanyName,
          jobDescription: scraped.description || localJobDescription,
        },
      });
      refetchLetter();
      toast({
        title: "Job details imported",
        description: "Successfully scraped information from the job posting.",
      });
    } catch (err: any) {
      toast({
        title: "Scraping failed",
        description: err.message || "Could not retrieve details from the URL.",
        variant: "destructive",
      });
    }
  };

  // Full AI Regeneration Flow
  const handleAiGenerate = async (customInstructionOverride?: string) => {
    if (!coverLetter) return;
    try {
      const instructions = customInstructionOverride || localCustomInstructions;
      const res = await regenerateLetter({
        id: coverLetterId,
        data: {
          jobDescription: localJobDescription,
          tone: localTone,
          experienceLevel: localExperienceLevel,
          customInstructions: instructions,
        },
      });
      if (res?.generatedContent) {
        const parsed = parseCoverLetterContent(
          res.generatedContent,
          localHiringManager || "Hiring Manager",
          localSenderName || "Your Name",
          localSenderEmail,
          localSenderPhone,
          localSenderLocation,
          localCompanyName,
          localLocation,
          localJobTitle
        );
        
        const bodyTextWithSalutation = parsed.salutation 
          ? `${parsed.salutation}\n\n${parsed.paragraphs.join("\n\n")}` 
          : parsed.paragraphs.join("\n\n");

        const serialized = JSON.stringify({
          date: parsed.date,
          body: bodyTextWithSalutation,
          closing: parsed.signOff,
          signature: parsed.senderName,
          showSignatureDesign: localShowSignatureDesign
        });
        
        setLocalDate(parsed.date);
        setLocalBody(bodyTextWithSalutation);
        setLocalClosing(parsed.signOff);
        setLocalSignature(parsed.senderName);
        setLocalContent(serialized);
        
        await updateLetter({
          id: coverLetterId,
          data: {
            generatedContent: serialized,
          }
        });
      }
      refetchLetter();
      refetchVersions();
      toast({
        title: "Cover Letter generated",
        description: "AI has rewritten your cover letter according to instructions.",
      });
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message || "An error occurred during AI generation.",
        variant: "destructive",
      });
    }
  };

  // Quick AI edits: shorten, expand, polish
  const handleQuickEdit = async (action: "shorten" | "expand" | "polish") => {
    let instruction = "";
    if (action === "shorten") {
      instruction = "Make the cover letter shorter, punchier, and more concise. Target around 150-200 words.";
    } else if (action === "expand") {
      instruction = "Expand the cover letter slightly, detailing more professional achievements and projects. Target around 350-400 words.";
    } else if (action === "polish") {
      instruction = "Improve the word choice, polish the professional vocabulary, and fix all minor grammatical inconsistencies.";
    }

    toast({
      title: "Optimizing with AI...",
      description: "Refining the copy of your letter.",
    });
    await handleAiGenerate(instruction);
  };

  // Restore previous version
  const handleRestore = async (versionId: number) => {
    try {
      setHasLoadedInitial(false);
      await restoreVersion({ id: coverLetterId, versionId });
      refetchLetter();
      refetchVersions();
      toast({
        title: "Version restored",
        description: "Reverted cover letter to the selected historical snapshot.",
      });
    } catch (err: any) {
      toast({
        title: "Restore failed",
        description: err.message || "Could not restore version.",
        variant: "destructive",
      });
    }
  };

  // Run ATS Audit
  const handleRunAts = async () => {
    try {
      await runAtsAudit({
        id: coverLetterId,
        data: {
          jobDescription: localJobDescription,
        },
      });
      refetchLetter();
      toast({
        title: "ATS Audit Complete",
        description: "Matching keywords and score successfully analyzed.",
      });
    } catch (err: any) {
      toast({
        title: "Audit failed",
        description: err.message || "Could not execute ATS matching.",
        variant: "destructive",
      });
    }
  };

  // Download PDF file
  const handleDownloadPdf = async () => {
    try {
      const html = await buildSelfContainedExportHtml(coverLetter?.title || "Cover Letter");
      if (!html) throw new Error("Could not construct preview HTML structure.");

      const blob = await exportPdf({ data: { html } });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${coverLetter?.title || "cover-letter"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Your PDF cover letter has been generated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "PDF Export Failed",
        description: err.message || "Could not build PDF.",
        variant: "destructive",
      });
    }
  };

  // Download Word (DOCX) file
  const handleDownloadDocx = async () => {
    if (!coverLetter) return;
    try {
      const blob = await buildCoverLetterDocx({
        title: coverLetter.title || "Cover Letter",
        sender: {
          name: localSenderName,
          email: localSenderEmail,
          phone: localSenderPhone,
          location: localSenderLocation,
        },
        recipient: {
          hiringManagerName: localHiringManager,
          companyName: localCompanyName,
          companyLocation: localLocation,
        },
        jobTitle: localJobTitle,
        generatedContent: localContent,
        fontFamily: localFontFamily,
        accentColor: localAccentColor,
      }, {
        includeWatermark: showWatermark,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${coverLetter.title || "cover-letter"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "DOCX Exported",
        description: "Your Word cover letter is ready.",
      });
    } catch (err: any) {
      toast({
        title: "DOCX Export Failed",
        description: err.message || "Could not create Word document.",
        variant: "destructive",
      });
    }
  };

  if (isLoadingLetter) {
    return (
      <PremiumLoadingScreen
        title="Loading Cover Letter Workspace..."
        subtitle="Preparing your professional writing canvas"
      />
    );
  }

  if (!coverLetter) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-center p-6">
        <AlertCircle className="h-16 w-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-100 mb-2">Cover Letter Not Found</h2>
        <p className="text-slate-400 max-w-md mb-6">
          The cover letter workspace you are trying to access does not exist or has been deleted.
        </p>
        <Button onClick={() => setLocation("/dashboard?tab=cover-letters")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={`${localTitle || "Cover Letter Builder"} | ResumeSensei`}
        description="Create, edit, and optimize your cover letter using AI assistant."
      />

      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/60 px-3 sm:px-6 py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-3.5 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setLocation("/dashboard?tab=cover-letters")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col min-w-0 max-w-[180px] xs:max-w-[240px] sm:max-w-[360px] md:max-w-[450px] flex-1">
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="bg-transparent hover:bg-muted/40 focus:bg-muted/60 font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-0.5 text-xs sm:text-base truncate w-full min-w-0 transition-colors cursor-pointer focus:cursor-text"
              placeholder="Cover Letter Title"
            />
            <div className="flex items-center gap-1.5 px-2 mt-0.5">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-[10px] text-blue-500 font-medium hidden sm:inline">Saving changes...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-500 font-medium hidden sm:inline">All changes saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle className="h-3 w-3 text-rose-500" />
                  <span className="text-[10px] text-rose-500 font-medium hidden sm:inline">Failed to save draft</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Export Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm px-2.5 sm:px-3 h-8 sm:h-9">
                <FileDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-popover border border-border text-popover-foreground p-1.5" align="end">
              <button
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted rounded flex items-center justify-between font-medium"
              >
                <span>Export PDF</span>
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={handleDownloadDocx}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted rounded flex items-center justify-between font-medium mt-1"
              >
                <span>Export Word (.docx)</span>
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Main Workspace split screen */}
      <div className="flex items-start md:h-[calc(100svh-65px)] md:min-h-0 md:overflow-hidden">
        {/* LEFT COLUMN: Input form & AI dashboard */}
        <div
          className={`w-full md:h-full md:w-1/2 md:min-h-0 md:overflow-y-auto md:overscroll-contain border-r border-border/50 bg-background ${
            activeMobileTab === "edit" ? "block" : "hidden md:block"
          }`}
        >
          <div className="px-4 sm:px-6 py-6">
            <div className="space-y-8 max-w-xl mx-auto pb-24 md:pb-12">
              
              {/* Profile Linkage & Job Scraper */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-blue-500" /> Cover Letter Target
                  </h3>
                  {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                {/* Linked Resume Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Linked Resume Info</Label>
                  <Select
                    value={coverLetter.resumeId ? String(coverLetter.resumeId) : "none"}
                    onValueChange={(v) => handleSaveField("resumeId", v === "none" ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger className="bg-background border-border text-xs">
                      <SelectValue placeholder="No Linked Resume" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="none">Create Generic Letter (No Resume)</SelectItem>
                      {resumesList?.map((res) => (
                        <SelectItem key={res.id} value={String(res.id)}>
                          {res.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Linking a resume fills details like your contact information and experience blocks directly.
                  </p>
                </div>

                {/* Job Link scraper */}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs text-muted-foreground">Job URL Scraper</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="url"
                        placeholder="Paste LinkedIn, Indeed, Glassdoor job URL..."
                        value={localJobUrl}
                        onChange={(e) => setLocalJobUrl(e.target.value)}
                        className="pl-8 bg-background border-border text-xs h-9"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleScrapeUrl}
                      disabled={isScraping || !localJobUrl}
                      className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-xs shrink-0"
                    >
                      {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : "Scrape"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Job & Hiring Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Job & Recipient Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Job Title</Label>
                    <Input
                      placeholder="e.g. Frontend Engineer"
                      value={localJobTitle}
                      onChange={(e) => setLocalJobTitle(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company Name</Label>
                    <Input
                      placeholder="e.g. Google"
                      value={localCompanyName}
                      onChange={(e) => setLocalCompanyName(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hiring Manager</Label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={localHiringManager}
                      onChange={(e) => setLocalHiringManager(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company Location</Label>
                    <Input
                      placeholder="e.g. London, UK (or Remote)"
                      value={localLocation}
                      onChange={(e) => setLocalLocation(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Your Name</Label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={localSenderName}
                      onChange={(e) => setLocalSenderName(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Your Email</Label>
                    <Input
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={localSenderEmail}
                      onChange={(e) => setLocalSenderEmail(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Your Phone</Label>
                    <Input
                      placeholder="e.g. +1 123 456 7890"
                      value={localSenderPhone}
                      onChange={(e) => setLocalSenderPhone(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Your Location</Label>
                    <Input
                      placeholder="e.g. San Francisco, CA"
                      value={localSenderLocation}
                      onChange={(e) => setLocalSenderLocation(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Job Description</Label>
                  <Textarea
                    placeholder="Paste job description here to align cover letter highlights..."
                    value={localJobDescription}
                    onChange={(e) => setLocalJobDescription(e.target.value)}
                    rows={4}
                    className="bg-background border-border text-xs resize-none"
                  />
                </div>
              </div>

              {/* Cover Letter Content Sections */}
              <div className="space-y-5 border-t border-border/50 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Letter Content Sections
                </h3>

                <div className="space-y-4 bg-muted/30 border border-border/50 rounded-2xl p-4 shadow-inner">
                  {/* Date Field */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Date</Label>
                    <Input
                      placeholder="e.g. June 11, 2026"
                      value={localDate}
                      onChange={(e) => setLocalDate(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>

                  {/* Letter Body / Paragraphs */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold text-foreground">Letter Body / Paragraphs</Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {localBody.split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                    <Textarea
                      value={localBody}
                      onChange={(e) => setLocalBody(e.target.value)}
                      rows={10}
                      className="bg-background border-border text-xs leading-relaxed"
                      placeholder="Type the paragraphs of your letter here..."
                    />
                  </div>

                  {/* Closing & Signature Side-by-Side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Closing Sign-off</Label>
                      <Input
                        placeholder="e.g. Sincerely,"
                        value={localClosing}
                        onChange={(e) => setLocalClosing(e.target.value)}
                        className="bg-background border-border text-xs"
                      />
                    </div>
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Signature Name</Label>
                        <Input
                          placeholder="e.g. John Doe"
                          value={localSignature}
                          onChange={(e) => setLocalSignature(e.target.value)}
                          className="bg-background border-border text-xs mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2 pt-0.5">
                        <Switch
                          id="show-signature-design"
                          checked={localShowSignatureDesign}
                          onCheckedChange={setLocalShowSignatureDesign}
                        />
                        <Label htmlFor="show-signature-design" className="text-[10px] font-medium text-muted-foreground cursor-pointer select-none">
                          Show styled signature
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Toolbox */}
              <div className="bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-purple-500/10 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" /> AI Generation Panel
                  </h3>
                  <Wand2 className="h-4 w-4 text-purple-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Target Tone</Label>
                    <Select
                      value={localTone}
                      onValueChange={(v) => {
                        setLocalTone(v);
                        handleSaveField("tone", v);
                      }}
                    >
                      <SelectTrigger className="bg-background border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        {TONES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Experience Level</Label>
                    <Select
                      value={localExperienceLevel}
                      onValueChange={(v) => {
                        setLocalExperienceLevel(v);
                        handleSaveField("experienceLevel", v);
                      }}
                    >
                      <SelectTrigger className="bg-background border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        {EXPERIENCE_LEVELS.map((el) => (
                          <SelectItem key={el.value} value={el.value}>
                            {el.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Custom Instructions</Label>
                  <Textarea
                    placeholder="e.g. 'Highlight my experience with Next.js', 'Explain why I want to switch domains'..."
                    value={localCustomInstructions}
                    onChange={(e) => setLocalCustomInstructions(e.target.value)}
                    className="bg-background border-border text-xs"
                    rows={2}
                  />
                </div>

                {/* Regeneration Actions */}
                <div className="space-y-3 pt-1">
                  <Button
                    onClick={() => handleAiGenerate()}
                    disabled={isRegenerating}
                    className={`w-full text-xs sm:text-sm font-bold py-2.5 h-11 shadow-md transition-all duration-300 relative overflow-hidden ${
                      isRegenerating
                        ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white cursor-not-allowed shadow-purple-500/20"
                        : "bg-gradient-to-r from-primary to-purple-600 hover:opacity-95 text-primary-foreground shadow-primary/10"
                    }`}
                  >
                    {isRegenerating && (
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
                      {isRegenerating ? (
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
                                rotate: [0, 360, 720]
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            />
                          </motion.svg>
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={generationStep}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.2 }}
                            >
                              {generationSteps[generationStep]}
                            </motion.span>
                          </AnimatePresence>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" /> Generate Cover Letter with AI
                        </>
                      )}
                    </span>
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRegenerating}
                      onClick={() => handleQuickEdit("shorten")}
                      className="border-border hover:bg-muted hover:text-foreground text-[10px] h-8"
                    >
                      Shorten
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRegenerating}
                      onClick={() => handleQuickEdit("expand")}
                      className="border-border hover:bg-muted hover:text-foreground text-[10px] h-8"
                    >
                      Expand
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRegenerating}
                      onClick={() => handleQuickEdit("polish")}
                      className="border-border hover:bg-muted hover:text-foreground text-[10px] h-8"
                    >
                      Polish Copy
                    </Button>
                  </div>
                </div>
              </div>

              {/* Real-time ATS Audit Audit Panel */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> ATS Audit Panel
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRunAts}
                    disabled={isAuditing || !localJobDescription}
                    className="text-xs text-muted-foreground hover:text-foreground h-7"
                  >
                    {isAuditing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" /> Run Audit
                      </>
                    )}
                  </Button>
                </div>

                {!coverLetter.atsScore ? (
                  <div className="text-center py-4 bg-muted/20 rounded-xl border border-border/30">
                    <p className="text-xs text-muted-foreground">
                      No ATS match scores run yet. Click &quot;Run Audit&quot; above to align with job description.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Score Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>ATS Match Score</span>
                        <span className={coverLetter.atsScore >= 70 ? "text-emerald-500" : "text-amber-500"}>
                          {coverLetter.atsScore}/100
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            coverLetter.atsScore >= 70 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${coverLetter.atsScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Keywords Checklist */}
                    {coverLetter.atsKeywords && (
                      <div className="space-y-2 pt-1">
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                          Identified Keywords
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(coverLetter.atsKeywords as string[]).map((kw, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback checklist */}
                    {coverLetter.atsFeedback && (
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                          Audit Insights
                        </Label>
                        <ul className="text-xs space-y-1.5 text-foreground">
                          {(coverLetter.atsFeedback as string[]).map((fb, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                               <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{fb}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Version History */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Version History
                </h3>

                {!versions || versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No versions created yet. Making edits/regenerating saves history.
                  </p>
                ) : (
                  <div className="border border-border rounded-2xl overflow-hidden bg-muted/10 divide-y divide-border max-h-60 overflow-y-auto">
                    {versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="px-4 py-3 flex items-center justify-between text-xs hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {ver.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(ver.createdAt || "").toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRestore(ver.id)}
                          disabled={isRestoring}
                          className="text-xs text-blue-600 hover:text-blue-700 h-7"
                        >
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Style controls & Live A4 preview canvas */}
        <div
          className={`w-full md:flex md:h-full md:w-1/2 md:min-h-0 md:flex-col bg-muted/30 overflow-hidden ${
            activeMobileTab === "preview" ? "block" : "hidden md:flex"
          }`}
        >
          {/* Style toolbar */}
          <div className="shrink-0 bg-card border-b border-border/50 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Template Select */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Template Layout</span>
                <Select
                  value={localTemplateId}
                  onValueChange={(v) => {
                    const template = TEMPLATES.find((t) => t.id === v);
                    if (template?.isPremium && !isPremiumUser) {
                      setPaywallTitle("Premium Template Layout");
                      setPaywallDescription(
                        `The ${template.name} template layout is reserved for Pro users. Upgrade to unlock all premium template layouts, unlimited AI writing assistance, and ATS optimization.`
                      );
                      setShowPaywall(true);
                      return;
                    }
                    setLocalTemplateId(v);
                    handleSaveField("templateId", v);
                  }}
                >
                  <SelectTrigger className="bg-background border-border h-8 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{t.name}</span>
                          {t.isPremium && !isPremiumUser && (
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0 ml-1" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accent Color picker */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Accent</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="h-8 w-12 rounded border border-border flex items-center justify-center transition-colors"
                      style={{ backgroundColor: localAccentColor }}
                    >
                      <Palette className="h-3.5 w-3.5 text-white mix-blend-difference" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 bg-popover border border-border p-3" align="start">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Preset Accents</p>
                    <div className="grid grid-cols-4 gap-2">
                      {ACCENT_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => {
                            setLocalAccentColor(c.value);
                            handleSaveField("accentColor", c.value);
                          }}
                          className="h-7 w-full rounded border border-border relative transition-transform hover:scale-105"
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {localAccentColor === c.value && (
                            <Check className="h-3 w-3 absolute inset-0 m-auto text-white mix-blend-difference" />
                          )}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Font Family selector */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Typography</span>
                <Select
                  value={localFontFamily}
                  onValueChange={(v) => {
                    setLocalFontFamily(v);
                    handleSaveField("fontFamily", v);
                  }}
                >
                  <SelectTrigger className="bg-background border-border h-8 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    <SelectItem value="sans">Modern Sans</SelectItem>
                    <SelectItem value="serif">Elegant Serif</SelectItem>
                    <SelectItem value="mono">Classic Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size adjustment */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Font Size ({localFontSize}px)</span>
                <div className="flex items-center gap-2 h-8 w-32 px-1">
                  <Slider
                    min={12}
                    max={20}
                    step={0.5}
                    value={[localFontSize]}
                    onValueChange={(val) => setLocalFontSize(val[0])}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/85 rounded"
                onClick={() => zoomPreviewAt(zoom - 0.1)}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-bold font-mono px-1 w-10 text-center text-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/85 rounded"
                onClick={() => zoomPreviewAt(zoom + 0.1)}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <div className="h-4 w-px bg-border mx-0.5" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/85 rounded"
                onClick={fitPreviewToViewport}
                aria-label="Fit cover letter to preview"
                title="Fit to preview"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Preview canvas */}
          <div className="h-[clamp(430px,calc(100svh-245px),620px)] sm:h-[clamp(500px,calc(100svh-230px),700px)] md:h-auto md:min-h-0 md:flex-1 bg-gradient-to-br from-muted/50 via-muted/25 to-background p-3 sm:p-5 pb-3 sm:pb-5 relative">
            <AnimatePresence>
              {isRegenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-background/60 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="max-w-md w-full bg-card/95 border border-border/80 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col items-center text-center gap-6"
                  >
                    {/* Glowing background animation */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />

                    {/* Circular AI icon group */}
                    <div className="relative h-20 w-20 flex items-center justify-center">
                      {/* Rotating outer ring */}
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-dashed border-primary/45"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      />
                      {/* Pulsing inner glow */}
                      <motion.div
                        className="absolute h-14 w-14 rounded-full bg-primary/5 flex items-center justify-center"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <Sparkles className="h-7 w-7 text-primary relative z-10" />
                    </div>

                    <div className="space-y-2 relative z-10">
                      <h4 className="text-base font-bold text-foreground tracking-tight">
                        AI Tailoring in Progress
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-[280px]">
                        Drafting a custom letter optimized for ATS keywords and tone.
                      </p>
                    </div>

                    {/* Circular loading bar indicator */}
                    <div className="w-full flex flex-col items-center gap-3 relative z-10">
                      <div className="flex items-center gap-2.5 px-4 py-2 bg-muted/60 rounded-full border border-border/40">
                        {/* Circular progress loader */}
                        <motion.svg
                          className="h-4 w-4 text-primary shrink-0"
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
                            className="opacity-20"
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
                              rotate: [0, 360, 720]
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        </motion.svg>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={generationStep}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2 }}
                            className="text-xs font-semibold text-primary font-mono tracking-tight"
                          >
                            {generationSteps[generationStep]}
                          </motion.span>
                        </AnimatePresence>
                      </div>

                      {/* Dot loading animation */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              ref={previewViewportRef}
              className={`relative h-full w-full overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_center,hsl(var(--muted-foreground)/0.09)_1px,transparent_1px)] bg-[length:18px_18px] shadow-[inset_0_1px_0_hsl(var(--background)/0.8),0_18px_50px_-28px_rgba(15,23,42,0.45)] select-none touch-none overscroll-none ${
                isPreviewDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={handlePreviewPointerEnd}
              onPointerCancel={handlePreviewPointerEnd}
              onWheel={handlePreviewWheel}
              onKeyDown={handlePreviewKeyDown}
              tabIndex={0}
              role="application"
              aria-label="Interactive cover letter preview. Drag or use arrow keys to pan. Pinch, use plus and minus, or use the controls to zoom. Press zero to fit."
            >
              <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-sm backdrop-blur-md">
                <Move className="h-3 w-3" />
                <span className="hidden sm:inline">Drag to explore</span>
                <span className="sm:hidden">Drag</span>
                <span className="text-border">|</span>
                <span>Pinch to zoom</span>
              </div>

              <div
                className="absolute left-0 top-0 will-change-transform"
                style={{
                  width: COVER_LETTER_WIDTH,
                  height: COVER_LETTER_HEIGHT,
                  transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              >
                <div data-resume-export-target="true">
                  <CoverLetterPreview
                    content={localContent}
                    senderName={localSenderName}
                    senderEmail={localSenderEmail}
                    senderPhone={localSenderPhone}
                    senderLocation={localSenderLocation}
                    recipientName={localHiringManager}
                    companyName={localCompanyName}
                    companyLocation={localLocation}
                    jobTitle={localJobTitle}
                    templateId={localTemplateId}
                    accentColor={localAccentColor}
                    fontFamily={localFontFamily}
                    zoom={1}
                    showWatermark={showWatermark}
                    showSignatureDesign={localShowSignatureDesign}
                    fontSize={localFontSize}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-xl border-t border-border flex items-center justify-around z-50">
        <button
          onClick={() => setActiveMobileTab("edit")}
          className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${
            activeMobileTab === "edit" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Edit className="h-4 w-4 mb-0.5" />
          Edit
        </button>
        <button
          onClick={() => setActiveMobileTab("preview")}
          className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium border-l border-border transition-colors ${
            activeMobileTab === "preview" ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Eye className="h-4 w-4 mb-0.5" />
          Preview
        </button>
      </div>

      <PaywallDialog
        open={showPaywall}
        onOpenChange={setShowPaywall}
        title={paywallTitle}
        description={paywallDescription}
      />
    </div>
  );
}
