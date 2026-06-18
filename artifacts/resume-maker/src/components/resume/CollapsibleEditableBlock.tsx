import { useId, type ReactNode } from "react";
import { ChevronDown, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleEditableBlockProps {
  /** Whether the full edit form is shown. When false, only the preview shows. */
  expanded: boolean;
  onToggle: () => void;
  /** Commit + collapse. Light validation lives in the parent if needed. */
  onSave: () => void;
  onDelete: () => void;
  /** Compact summary rendered in the header (and as the collapsed body). */
  preview: ReactNode;
  /** The full editing form — only mounted while expanded. */
  children: ReactNode;
  saveLabel?: string;
  className?: string;
}

/**
 * Presentational chrome for a repeating editable block. Renders a persistent
 * header (chevron toggle + preview + delete) and, while expanded, the edit form
 * with a "Save" footer that collapses the block. The collapse uses a
 * dependency-free CSS grid-rows transition for a smooth animation.
 *
 * It owns no data and no expansion state — both are passed in by the parent
 * (see useCollapsibleList) so persistence and change-detection stay untouched.
 */
export function CollapsibleEditableBlock({
  expanded,
  onToggle,
  onSave,
  onDelete,
  preview,
  children,
  saveLabel = "Save",
  className,
}: CollapsibleEditableBlockProps) {
  const bodyId = useId();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/40 transition-colors",
        expanded ? "border-indigo-500/40" : "border-border hover:border-border/80",
        className,
      )}
    >
      {/* Header — always visible. Click anywhere (except delete) toggles. */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
          <div className="min-w-0 flex-1">{preview}</div>
        </button>

        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          aria-label="Delete"
          className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-destructive border border-transparent hover:border-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body — animated open/close via grid-rows 0fr <-> 1fr. */}
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {expanded && (
            <div className="px-3 pb-3 space-y-2.5">
              <div className="border-t border-border/60 pt-3 space-y-2.5">
                {children}
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 shadow-sm shadow-indigo-600/20 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saveLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shared compact preview line for collapsed blocks. `title` is emphasised,
 * `subtitle` and `meta` are muted. Falls back to a placeholder when empty.
 */
export function BlockPreview({
  title,
  subtitle,
  meta,
  placeholder = "Untitled",
}: {
  title?: string;
  subtitle?: string;
  meta?: string;
  placeholder?: string;
}) {
  const hasTitle = !!title?.trim();
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={cn(
            "text-sm font-semibold truncate",
            hasTitle ? "text-foreground" : "text-muted-foreground italic",
          )}
        >
          {hasTitle ? title : placeholder}
        </span>
        {subtitle?.trim() && (
          <span className="text-xs text-muted-foreground truncate">
            · {subtitle}
          </span>
        )}
      </div>
      {meta?.trim() && (
        <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
          {meta}
        </p>
      )}
    </div>
  );
}
