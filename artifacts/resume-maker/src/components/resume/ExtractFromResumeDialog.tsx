import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Sparkles, Check, AlertTriangle } from "lucide-react";
import type { Resume } from "@workspace/api-client-react";

interface ExtractFromResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumes: Resume[];
  isExtracting: boolean;
  /** Called with the chosen resume id when the user confirms extraction. */
  onConfirm: (resumeId: number) => void;
}

function timeAgo(date: string): string {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (Number.isNaN(diff)) return "";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function prettyTemplate(id: string): string {
  return id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Premium picker that lets the user choose one of their existing resumes to
 * extract profile fields from. The extracted data populates the profile form
 * for review — nothing is saved until the user clicks "Save Profile".
 */
export function ExtractFromResumeDialog({
  open,
  onOpenChange,
  resumes,
  isExtracting,
  onConfirm,
}: ExtractFromResumeDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Preselect the most-recently-updated resume each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedId(resumes.length > 0 ? resumes[0].id : null);
    }
  }, [open, resumes]);

  const canConfirm = !isExtracting && selectedId != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border border-border/80 shadow-2xl shadow-black/10 rounded-2xl text-foreground p-0 gap-0 overflow-hidden [&>button]:text-muted-foreground [&>button]:hover:text-foreground">
        {/* Ambient glow */}
        <div className="absolute -top-12 -left-10 w-44 h-44 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-12 -right-10 w-40 h-40 rounded-full bg-purple-500/10 blur-[70px] pointer-events-none" />

        <div className="relative z-10 p-6 pb-2">
          <DialogHeader className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-base font-bold tracking-tight text-center pt-1">
              Extract from a resume
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs text-center leading-relaxed max-w-[330px] mx-auto">
              Pick a resume and we'll auto-fill your profile from it. Your form
              fields will be replaced — review the result, then click{" "}
              <span className="font-semibold text-foreground">Save Profile</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="relative z-10 px-6 py-4">
          <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
            {resumes.map((resume) => {
              const isActive = selectedId === resume.id;
              return (
                <button
                  key={resume.id}
                  type="button"
                  onClick={() => setSelectedId(resume.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/60"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`shrink-0 p-2 rounded-lg ${
                      isActive
                        ? "bg-indigo-500/15 text-indigo-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{resume.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {prettyTemplate(resume.templateId)} · Updated{" "}
                      {timeAgo(resume.updatedAt)}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                      isActive
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-border"
                    }`}
                  >
                    {isActive && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              This overwrites the current values in your profile form. Nothing is
              saved until you press Save Profile, so you can still cancel.
            </p>
          </div>
        </div>

        <DialogFooter className="relative z-10 flex-col sm:flex-col gap-2 border-t border-border/60 p-6 pt-4">
          <Button
            onClick={() => selectedId != null && onConfirm(selectedId)}
            disabled={!canConfirm}
            className="w-full h-9 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/15 border-none rounded-xl"
          >
            {isExtracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isExtracting ? "Extracting..." : "Extract & populate"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExtracting}
            className="w-full h-9 text-xs border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
