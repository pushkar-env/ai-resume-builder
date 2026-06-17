import { FileText, Sparkles, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ResumePrefillType = "starter" | "personal" | "empty";

const PREFILL_OPTIONS: {
  value: ResumePrefillType;
  icon: typeof User;
  title: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: "personal",
    icon: User,
    title: "Personalized Profile",
    description:
      "Prefills layouts with your saved contact info, location, and social links + standard placeholder tasks.",
    recommended: true,
  },
  {
    value: "starter",
    icon: Sparkles,
    title: "Standard Sample (Alex Morgan)",
    description:
      "Prefills using the default dummy profile. Great for seeing the template design immediately.",
  },
  {
    value: "empty",
    icon: FileText,
    title: "Blank Slate",
    description:
      "Creates the resume with empty sections. Perfect if you want to paste or type everything from scratch.",
  },
];

interface CreateResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  prefillType: ResumePrefillType;
  onPrefillTypeChange: (value: ResumePrefillType) => void;
  /** Invoked when the user confirms creation. Should no-op if the title is empty. */
  onConfirm: () => void;
  isCreating: boolean;
  description?: string;
}

/**
 * Shared "Create new resume" dialog used by both the dashboard and the templates
 * gallery so the two creation flows stay visually and behaviourally identical.
 * The primary "Create resume" action is stacked above "Cancel" on every breakpoint.
 */
export function CreateResumeDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  prefillType,
  onPrefillTypeChange,
  onConfirm,
  isCreating,
  description = "Choose a title and select your preferred prefill type for this template.",
}: CreateResumeDialogProps) {
  const canCreate = !isCreating && title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background border border-border shadow-xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            Create new resume
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="create-resume-title" className="text-xs font-semibold">
              Resume title
            </Label>
            <Input
              id="create-resume-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. Software Engineer Resume"
              className="h-9 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Prefill options</Label>
            <div className="grid grid-cols-1 gap-2.5">
              {PREFILL_OPTIONS.map((option) => {
                const isActive = prefillType === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onPrefillTypeChange(option.value)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all relative ${
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 p-1.5 rounded-md ${
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        {option.title}
                        {option.recommended && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 border-none h-max shrink-0"
                          >
                            Recommended
                          </Badge>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 border-t border-border/60 pt-4 mt-2">
          <Button
            onClick={onConfirm}
            disabled={!canCreate}
            className="w-full h-9 text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/95 hover:to-purple-600/95"
          >
            {isCreating ? "Creating..." : "Create resume"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full h-9 text-xs"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
