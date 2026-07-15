import { useState } from "react";
import { Plus, Trash2, Sparkles, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useToast } from "@/hooks/use-toast";
import { useImproveBullet } from "@workspace/api-client-react";
import { createAiQuickRequestOptions } from "@/lib/ai-request";
import { richHtmlToPlainText, plainTextToRichHtml } from "@/lib/ai-rich-text";

interface BulletListEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  context?: string;
  placeholder?: string;
  label?: string;
}

export function BulletListEditor({
  bullets = [],
  onChange,
  context = "",
  placeholder = "e.g. Led design of core API microservices, improving throughput by 40%",
  label = "Key Achievements / Responsibilities",
}: BulletListEditorProps) {
  const { toast } = useToast();
  const [newBulletText, setNewBulletText] = useState("");
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const improveBullet = useImproveBullet({
    request: createAiQuickRequestOptions(),
    mutation: {
      onSuccess: (data) => {
        if (pendingIndex === null) return;
        if (!data?.text) {
          setPendingIndex(null);
          toast({
            title: "AI returned empty text",
            description: "Please try again with more details.",
            variant: "destructive",
          });
          return;
        }
        const updated = [...bullets];
        updated[pendingIndex] = plainTextToRichHtml(data.text);
        onChange(updated);
        setPendingIndex(null);
        toast({
          title: "Bullet polished with AI!",
        });
      },
      onError: (err: any) => {
        setPendingIndex(null);
        toast({
          title: "AI improvement failed",
          description: err?.message || "Please check your network connection.",
          variant: "destructive",
        });
      },
    },
  });

  const handleAddBullet = () => {
    if (!richHtmlToPlainText(newBulletText)) return;
    onChange([...bullets, newBulletText]);
    setNewBulletText("");
  };

  const handleUpdateBullet = (index: number, text: string) => {
    const updated = [...bullets];
    updated[index] = text;
    onChange(updated);
  };

  const handleDeleteBullet = (index: number) => {
    const updated = bullets.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...bullets];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === bullets.length - 1) return;
    const updated = [...bullets];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onChange(updated);
  };

  const handleAIImproveBullet = (index: number) => {
    const text = richHtmlToPlainText(bullets[index] ?? "");
    if (!text) {
      toast({
        title: "Bullet is empty",
        description: "Write some details first before improving.",
        variant: "destructive",
      });
      return;
    }
    setPendingIndex(index);
    improveBullet.mutate({
      data: {
        bullet: text,
        context,
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3">
        <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
        <span className="text-[10px] text-muted-foreground/80 shrink-0">{bullets.length} bullet points</span>
      </div>

      {bullets.length > 0 && (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
          {bullets.map((bullet, idx) => {
            const isPending = pendingIndex === idx;
            return (
              <div
                key={idx}
                className="flex flex-col group bg-muted/15 border border-border/80 rounded-xl p-2.5 transition-all hover:border-border/80 focus-within:border-indigo-500/40 focus-within:bg-background/50"
              >
                <RichTextEditor
                  value={bullet}
                  onChange={(val) => handleUpdateBullet(idx, val)}
                  placeholder="Describe your achievement..."
                  className="rich-text-compact"
                />

                <div className="flex items-center justify-between border-t border-border/30 pt-1.5 mt-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:md:opacity-100 transition-all duration-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 rounded-lg"
                      title="Move Up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === bullets.length - 1}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 rounded-lg"
                      title="Move Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAIImproveBullet(idx)}
                      disabled={isPending || improveBullet.isPending}
                      className="h-7 w-7 text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-350 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-50 rounded-lg"
                      title="Polish bullet with AI"
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBullet(idx)}
                    className="h-7 w-7 text-muted-foreground/80 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                    title="Delete Bullet"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <RichTextEditor
          value={newBulletText}
          onChange={setNewBulletText}
          placeholder={placeholder}
          className="rich-text-compact"
        />
        <Button
          type="button"
          onClick={handleAddBullet}
          disabled={!richHtmlToPlainText(newBulletText)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1.5 h-[38px] rounded-xl w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
