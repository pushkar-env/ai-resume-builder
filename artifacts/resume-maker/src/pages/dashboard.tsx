import { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { motion, useAnimationControls, type Variants } from "framer-motion";
import { Plus, FileText, Copy, Trash2, MoreHorizontal, Clock, Pencil, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/shared/SEO";
import { ResumePreview } from "@/components/resume/ResumePreview";
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
function ResumeThumbnail({ resumeId }: { resumeId: number }) {
  const { user } = useUser();
  const showWatermark = user?.publicMetadata?.isPremium !== true;
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [fontScale, setFontScale] = useState<number>(1);

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
    query: { queryKey: getGetResumeQueryKey(resumeId), enabled: inView },
  });

  // Preview zoom is persisted per resume in the builder; font/color come from the API on `resume`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(`resumeFontScale:${resumeId}`);
    const n = v ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) setFontScale(n);
  }, [resumeId]);

  return (
    <div
      ref={hostRef}
      className="w-full h-full min-h-[1px] relative overflow-hidden bg-muted/10 pointer-events-none [content-visibility:visible]"
    >
      {!inView || !resume ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : (
        <ScaledResumeThumbnailShell
          hostClassName="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none"
          measureDeps={[resume.id, resume.templateId, resume.updatedAt, fontScale, showWatermark]}
        >
          <ResumePreview
            layout="continuous"
            resume={resume}
            accentColor={resume.accentColor ?? getDefaultAccentColor(resume.templateId)}
            fontScale={fontScale}
            fontColor={resume.fontColor ?? "#111827"}
            backgroundColor={resume.backgroundColor ?? "#ffffff"}
            showWatermark={showWatermark}
          />
        </ScaledResumeThumbnailShell>
      )}
    </div>
  );
}

