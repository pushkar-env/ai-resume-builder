import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, type Variants } from "framer-motion";
import { Plus, FileText, Copy, Trash2, MoreHorizontal, Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/shared/SEO";
import { ResumePreview } from "@/components/resume/ResumePreview";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/Navbar";
import { AppFooter } from "@/components/layout/AppFooter";
import {
  useListResumes,
  useCreateResume,
  useDeleteResume,
  useDuplicateResume,
  useUpdateResume,
  useGetResume,
  getListResumesQueryKey,
  type Resume,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { PaywallDialog } from "@/components/shared/PaywallDialog";

const templateColors: Record<string, string> = {
  modern: "bg-violet-100 text-violet-700",
  minimal: "bg-slate-100 text-slate-700",
  corporate: "bg-blue-100 text-blue-700",
  creative: "bg-pink-100 text-pink-700",
  "ats-friendly": "bg-green-100 text-green-700",
  developer: "bg-orange-100 text-orange-700",
  executive: "bg-amber-100 text-amber-700",
  startup: "bg-cyan-100 text-cyan-700",
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
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [fontColor, setFontColor] = useState<string>("#111827");
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
    query: { enabled: inView },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = window.localStorage.getItem(`resumeFontColor:${resumeId}`);
    if (c) setFontColor(c);
    const v = window.localStorage.getItem(`resumeFontScale:${resumeId}`);
    const n = v ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) setFontScale(n);
  }, [resumeId]);

  return (
    <div ref={hostRef} className="w-full h-full min-h-[1px] relative overflow-hidden bg-muted/10 pointer-events-none">
      {!inView || !resume ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : (
        <div className="w-full h-full relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{
              width: 794,
              transform: "scale(0.32) translateZ(0)",
              transformOrigin: "top center",
              backfaceVisibility: "hidden",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            <ResumePreview
              resume={resume}
              accentColor={resume.accentColor ?? "#7c3aed"}
              fontScale={fontScale}
              fontColor={fontColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const resumeCardMotionTransition = { type: "spring" as const, stiffness: 420, damping: 28 };

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
  return (
    <motion.div
      variants={fadeUp}
      className="h-full"
      transition={resumeCardMotionTransition}
      whileHover={coarsePointer ? undefined : { y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
    >
      <Card
        className="h-full flex flex-col group cursor-pointer border-border relative overflow-hidden touch-manipulation shadow transition-[box-shadow,border-color] duration-300 hover:shadow-xl hover:border-primary/40"
        onClick={() => navigate(`/builder/${resume.id}`)}
      >
        <div className="h-[220px] w-full border-b border-border/40 relative overflow-hidden shrink-0 isolate">
          <ResumeThumbnail resumeId={resume.id} />
        </div>

        <CardContent className="p-5 flex-1 flex flex-col bg-card relative z-10">
          <div className="flex items-start justify-between mb-auto">
            <div className="flex-1 min-w-0 pr-6">
              <h3 className="font-semibold text-base truncate mb-1">{resume.title}</h3>
              <span
                className={`inline-block text-[11px] px-2.5 py-0.5 rounded-md font-medium ${templateColors[resume.templateId] ?? "bg-muted text-muted-foreground"}`}
              >
                {resume.templateId.charAt(0).toUpperCase() + resume.templateId.slice(1)} Template
              </span>
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-background/80 backdrop-blur-sm shadow-sm md:shadow-none focus-visible:ring-0 focus:outline-none [-webkit-tap-highlight-color:transparent]"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
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

  const { user } = useUser();
  const isPremiumUser = user?.publicMetadata?.isPremium === true;

  const { data: resumes, isLoading: resumesLoading } = useListResumes();
  const resumeList = Array.isArray(resumes) ? resumes : [];

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

  const createResume = useCreateResume({
    mutation: {
      onSuccess: (data) => {
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
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Dashboard | ResumeSensei"
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-40">
                <CardContent className="p-5 h-full flex flex-col justify-between">
                  <div>
                    <Skeleton className="h-5 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                  </div>
                  <Skeleton className="h-4 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new resume</DialogTitle>
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
                  if (e.key === "Enter") createResume.mutate({ data: { title: newTitle, templateId: "faang" } });
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createResume.mutate({ data: { title: newTitle, templateId: "faang" } })}
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
