import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Sparkles, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useImproveBullet } from "@workspace/api-client-react";
import { createAiQuickRequestOptions } from "@/lib/ai-request";
import { richHtmlToPlainText, plainTextToRichHtml } from "@/lib/ai-rich-text";

interface AutoResizingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
}

const AutoResizingTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizingTextareaProps>(
  ({ value, onValueChange, className, placeholder, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      const target = internalRef.current;
      if (!target) return;

      if (typeof ref === "function") {
        ref(target);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = target;
      }

      const adjustHeight = () => {
        target.style.height = "auto";
        target.style.height = `${target.scrollHeight}px`;
      };

      adjustHeight();
      window.addEventListener("resize", adjustHeight);
      
      return () => {
        window.removeEventListener("resize", adjustHeight);
        if (typeof ref === "function") {
          ref(null);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = null;
        }
      };
    }, [value, ref]);

    return (
      <textarea
        ref={internalRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        style={{ resize: "none", overflow: "hidden", ...props.style }}
        {...props}
      />
    );
  }
);
AutoResizingTextarea.displayName = "AutoResizingTextarea";

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

  // Hook for AI bullet polishing
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
        updated[pendingIndex] = richHtmlToPlainText(data.text);
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
    const text = newBulletText.trim();
    if (!text) return;
    onChange([...bullets, text]);
    setNewBulletText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddBullet();
    }
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
    const text = bullets[index]?.trim();
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
        context: context,
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-slate-400 font-semibold">{label}</Label>
        <span className="text-[10px] text-slate-500">{bullets.length} bullet points</span>
      </div>

      {/* Existing Bullets List */}
      {bullets.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {bullets.map((bullet, idx) => {
            const isPending = pendingIndex === idx;
            return (
              <div
                key={idx}
                className="flex flex-col group bg-slate-950/35 border border-slate-800/80 rounded-xl p-2.5 transition-all hover:border-slate-700/80 focus-within:border-indigo-500/40 focus-within:bg-slate-950/50"
              >
                <div className="w-full">
                  <AutoResizingTextarea
                    value={bullet}
                    onValueChange={(val) => handleUpdateBullet(idx, val)}
                    placeholder="Describe your achievement..."
                    rows={1}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 focus-visible:ring-0 shadow-none px-2 py-1 text-sm text-slate-200 placeholder:text-slate-600 resize-none min-h-[28px] h-auto"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/30 pt-1.5 mt-1 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:md:opacity-100 transition-all duration-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-30 rounded-lg"
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
                      className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-30 rounded-lg"
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
                      className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 disabled:opacity-50 rounded-lg"
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
                    className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg"
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

      {/* Add New Bullet Controls */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <AutoResizingTextarea
          value={newBulletText}
          onValueChange={setNewBulletText}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-grow w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 min-h-[38px] h-auto"
        />
        <Button
          type="button"
          onClick={handleAddBullet}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1.5 h-[38px] rounded-xl w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
