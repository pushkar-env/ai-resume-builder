import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CoverLetterPreview } from "@/components/resume/CoverLetterPreview";
import { buildCoverLetterDocx } from "@/lib/build-cover-letter-docx";
import { buildSelfContainedExportHtml } from "@/lib/resume-export-html";

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
  { id: "creative", name: "Creative Edge" },
  { id: "elegant", name: "Elegant Editorial" },
  { id: "professional", name: "Executive Professional" },
  { id: "startup", name: "Tech Startup" },
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

export default function CoverLetterBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const coverLetterId = parseInt(id || "", 10);
  const { toast } = useToast();
  const { user } = useUser();
  const showWatermark = user?.publicMetadata?.isPremium !== true;

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

  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Local style overrides (since cover letter model doesn't store fonts/colors directly)
  const [localFontFamily, setLocalFontFamily] = useState("sans");
  const [localAccentColor, setLocalAccentColor] = useState("#1e3a8a");

  // Preview zoom factor
  const [zoom, setZoom] = useState(0.75);

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
      setLocalContent(coverLetter.generatedContent || "");
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

      setHasLoadedInitial(true);
    }
  }, [coverLetter, linkedResume, hasLoadedInitial, user]);

  // Initialize responsive zoom factor based on viewport width
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 640) {
        setZoom(0.42);
      } else if (window.innerWidth < 1024) {
        setZoom(0.6);
      } else {
        setZoom(0.75);
      }
    }
  }, []);

  // Track user edits after initial load is done
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
      await regenerateLetter({
        id: coverLetterId,
        data: {
          jobDescription: localJobDescription,
          tone: coverLetter.tone || "professional",
          experienceLevel: coverLetter.experienceLevel || "mid",
          customInstructions: instructions,
        },
      });
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
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center gap-4 text-slate-100">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium tracking-wide text-slate-400">
          Loading Cover Letter Workspace...
        </p>
      </div>
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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col overflow-hidden">
      <SEO
        title={`${localTitle || "Cover Letter Builder"} | ResumeSensei`}
        description="Create, edit, and optimize your cover letter using AI assistant."
      />

      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60 px-3 sm:px-6 py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-3.5 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 shrink-0 h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setLocation("/dashboard?tab=cover-letters")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col min-w-0 flex-1">
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="bg-transparent font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-xs sm:text-base truncate w-full min-w-0"
              placeholder="Cover Letter Title"
            />
            <div className="flex items-center gap-1.5 px-1 mt-0.5">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                  <span className="text-[10px] text-blue-400 font-medium hidden sm:inline">Saving changes...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline">All changes saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle className="h-3 w-3 text-rose-400" />
                  <span className="text-[10px] text-rose-400 font-medium hidden sm:inline">Failed to save draft</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile view toggle */}
          <div className="flex md:hidden bg-slate-900 rounded-lg p-0.5 border border-slate-800 shrink-0">
            <Button
              variant={activeMobileTab === "edit" ? "secondary" : "ghost"}
              size="sm"
              className="px-2.5 sm:px-3 py-1 text-xs h-7"
              onClick={() => setActiveMobileTab("edit")}
            >
              <Edit className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button
              variant={activeMobileTab === "preview" ? "secondary" : "ghost"}
              size="sm"
              className="px-2.5 sm:px-3 py-1 text-xs h-7"
              onClick={() => setActiveMobileTab("preview")}
            >
              <Eye className="h-3 w-3 mr-1" /> Preview
            </Button>
          </div>

          {/* Export Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-slate-50 text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 px-2.5 sm:px-3 h-8 sm:h-9">
                <FileDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-slate-950 border border-slate-800 text-slate-200 p-1.5" align="end">
              <button
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800/80 rounded flex items-center justify-between font-medium"
              >
                <span>Export PDF</span>
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>
              <button
                onClick={handleDownloadDocx}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800/80 rounded flex items-center justify-between font-medium mt-1"
              >
                <span>Export Word (.docx)</span>
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Main Workspace split screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Input form & AI dashboard */}
        <div
          className={`w-full md:w-1/2 flex flex-col border-r border-slate-800/50 bg-[#0c1220]/60 ${
            activeMobileTab === "edit" ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="space-y-8 max-w-xl mx-auto pb-12">
              
              {/* Profile Linkage & Job Scraper */}
              <div className="bg-slate-900/60 backdrop-blur border border-slate-800/70 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-blue-500" /> Cover Letter Target
                  </h3>
                  {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                </div>

                {/* Linked Resume Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Linked Resume Info</Label>
                  <Select
                    value={coverLetter.resumeId ? String(coverLetter.resumeId) : "none"}
                    onValueChange={(v) => handleSaveField("resumeId", v === "none" ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
                      <SelectValue placeholder="No Linked Resume" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectItem value="none">Create Generic Letter (No Resume)</SelectItem>
                      {resumesList?.map((res) => (
                        <SelectItem key={res.id} value={String(res.id)}>
                          {res.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Linking a resume fills details like your contact information and experience blocks directly.
                  </p>
                </div>

                {/* Job Link scraper */}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs text-slate-400">Job URL Scraper</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                      <Input
                        type="url"
                        placeholder="Paste LinkedIn, Indeed, Glassdoor job URL..."
                        value={localJobUrl}
                        onChange={(e) => setLocalJobUrl(e.target.value)}
                        className="pl-8 bg-slate-950 border-slate-800 text-xs h-9"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleScrapeUrl}
                      disabled={isScraping || !localJobUrl}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs shrink-0"
                    >
                      {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : "Scrape"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Job & Hiring Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Job & Recipient Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Job Title</Label>
                    <Input
                      placeholder="e.g. Frontend Engineer"
                      value={localJobTitle}
                      onChange={(e) => setLocalJobTitle(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company Name</Label>
                    <Input
                      placeholder="e.g. Google"
                      value={localCompanyName}
                      onChange={(e) => setLocalCompanyName(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
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
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company Location</Label>
                    <Input
                      placeholder="e.g. London, UK (or Remote)"
                      value={localLocation}
                      onChange={(e) => setLocalLocation(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/40">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Your Name</Label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={localSenderName}
                      onChange={(e) => setLocalSenderName(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Your Email</Label>
                    <Input
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={localSenderEmail}
                      onChange={(e) => setLocalSenderEmail(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Your Phone</Label>
                    <Input
                      placeholder="e.g. +1 123 456 7890"
                      value={localSenderPhone}
                      onChange={(e) => setLocalSenderPhone(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Your Location</Label>
                    <Input
                      placeholder="e.g. San Francisco, CA"
                      value={localSenderLocation}
                      onChange={(e) => setLocalSenderLocation(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-xs"
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
                    className="bg-slate-900 border-slate-800 text-xs resize-none"
                  />
                </div>
              </div>

              {/* Cover Letter Content Body */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Letter Body Copy
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {localContent.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <Textarea
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  rows={12}
                  className="bg-slate-900 border-slate-800 text-xs font-mono leading-relaxed"
                  placeholder="Dear Hiring Manager..."
                />
              </div>

              {/* AI Toolbox */}
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-850/80 rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" /> AI Generation Panel
                  </h3>
                  <Wand2 className="h-4 w-4 text-purple-400/60" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Target Tone</Label>
                    <Select
                      value={coverLetter.tone || "professional"}
                      onValueChange={(v) => handleSaveField("tone", v)}
                    >
                      <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                        {TONES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Experience Level</Label>
                    <Select
                      value={coverLetter.experienceLevel || "mid"}
                      onValueChange={(v) => handleSaveField("experienceLevel", v)}
                    >
                      <SelectTrigger className="bg-slate-900 border-slate-800 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
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
                  <Label className="text-xs text-slate-400">Custom Instructions</Label>
                  <Textarea
                    placeholder="e.g. 'Highlight my experience with Next.js', 'Explain why I want to switch domains'..."
                    value={localCustomInstructions}
                    onChange={(e) => setLocalCustomInstructions(e.target.value)}
                    className="bg-slate-900 border-slate-800 text-xs"
                    rows={2}
                  />
                </div>

                {/* Regeneration Actions */}
                <div className="space-y-3 pt-1">
                  <Button
                    onClick={() => handleAiGenerate()}
                    disabled={isRegenerating}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-slate-50 text-xs sm:text-sm font-bold py-2 shadow-lg shadow-purple-500/10"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Letter...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" /> Generate Cover Letter with AI
                      </>
                    )}
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRegenerating}
                      onClick={() => handleQuickEdit("shorten")}
                      className="border-slate-800 hover:bg-slate-800/50 hover:text-slate-100 text-[10px] h-8"
                    >
                      Shorten
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRegenerating}
                      onClick={() => handleQuickEdit("expand")}
                      className="border-slate-800 hover:bg-slate-800/50 hover:text-slate-100 text-[10px] h-8"
                    >
                      Expand
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRegenerating}
                      onClick={() => handleQuickEdit("polish")}
                      className="border-slate-800 hover:bg-slate-800/50 hover:text-slate-100 text-[10px] h-8"
                    >
                      Polish Copy
                    </Button>
                  </div>
                </div>
              </div>

              {/* Real-time ATS Audit Audit Panel */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> ATS Audit Panel
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRunAts}
                    disabled={isAuditing || !localJobDescription}
                    className="text-xs text-slate-400 hover:text-slate-200 h-7"
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
                  <div className="text-center py-4 bg-slate-950/40 rounded-xl border border-slate-800/30">
                    <p className="text-xs text-slate-400">
                      No ATS match scores run yet. Click &quot;Run Audit&quot; above to align with job description.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Score Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>ATS Match Score</span>
                        <span className={coverLetter.atsScore >= 70 ? "text-emerald-400" : "text-amber-400"}>
                          {coverLetter.atsScore}/100
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
                        <Label className="text-[11px] text-slate-400 uppercase tracking-wider block">
                          Identified Keywords
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(coverLetter.atsKeywords as string[]).map((kw, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/70 text-slate-300 border border-slate-800"
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
                        <Label className="text-[11px] text-slate-400 uppercase tracking-wider block">
                          Audit Insights
                        </Label>
                        <ul className="text-xs space-y-1.5 text-slate-300">
                          {(coverLetter.atsFeedback as string[]).map((fb, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Version History
                </h3>

                {!versions || versions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No versions created yet. Making edits/regenerating saves history.
                  </p>
                ) : (
                  <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/30 divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                    {versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="px-4 py-3 flex items-center justify-between text-xs hover:bg-slate-900/30"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-300 truncate">
                            {ver.title}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(ver.createdAt || "").toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRestore(ver.id)}
                          disabled={isRestoring}
                          className="text-xs text-blue-400 hover:text-blue-300 h-7"
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
          className={`w-full md:w-1/2 flex flex-col bg-slate-950/40 overflow-hidden ${
            activeMobileTab === "preview" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Style toolbar */}
          <div className="bg-[#0c111c] border-b border-slate-800/50 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Template Select */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Template Layout</span>
                <Select
                  value={coverLetter.templateId || "classic"}
                  onValueChange={(v) => handleSaveField("templateId", v)}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-800 h-8 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accent Color picker */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Accent</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="h-8 w-12 rounded border border-slate-800 flex items-center justify-center transition-colors"
                      style={{ backgroundColor: localAccentColor }}
                    >
                      <Palette className="h-3.5 w-3.5 text-white mix-blend-difference" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 bg-slate-950 border border-slate-800 p-3" align="start">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preset Accents</p>
                    <div className="grid grid-cols-4 gap-2">
                      {ACCENT_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => {
                            setLocalAccentColor(c.value);
                            handleSaveField("accentColor", c.value);
                          }}
                          className="h-7 w-full rounded border border-slate-800 relative transition-transform hover:scale-105"
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
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Typography</span>
                <Select
                  value={localFontFamily}
                  onValueChange={(v) => {
                    setLocalFontFamily(v);
                    handleSaveField("fontFamily", v);
                  }}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-800 h-8 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectItem value="sans">Modern Sans</SelectItem>
                    <SelectItem value="serif">Elegant Serif</SelectItem>
                    <SelectItem value="mono">Classic Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-100"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-bold font-mono px-1 w-9 text-center text-slate-400">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-100"
                onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Preview canvas */}
          <div className="flex-1 overflow-auto bg-[#141a29]/40 flex justify-center p-8 relative">
            <div
              className="origin-top"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
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
                  templateId={coverLetter.templateId || "classic"}
                  accentColor={localAccentColor}
                  fontFamily={localFontFamily}
                  zoom={1} // Keep raw zoom as 1 inside scale transform wrapper
                  showWatermark={showWatermark}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