function DashboardResumeCard({
  resume,
  fadeUp,
  coarsePointer,
  navigate,
  setRenameTitle,
  setRenameId,
  setDeleteId,
  handleDuplicateRequest,
}: {
  resume: Resume;
  fadeUp: Variants;
  coarsePointer: boolean;
  navigate: (path: string) => void;
  setRenameTitle: (t: string) => void;
  setRenameId: (id: number | null) => void;
  setDeleteId: (id: number | null) => void;
  handleDuplicateRequest: (id: number) => void;
}) {
  const [resumeMenuOpen, setResumeMenuOpen] = useState(false);
  const menuSlipRef = useRef(false);
  const menuStartRef = useRef({ x: 0, y: 0 });
  const hoverControls = useAnimationControls();
  const isHoveringRef = useRef(false);

  // When the menu closes, settle the card back to rest if the mouse already left
  useEffect(() => {
    if (!resumeMenuOpen && !isHoveringRef.current) {
      hoverControls.start({ y: 0, scale: 1, transition: previewCardHoverTransition });
    }
  }, [resumeMenuOpen, hoverControls]);

  return (
    <motion.div variants={fadeUp} className="h-full">
      <motion.div
        className="h-full"
        animate={hoverControls}
        onHoverStart={() => {
          if (coarsePointer || resumeMenuOpen) return;
          isHoveringRef.current = true;
          hoverControls.start({ ...previewCardWhileHover, transition: previewCardHoverTransition });
        }}
        onHoverEnd={() => {
          isHoveringRef.current = false;
          if (resumeMenuOpen) return;
          hoverControls.start({ y: 0, scale: 1, transition: previewCardHoverTransition });
        }}
      >
      <Card
        className="h-full flex flex-col group cursor-pointer border-border relative overflow-hidden touch-manipulation shadow transition-[box-shadow,border-color] duration-300 hover:shadow-xl hover:border-primary/45"
        onClick={() => navigate(`/builder/${resume.id}`)}
      >
        <div className="h-[220px] w-full border-b border-border/40 relative overflow-hidden shrink-0 isolate">
          <ResumeThumbnail resumeId={resume.id} />
        </div>

        <CardContent className="p-5 flex-1 flex flex-col bg-card relative z-10">
          <div className="flex items-start justify-between mb-auto">
            <div className="flex-1 min-w-0 pr-14 md:pr-6">
              <h3 className="font-semibold text-base truncate mb-1">{resume.title}</h3>
              <span
                className={`inline-block text-[11px] px-2.5 py-0.5 rounded-md font-medium ${templateColors[resume.templateId] ?? "bg-muted text-muted-foreground"}`}
              >
                {resume.templateId.charAt(0).toUpperCase() + resume.templateId.slice(1)} Template
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
                  className="h-10 w-10 min-h-10 min-w-10 md:h-7 md:w-7 md:min-h-0 md:min-w-0 p-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 md:top-4 md:right-4 bg-background/80 backdrop-blur-sm shadow-sm md:shadow-none focus-visible:ring-0 focus:outline-none [-webkit-tap-highlight-color:transparent] touch-manipulation"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (!coarsePointer) return;
                    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
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
                    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                    const s = menuStartRef.current;
                    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) menuSlipRef.current = true;
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
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
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
}

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

  const { user } = useUser();
  const isPremiumUser = user?.publicMetadata?.isPremium === true;

  const { data: resumes, isLoading: resumesLoading } = useListResumes();
  const resumeList = useMemo(() => {
    const list = Array.isArray(resumes) ? resumes : [];
    return [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [resumes]);

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
    if (!isPremiumUser && resumeList.length >= 1) {
      setShowPaywall(true);
      return;
    }
    setCreateOpen(true);
  };

  const handleDuplicateRequest = (id: number) => {
    if (!isPremiumUser && resumeList.length >= 1) {
      setShowPaywall(true);
      return;
    }
    duplicateResume.mutate({ id });
  };

  const importResume = useImportResume({
    mutation: {
      onSuccess: (data: Resume) => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        toast({ title: "Resume imported successfully" });
        navigate(`/builder/${data.id}`);
      },
      onError: (error: any) => {
        toast({ 
          title: "Failed to import resume", 
          description: error?.message || "Ensure the file is a valid PDF or DOCX.", 
          variant: "destructive" 
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    },
  });

  const handleImportClick = () => {
    if (!isPremiumUser && resumeList.length >= 1) {
      setShowPaywall(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Pass the file to the mutation
    importResume.mutate({ data: { file } });
  };

  const createResume = useCreateResume({
    mutation: {
      onSuccess: (data: Resume) => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        setCreateOpen(false);
        navigate(`/builder/${data.id}`);
      },
      onError: (error: any) => toast({ title: "Failed to create resume", description: error?.message || "Unknown error occurred", variant: "destructive" }),
    },
  });

  const deleteResume = useDeleteResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        setDeleteId(null);
        toast({ title: "Resume deleted" });
      },
      onError: () => toast({ title: "Failed to delete resume", variant: "destructive" }),
    },
  });

  const duplicateResume = useDuplicateResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        toast({ title: "Resume duplicated" });
      },
    },
  });

  const updateResume = useUpdateResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        setRenameId(null);
        toast({ title: "Resume renamed" });
      },
      onError: () => toast({ title: "Failed to rename resume", variant: "destructive" }),
    },
  });

  const stagger = coarsePointer
    ? { hidden: {}, visible: { transition: { staggerChildren: 0 } } }
    : { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = coarsePointer
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <SEO 
        title="Dashboard | Resumesensei"
        description="Manage your AI-powered resumes and access premium templates."
      />
      <Navbar />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Resumes</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage and build your professional resumes</p>
          </div>
        </div>

        {resumesLoading ? (
          <PremiumLoadingScreen title="Fetching your resumes" subtitle="Preparing your dashboard" />
        ) : (
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
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
                <p className="text-xs text-muted-foreground mt-1">Start from a blank template</p>
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
                    <p className="text-xs text-muted-foreground mt-1">Extracting with AI</p>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <FileUp className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm">Import Resume</h3>
                    <p className="text-xs text-muted-foreground mt-1">Upload PDF or DOCX</p>
                  </>
                )}
              </div>
            </motion.div>

            {/* Existing Resumes */}
            {resumeList.map((resume) => (
              <DashboardResumeCard
                key={resume.id}
                resume={resume}
                fadeUp={fadeUp}
                coarsePointer={coarsePointer}
                navigate={navigate}
                setRenameTitle={setRenameTitle}
                setRenameId={setRenameId}
                setDeleteId={setDeleteId}
                handleDuplicateRequest={handleDuplicateRequest}
              />
            ))}
          </motion.div>
        )}
      </main>

      <AppFooter />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (open) setStartWithSampleContent(true);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new resume</DialogTitle>
            <DialogDescription>
              Choose a title and whether to start from sample content or empty sections.
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
                    const cfg = TEMPLATE_CONFIG["silicon-valley"] ?? { accent: "#000000" };
                    createResume.mutate({
                      data: { title: newTitle, templateId: "silicon-valley", accentColor: cfg.accent, startPrefilled: startWithSampleContent },
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
                <p id="start-sample-hint" className="text-xs text-muted-foreground leading-snug">
                  When on, your new resume includes example text so layouts look filled. Turn off to start with empty fields for each template section.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                <span className="text-xs text-muted-foreground sm:hidden">Sample content</span>
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const cfg = TEMPLATE_CONFIG["silicon-valley"] ?? { accent: "#000000" };
                createResume.mutate({
                  data: { title: newTitle, templateId: "silicon-valley", accentColor: cfg.accent, startPrefilled: startWithSampleContent },
                });
              }}
              disabled={createResume.isPending || !newTitle.trim()}
            >
              {createResume.isPending ? "Creating..." : "Create resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameId !== null} onOpenChange={(o) => !o && setRenameId(null)}>
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
                    updateResume.mutate({ id: renameId, data: { title: renameTitle } });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
            <Button
              onClick={() => renameId !== null && updateResume.mutate({ id: renameId, data: { title: renameTitle } })}
              disabled={updateResume.isPending || !renameTitle.trim()}
            >
              {updateResume.isPending ? "Renaming..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resume?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Your resume and all its content will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteResume.mutate({ id: deleteId })}
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
    </div>
  );
}
