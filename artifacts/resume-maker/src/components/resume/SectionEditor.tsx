import { useState, useRef, startTransition, useMemo } from "react";
import { SortableBlockList } from "@/components/shared/SortableBlockList";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Upload,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGenerateSummary,
  useImproveBullet,
  useSuggestSkills,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { PaywallDialog } from "@/components/shared/PaywallDialog";
import {
  aiErrorDescription,
  createAiQuickRequestOptions,
  createAiStandardRequestOptions,
  isAiTimeoutError,
} from "@/lib/ai-request";
import { plainTextToRichHtml, richHtmlToPlainText } from "@/lib/ai-rich-text";
import { getDefaultSkillStyle } from "@/lib/template-config";
import {
  CollapsibleEditableBlock,
  BlockPreview,
} from "@/components/resume/CollapsibleEditableBlock";
import { useCollapsibleList } from "@/hooks/use-collapsible-list";
import { BulletListEditor } from "@/components/ui/BulletListEditor";
import { syncBulletsToDescription } from "@/lib/profile-bullets";

function aiErrorToast(
  toast: ReturnType<typeof useToast>["toast"],
  err: unknown,
  fallback: string,
) {
  if (isAiTimeoutError(err)) {
    toast({
      title: "AI took too long",
      description: aiErrorDescription(err, "Please try again in a moment."),
      variant: "destructive",
    });
    return;
  }
  const msg =
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : fallback;
  toast({
    title: fallback,
    description: msg !== fallback ? msg : undefined,
    variant: "destructive",
  });
}

type SectionContent = Record<string, unknown>;

/** Generic default heading per section type — shown as placeholder so users know what renders by default. */
const DEFAULT_HEADINGS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

/**
 * Editable section heading. Stored in `content.heading`; an empty value falls back to the
 * template's own default label. Available for every non-personal section.
 */
function SectionHeadingField({
  type,
  content,
  onChange,
}: {
  type: string;
  content: SectionContent;
  onChange: (c: SectionContent) => void;
}) {
  const value = (content.heading as string) ?? "";
  return (
    <Field label="Section heading">
      <Input
        value={value}
        onChange={(e) => onChange({ ...content, heading: e.target.value })}
        placeholder={DEFAULT_HEADINGS[type] ?? "Section heading"}
        className="h-10 lg:h-8 text-sm"
        aria-label="Section heading"
      />
      <p className="text-[10px] text-muted-foreground">
        Shown as this section's title on your resume. Leave blank to use the
        template default.
      </p>
    </Field>
  );
}

interface SectionEditorProps {
  section: {
    id: number;
    type: string;
    title: string;
    content: SectionContent;
    isVisible?: boolean;
  };
  onChange: (content: SectionContent) => void;
  onVisibilityToggle: () => void;
  resumeId: number;
  /** All sections in the resume — used so editors can read context (e.g. job title from personal). */
  allSections?: Array<{ type: string; content: SectionContent }>;
  templateId?: string;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ─── Helpers to read context from other sections ─── */
function findPersonal(allSections?: SectionEditorProps["allSections"]) {
  return allSections?.find((s) => s.type === "personal")?.content ?? {};
}
function findSummary(allSections?: SectionEditorProps["allSections"]) {
  return (
    (allSections?.find((s) => s.type === "summary")?.content?.text as string) ??
    ""
  );
}
function jobTitleFrom(personal: SectionContent): string {
  return (
    (personal.jobTitle as string) ||
    (personal.title as string) ||
    ""
  ).trim();
}

/* ─── Bullet helpers — bullets may be legacy strings or {text,label,link} objects ─── */
type BulletObj = { text: string; label: string; link: string };
function toBulletObj(b: unknown): BulletObj {
  if (typeof b === "string") return { text: b, label: "", link: "" };
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    return {
      text: (o.text as string) ?? "",
      label: ((o.label as string) ?? "").toString(),
      link: ((o.link as string) ?? (o.url as string) ?? "").toString(),
    };
  }
  return { text: "", label: "", link: "" };
}

/* ─── Project bullet helpers — projects support multiple bullets (like experience) ─── */
/**
 * Resolve the editable bullet list for a project. Prefers the structured `bullets` array;
 * migrates a legacy single `description` (which may be an HTML `<ul>` list from older data or
 * the profile import, or a plain paragraph) into discrete bullets so nothing is lost.
 */
function deriveProjectBullets(item: Record<string, unknown>): string[] {
  const b = item.bullets;
  if (Array.isArray(b)) {
    // Already structured: return verbatim. Do NOT trim or filter here — this value is fed
    // straight back into the controlled textareas every render, so trimming would strip a
    // trailing space the moment it's typed and filtering would delete a momentarily-empty
    // bullet mid-edit. (This mirrors how the Experience editor passes item.bullets raw.)
    return b.map((x) =>
      typeof x === "string" ? x : String((x as { text?: unknown })?.text ?? x ?? ""),
    );
  }
  const desc = (item.description as string) ?? "";
  if (!desc.trim()) return [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(desc, "text/html");
    const lis = Array.from(doc.querySelectorAll("li"))
      .map((li) => (li.textContent ?? "").trim())
      .filter(Boolean);
    if (lis.length > 0) return lis;
    const text = (doc.body.textContent ?? "").trim();
    return text ? [text] : [];
  }
  return desc.trim() ? [desc.trim()] : [];
}

/* ─── Social link helpers — supports legacy github/linkedin/twitter or new socials[] array ─── */
type SocialItem = { label: string; url: string };
function readSocials(content: SectionContent): SocialItem[] {
  const arr = content.socials as unknown;
  if (Array.isArray(arr)) {
    return arr.map((s) => ({
      label: ((s as { label?: unknown })?.label as string) ?? "",
      url: ((s as { url?: unknown })?.url as string) ?? "",
    }));
  }
  const out: SocialItem[] = [];
  if ((content.github as string)?.trim())
    out.push({ label: "GitHub", url: content.github as string });
  if ((content.linkedin as string)?.trim())
    out.push({ label: "LinkedIn", url: content.linkedin as string });
  if ((content.twitter as string)?.trim())
    out.push({ label: "Twitter", url: content.twitter as string });
  return out;
}

function PersonalEditor({
  content,
  onChange,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
}) {
  const update = (key: string, val: string) =>
    onChange({ ...content, [key]: val });
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = (content.photo as string) ?? "";

  const handleFile = (file: File) => {
    if (file.size > 1_500_000) {
      alert("Image is too large — please pick one under 1.5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("photo", reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* Photo uploader */}
      <Field label="Profile Photo (optional)">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-muted flex items-center justify-center text-base font-bold text-muted-foreground border border-border shrink-0">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              ((content.name as string) ?? "")
                .trim()
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "?"
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              {photo ? "Replace photo" : "Upload photo"}
            </Button>
            {photo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-destructive justify-start"
                onClick={() => update("photo", "")}
              >
                <X className="h-3 w-3" /> Remove
              </Button>
            )}
          </div>
        </div>
      </Field>

      <Field label="Full Name">
        <Input
          value={(content.name as string) ?? ""}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Jane Smith"
        />
      </Field>
      <Field label="Job Title / Role">
        <Input
          value={
            (content.jobTitle as string) ?? (content.title as string) ?? ""
          }
          onChange={(e) => update("jobTitle", e.target.value)}
          placeholder="Senior Software Engineer"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2 items-end">
        <Field label="Email">
          <Input
            value={(content.email as string) ?? ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="jane@example.com"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={(content.phone as string) ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </Field>
      </div>
      <Field label="Location">
        <Input
          value={(content.location as string) ?? ""}
          onChange={(e) => update("location", e.target.value)}
          placeholder="San Francisco, CA"
        />
      </Field>

      <SocialsEditor content={content} onChange={onChange} />
    </div>
  );
}

function SocialsEditor({
  content,
  onChange,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
}) {
  const socials = readSocials(content);
  const writeSocials = (next: SocialItem[]) => {
    // Move to canonical socials[] and drop legacy fixed fields so they don't double-render
    const {
      github: _g,
      linkedin: _l,
      twitter: _t,
      ...rest
    } = content as Record<string, unknown>;
    onChange({ ...rest, socials: next });
  };
  const updateAt = (i: number, patch: Partial<SocialItem>) => {
    const next = socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    writeSocials(next);
  };
  return (
    <div className="pt-1 border-t border-border">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">
        Social Links
      </p>
      <p className="text-[10.5px] text-muted-foreground mb-2">
        Add a label (e.g. <span className="font-medium">GitHub</span>,{" "}
        <span className="font-medium">Portfolio</span>) and a link. Only the
        label is shown on your resume — it becomes a clickable highlighted link.
      </p>
      <div className="space-y-1.5">
        {socials.map((s, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Input
              size={1}
              value={s.label}
              placeholder="Label"
              className="h-8 text-sm w-28 shrink-0"
              onChange={(e) => updateAt(i, { label: e.target.value })}
            />
            <Input
              size={1}
              value={s.url}
              placeholder="https://..."
              className="h-8 text-sm flex-1"
              onChange={(e) => updateAt(i, { url: e.target.value })}
            />
            <button
              type="button"
              onClick={() =>
                writeSocials(socials.filter((_, idx) => idx !== i))
              }
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive shrink-0"
              title="Remove"
              aria-label="Remove social link"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={() => writeSocials([...socials, { label: "", url: "" }])}
        >
          <Plus className="h-3 w-3" /> Add social link
        </Button>
      </div>
    </div>
  );
}

function SummaryEditor({
  content,
  onChange,
  allSections,
  isPremium,
  onShowPaywall,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
  allSections?: SectionEditorProps["allSections"];
  isPremium: boolean;
  onShowPaywall: () => void;
}) {
  const { toast } = useToast();
  const generateSummary = useGenerateSummary({
    request: createAiQuickRequestOptions(),
    mutation: {
      onSuccess: (data) => {
        if (data?.text && data.text.trim().length > 0) {
          const html = plainTextToRichHtml(data.text);
          startTransition(() => {
            onChange({ ...contentRef.current, text: html });
          });
          toast({ title: "Summary updated by AI" });
        } else {
          toast({
            title: "AI returned no content — try again",
            variant: "destructive",
          });
        }
      },
      onError: (err) => aiErrorToast(toast, err, "Failed to generate summary"),
    },
  });

  const contentRef = useRef(content);
  contentRef.current = content;

  const personal = findPersonal(allSections);
  const jobTitle = jobTitleFrom(personal);
  const currentText = ((content.text as string) ?? "").trim();
  const willRefine = currentText.length > 0;

  const handleGenerate = () => {
    if (!jobTitle && !willRefine) {
      toast({
        title: "Add a job title first",
        description:
          "Set your job title in the Personal section, or type a draft below — the AI uses these as a starting point.",
        variant: "destructive",
      });
      return;
    }
    generateSummary.mutate({
      data: {
        jobTitle: jobTitle || "professional",
        currentText: willRefine ? richHtmlToPlainText(currentText) : undefined,
      },
    });
  };

  return (
    <div className="space-y-3">
      <Field label="Professional Summary">
        <RichTextEditor
          value={(content.text as string) ?? ""}
          onChange={(val) => onChange({ ...content, text: val })}
          placeholder="Write a draft, or just leave blank and click 'Generate with AI' below…"
        />
      </Field>
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs self-start"
          onClick={handleGenerate}
          disabled={generateSummary.isPending}
        >
          {generateSummary.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 text-primary" />
          )}
          {willRefine ? "Polish with AI" : "Generate with AI"}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          {willRefine
            ? "AI will refine your existing draft, keeping your voice and details."
            : `AI will write a fresh summary${jobTitle ? ` for a ${jobTitle}` : ""}. Add details first to personalise it.`}
        </p>
      </div>
    </div>
  );
}

function ExperienceEditor({
  content,
  onChange,
  isPremium,
  onShowPaywall,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
  isPremium: boolean;
  onShowPaywall: () => void;
}) {
  const { toast } = useToast();
  const collapse = useCollapsibleList();
  const rawItems = (content.items as Array<Record<string, unknown>>) ?? [];

  const items = useMemo<any[]>(() => {
    return rawItems.map((item, idx) => ({
      ...item,
      id: (item.id as string | number) ?? `exp-${idx}-${item.company || ""}-${item.title || ""}`,
    }));
  }, [rawItems]);

  const updateItem = (i: number, key: string, val: unknown) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    collapse.handleAdd(newId);
    onChange({
      ...content,
      items: [
        ...rawItems,
        {
          id: newId,
          company: "",
          title: "",
          startDate: "",
          endDate: "",
          location: "",
          bullets: [""],
        },
      ],
    });
  };

  const removeItem = (id: string | number) => {
    onChange({ ...content, items: rawItems.filter((item) => (item.id || "") !== id) });
    collapse.handleRemove(id);
  };

  const [pendingBullet, setPendingBullet] = useState<{
    itemIndex: number;
    bulletIndex: number;
  } | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const improveBullet = useImproveBullet({
    request: createAiQuickRequestOptions(),
    mutation: {
      onSuccess: (data) => {
        if (!pendingBullet || !data?.text?.trim()) {
          setPendingBullet(null);
          if (!data?.text?.trim()) {
            toast({
              title: "AI returned no content — try again",
              variant: "destructive",
            });
          }
          return;
        }
        const { itemIndex, bulletIndex } = pendingBullet;
        const latestItems =
          (contentRef.current.items as Array<Record<string, unknown>>) ?? [];
        const updatedItems = [...latestItems];
        const bullets = (
          (updatedItems[itemIndex]?.bullets as unknown[]) ?? []
        ).map((x, idx) =>
          idx === bulletIndex
            ? { ...toBulletObj(x), text: plainTextToRichHtml(data.text) }
            : x,
        );
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], bullets };
        startTransition(() => {
          onChange({ ...contentRef.current, items: updatedItems });
        });
        setPendingBullet(null);
        toast({ title: "Bullet improved" });
      },
      onError: (err) => {
        setPendingBullet(null);
        aiErrorToast(toast, err, "Failed to improve bullet");
      },
    },
  });

  return (
    <div className="space-y-4">
      <SortableBlockList
        items={items}
        onReorder={(newItems) => onChange({ ...content, items: newItems })}
        renderItem={(item, i, { ref, style, dragHandleProps, onMoveUp, onMoveDown }) => {
          const rawBullets = (item.bullets as unknown[]) ?? [];
          const updateBulletAt = (bi: number, patch: Partial<BulletObj>) => {
            const next = rawBullets.map((x, idx) =>
              idx === bi ? { ...toBulletObj(x), ...patch } : x,
            );
            updateItem(i, "bullets", next);
          };
          const removeBullet = (bi: number) =>
            updateItem(
              i,
              "bullets",
              rawBullets.filter((_, idx) => idx !== bi),
            );
          return (
            <CollapsibleEditableBlock
              key={item.id}
              setNodeRef={ref}
              style={style}
              dragHandleProps={dragHandleProps}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              expanded={collapse.isExpanded(item.id)}
              onToggle={() => collapse.toggle(item.id)}
              onSave={() => collapse.collapse(item.id)}
              onDelete={() => removeItem(item.id)}
              preview={
                <BlockPreview
                  title={(item.title as string) || ""}
                  subtitle={(item.company as string) || ""}
                  meta={[item.startDate, item.endDate].filter(Boolean).join(" – ")}
                  placeholder={`Experience #${i + 1}`}
                />
              }
            >
              <div className="grid grid-cols-2 gap-2 items-end">
                <Field label="Job Title">
                  <Input
                    size={1}
                    value={(item.title as string) ?? ""}
                    onChange={(e) => updateItem(i, "title", e.target.value)}
                    placeholder="Software Engineer"
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
                <Field label="Company">
                  <Input
                    size={1}
                    value={(item.company as string) ?? ""}
                    onChange={(e) => updateItem(i, "company", e.target.value)}
                    placeholder="Acme Corp"
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Start">
                  <Input
                    size={1}
                    value={(item.startDate as string) ?? ""}
                    onChange={(e) => updateItem(i, "startDate", e.target.value)}
                    placeholder="Jan 2020"
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
                <Field label="End">
                  <Input
                    size={1}
                    value={(item.endDate as string) ?? ""}
                    onChange={(e) => updateItem(i, "endDate", e.target.value)}
                    placeholder="Present"
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
                <Field label="Location">
                  <Input
                    size={1}
                    value={(item.location as string) ?? ""}
                    onChange={(e) => updateItem(i, "location", e.target.value)}
                    placeholder="SF, CA"
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
              </div>

              {/* Bullets — text + optional work-sample label & link */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Bullet Points
                </Label>
                {rawBullets.map((raw, bi) => {
                  const b = toBulletObj(raw);
                  const isImproving =
                    improveBullet.isPending &&
                    pendingBullet?.itemIndex === i &&
                    pendingBullet?.bulletIndex === bi;
                  return (
                    <div
                      key={bi}
                      className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-2"
                    >
                      <RichTextEditor
                        value={b.text}
                        onChange={(val) => updateBulletAt(bi, { text: val })}
                        placeholder="• Led ..."
                        actionCount={2}
                        rightElement={
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 min-h-0 p-0 text-primary hover:text-primary hover:bg-primary/10"
                              title="Improve with AI"
                              onClick={() => {
                                setPendingBullet({ itemIndex: i, bulletIndex: bi });
                                improveBullet.mutate({
                                  data: {
                                    bullet: richHtmlToPlainText(b.text),
                                    context: `${item.title ?? ""} at ${item.company ?? ""}`,
                                  },
                                });
                              }}
                              disabled={isImproving}
                            >
                              {isImproving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 min-h-0 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete bullet"
                              onClick={() => removeBullet(bi)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        }
                      />
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() =>
                    updateItem(i, "bullets", [
                      ...rawBullets,
                      { text: "", label: "", link: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" />
                  Add bullet
                </Button>
              </div>
            </CollapsibleEditableBlock>
          );
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="gap-1.5 h-10 lg:h-8 text-xs font-medium w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        Add experience
      </Button>
    </div>
  );
}

function EducationEditor({
  content,
  onChange,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
}) {
  const collapse = useCollapsibleList();
  const rawItems = (content.items as Array<Record<string, unknown>>) ?? [];

  const items = useMemo<any[]>(() => {
    return rawItems.map((item, idx) => ({
      ...item,
      id: (item.id as string | number) ?? `edu-${idx}-${item.school || ""}-${item.degree || ""}`,
    }));
  }, [rawItems]);

  const updateItem = (i: number, key: string, val: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    collapse.handleAdd(newId);
    onChange({
      ...content,
      items: [
        ...rawItems,
        {
          id: newId,
          school: "",
          degree: "",
          field: "",
          startDate: "",
          endDate: "",
          gpa: "",
          gpaMode: "gpa",
        },
      ],
    });
  };

  const removeItem = (id: string | number) => {
    onChange({ ...content, items: rawItems.filter((item) => (item.id || "") !== id) });
    collapse.handleRemove(id);
  };

  return (
    <div className="space-y-3">
      <SortableBlockList
        items={items}
        onReorder={(newItems) => onChange({ ...content, items: newItems })}
        renderItem={(item, i, { ref, style, dragHandleProps, onMoveUp, onMoveDown }) => (
          <CollapsibleEditableBlock
            key={item.id}
            setNodeRef={ref}
            style={style}
            dragHandleProps={dragHandleProps}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            expanded={collapse.isExpanded(item.id)}
            onToggle={() => collapse.toggle(item.id)}
            onSave={() => collapse.collapse(item.id)}
            onDelete={() => removeItem(item.id)}
            preview={
              <BlockPreview
                title={[item.degree, item.field].filter(Boolean).join(" ")}
                subtitle={(item.school as string) || ""}
                meta={[item.startDate, item.endDate].filter(Boolean).join(" – ")}
                placeholder={`Education #${i + 1}`}
              />
            }
          >
            <div>
              <Field label="School / University">
                <Input
                  size={1}
                  value={(item.school as string) ?? ""}
                  onChange={(e) => updateItem(i, "school", e.target.value)}
                  placeholder="MIT"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Field label="Degree">
                <Input
                  size={1}
                  value={(item.degree as string) ?? ""}
                  onChange={(e) => updateItem(i, "degree", e.target.value)}
                  placeholder="B.S. Computer Science"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
              <Field label="Field">
                <Input
                  size={1}
                  value={(item.field as string) ?? ""}
                  onChange={(e) => updateItem(i, "field", e.target.value)}
                  placeholder="AI/ML"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <Input
                  size={1}
                  value={(item.startDate as string) ?? ""}
                  onChange={(e) => updateItem(i, "startDate", e.target.value)}
                  placeholder="2018"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
              <Field label="End">
                <Input
                  size={1}
                  value={(item.endDate as string) ?? ""}
                  onChange={(e) => updateItem(i, "endDate", e.target.value)}
                  placeholder="2022"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Grade System">
                <Select
                  value={(item.gpaMode as string) ?? "gpa"}
                  onValueChange={(val) => updateItem(i, "gpaMode", val)}
                >
                  <SelectTrigger className="h-10 lg:h-8 text-sm">
                    <SelectValue placeholder="GPA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpa">GPA</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={(item.gpaMode as string) === "percentage" ? "%" : "GPA"}
              >
                <Input
                  size={1}
                  value={(item.gpa as string) ?? ""}
                  onChange={(e) => updateItem(i, "gpa", e.target.value)}
                  placeholder={
                    (item.gpaMode as string) === "percentage" ? "98.5" : "3.9"
                  }
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
            </div>
          </CollapsibleEditableBlock>
        )}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="gap-1.5 h-10 lg:h-8 text-xs font-medium w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        Add education
      </Button>
    </div>
  );
}

const SKILL_STYLES: Array<{ value: string; label: string; hint: string }> = [
  {
    value: "bars",
    label: "Progress bars",
    hint: "Skill name with a percentage bar",
  },
  { value: "chips", label: "Chips / pills", hint: "Compact coloured tags" },
  { value: "radial", label: "Radial dials", hint: "Circular progress dials" },
  {
    value: "bullets",
    label: "Bullet points",
    hint: "Bulleted list with accent color",
  },
  {
    value: "grouped",
    label: "Categorized groups",
    hint: "Bold group labels with related skills",
  },
  {
    value: "text",
    label: "Plain text list",
    hint: "Comma-separated minimal style",
  },
];

function SkillsEditor({
  content,
  onChange,
  allSections,
  isPremium,
  onShowPaywall,
  templateId,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
  allSections?: SectionEditorProps["allSections"];
  isPremium: boolean;
  onShowPaywall: () => void;
  templateId?: string;
}) {
  const [newSkill, setNewSkill] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupSkills, setNewGroupSkills] = useState("");
  const { toast } = useToast();
  const items: Array<Record<string, unknown>> =
    (content.items as Array<Record<string, unknown>>) ?? [];
  const defaultStyle = getDefaultSkillStyle(templateId);
  const style = (content.style as string) ?? defaultStyle;
  const showLevel = style === "bars" || style === "radial";
  const showGroups = style === "grouped";

  const [suggested, setSuggested] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Editor-only UI state: which grouped-skill categories are collapsed. Keyed by the
  // group key (lowercased category). Default is expanded (absent from the set) so the
  // initial view is unchanged and, critically, renaming an expanded group — which changes
  // its key on every keystroke — never toggles it shut. This is purely visual; it does not
  // touch content.items, so PDF/DOCX/JSON exports and the preview are unaffected.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const groupedSkillItems = useMemo(() => {
    const groups: Array<{
      key: string;
      category: string;
      entries: Array<{ item: Record<string, unknown>; index: number }>;
    }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    items.forEach((item, index) => {
      const category = ((item.category as string) ?? "").trim() || "Core";
      const key = category.toLowerCase();
      let group = byKey.get(key);
      if (!group) {
        group = { key, category, entries: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.entries.push({ item, index });
    });
    return groups;
  }, [items]);

  const categoryForSuggestedSkill = (skill: string): string => {
    if (!showGroups) return "";
    const skillText = skill.toLowerCase();
    const keywordGroups: Array<{ label: string; aliases: string[]; skills: string[] }> = [
      {
        label: "Frontend",
        aliases: ["frontend", "front end", "ui", "web", "client"],
        skills: ["react", "vue", "angular", "javascript", "typescript", "html", "css", "tailwind", "next", "redux"],
      },
      {
        label: "Backend",
        aliases: ["backend", "back end", "api", "server"],
        skills: ["node", "express", "django", "flask", "fastapi", "spring", "java", "go", "graphql", "rest", "microservice"],
      },
      {
        label: "Data",
        aliases: ["database", "data", "storage"],
        skills: ["sql", "postgres", "mysql", "mongodb", "redis", "elastic", "snowflake", "warehouse"],
      },
      {
        label: "Cloud & DevOps",
        aliases: ["cloud", "devops", "infrastructure", "platform"],
        skills: ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "ci", "cd", "linux"],
      },
      {
        label: "Testing",
        aliases: ["testing", "qa", "quality"],
        skills: ["jest", "cypress", "playwright", "selenium", "testing", "junit", "pytest"],
      },
      {
        label: "AI / ML",
        aliases: ["ai", "ml", "machine learning"],
        skills: ["machine learning", "tensorflow", "pytorch", "llm", "openai", "nlp", "computer vision"],
      },
      {
        label: "Design",
        aliases: ["design", "product"],
        skills: ["figma", "adobe", "photoshop", "illustrator", "wireframe", "prototype"],
      },
      {
        label: "Leadership",
        aliases: ["leadership", "soft", "management"],
        skills: ["leadership", "communication", "mentoring", "stakeholder", "planning", "strategy"],
      },
    ];

    const match = keywordGroups.find((group) =>
      group.skills.some((term) => skillText.includes(term)),
    );
    const canonicalLabel = match?.label ?? "Core";
    const canonicalAliases = match
      ? [match.label.toLowerCase(), ...match.aliases]
      : ["core"];
    const existingLabel = groupedSkillItems.find((group) => {
      const labelText = group.category.toLowerCase();
      return canonicalAliases.some((alias) => labelText.includes(alias));
    })?.category;
    return existingLabel || canonicalLabel;
  };

  const parseGroupSkills = (value: string): string[] =>
    value
      .split(/[\n,]/)
      .map((skill) => skill.trim())
      .filter(Boolean);

  const addGroup = () => {
    const label = newGroupLabel.trim() || "Core";
    const skills = parseGroupSkills(newGroupSkills);
    const nextItems =
      skills.length > 0
        ? skills.map((skill) => ({ name: skill, level: 70, category: label }))
        : [{ name: "", level: 70, category: label }];
    onChange({ ...content, items: [...items, ...nextItems] });
    setNewGroupLabel("");
    setNewGroupSkills("");
  };

  const renameGroup = (groupKey: string, category: string) => {
    const nextCategory = category.trimStart();
    const next = items.map((item) => {
      const current = (((item.category as string) ?? "").trim() || "Core").toLowerCase();
      return current === groupKey ? { ...item, category: nextCategory } : item;
    });
    onChange({ ...content, items: next });
  };

  const removeGroup = (groupKey: string) => {
    onChange({
      ...content,
      items: items.filter((item) => {
        const current = (((item.category as string) ?? "").trim() || "Core").toLowerCase();
        return current !== groupKey;
      }),
    });
  };

  const addSkillToGroup = (category: string) => {
    onChange({
      ...content,
      items: [...items, { name: "", level: 70, category }],
    });
  };

  const moveSkillBetweenIndexes = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
      return;
    }
    const next = [...items];
    const current = next[from];
    next[from] = next[to];
    next[to] = current;
    onChange({ ...content, items: next });
  };

  const moveGroup = (groupIndex: number, direction: -1 | 1) => {
    const targetIndex = groupIndex + direction;
    if (targetIndex < 0 || targetIndex >= groupedSkillItems.length) return;
    const groups = [...groupedSkillItems];
    const current = groups[groupIndex];
    groups[groupIndex] = groups[targetIndex];
    groups[targetIndex] = current;
    onChange({
      ...content,
      items: groups.flatMap((group) =>
        group.entries.map((entry) => items[entry.index]),
      ),
    });
  };

  const suggestSkills = useSuggestSkills({
    request: createAiStandardRequestOptions(),
    mutation: {
      onSuccess: (data) => {
        const existing = new Set(
          items.map((i) => ((i.name as string) ?? "").toLowerCase()),
        );
        const fresh = (data.skills ?? []).filter(
          (s) => s && !existing.has(s.toLowerCase()),
        );
        if (fresh.length === 0) {
          toast({
            title:
              "No new suggestions — try refining your job title or summary",
          });
          return;
        }
        setSuggested(fresh);
        setPicked(new Set(fresh)); // pre-select all so users can just click "Add"
      },
      onError: (err) => aiErrorToast(toast, err, "Failed to suggest skills"),
    },
  });

  const togglePicked = (s: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };
  const addPicked = () => {
    const newItems = suggested
      .filter((s) => picked.has(s))
      .map((s) => ({
        name: s,
        level: 70,
        category: categoryForSuggestedSkill(s),
      }));
    if (newItems.length > 0) {
      onChange({ ...content, items: [...items, ...newItems] });
      toast({
        title: `Added ${newItems.length} skill${newItems.length === 1 ? "" : "s"}`,
      });
    }
    setSuggested([]);
    setPicked(new Set());
  };
  const dismissSuggestions = () => {
    setSuggested([]);
    setPicked(new Set());
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    onChange({
      ...content,
      items: [
        ...items,
        {
          name: newSkill.trim(),
          level: 70,
          category: showGroups ? "Core" : "",
        },
      ],
    });
    setNewSkill("");
  };

  const updateSkill = (i: number, patch: Record<string, unknown>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange({ ...content, items: next });
  };

  const updateLevel = (i: number, lvl: number) => {
    updateSkill(i, { level: lvl });
  };

  const removeSkill = (i: number) => {
    onChange({
      ...content,
      items: items.filter((_, idx) => idx !== i),
    });
  };

  const moveSkill = (i: number, direction: -1 | 1) => {
    const target = i + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[i];
    next[i] = next[target];
    next[target] = current;
    onChange({ ...content, items: next });
  };

  const personal = findPersonal(allSections);
  const jobTitle = jobTitleFrom(personal);
  const summaryText = findSummary(allSections);

  const handleSuggest = () => {
    if (!jobTitle) {
      toast({
        title: "Add a job title first",
        description:
          "Set your job title in the Personal section so the AI knows what skills to suggest.",
        variant: "destructive",
      });
      return;
    }
    suggestSkills.mutate({
      data: {
        jobTitle,
        existingSkills: items
          .map((i) => (i.name as string) ?? "")
          .filter(Boolean),
        summary: summaryText ? richHtmlToPlainText(summaryText) : undefined,
      },
    });
  };

  return (
    <div className="space-y-3">
      {/* Style selector */}
      <Field label="Display Style">
        <Select
          value={style}
          onValueChange={(v) => onChange({ ...content, style: v })}
        >
          <SelectTrigger className="h-10 lg:h-8 text-sm">
            <SelectValue>
              {SKILL_STYLES.find((s) => s.value === style)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SKILL_STYLES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-sm">
                <div className="flex flex-col items-start">
                  <span>{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.hint}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Skill list — compact when no level UI, expanded with sliders when needed */}
      {showLevel ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 select-none font-medium">
            <span>Skill Level Scale:</span>
            <span>1 = Beginner, 5 = Expert</span>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => {
              const currentVal = Math.min(
                5,
                Math.max(1, Math.ceil(Number(item.level ?? 70) / 20)),
              );
              return (
                <div
                  key={i}
                  className="rounded-md border border-border p-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={(item.name as string) ?? ""}
                      onChange={(e) => updateSkill(i, { name: e.target.value })}
                      placeholder="Skill name"
                      className="h-9 lg:h-7 text-sm"
                    />
                    <span className="text-[10px] tabular-nums w-9 shrink-0 whitespace-nowrap text-right text-muted-foreground select-none">
                      {currentVal} / 5
                    </span>
                    <button
                      type="button"
                      onClick={() => moveSkill(i, -1)}
                      disabled={i === 0}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 shrink-0"
                      title="Move skill up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSkill(i, 1)}
                      disabled={i === items.length - 1}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 shrink-0"
                      title="Move skill down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSkill(i)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete skill"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="pt-1.5 pb-6 px-1 relative">
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[currentVal]}
                      onValueChange={(vals) => {
                        if (vals && vals.length > 0) {
                          updateLevel(i, vals[0] * 20);
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <div className="absolute left-0 right-0 top-[22px] select-none h-6">
                      {[1, 2, 3, 4, 5].map((val, idx) => {
                        const leftOffset = `calc(12px + (100% - 24px) * ${idx / 4})`;
                        const isActive = val === currentVal;
                        return (
                          <div
                            key={val}
                            className="absolute flex flex-col items-center -translate-x-1/2"
                            style={{ left: leftOffset }}
                          >
                            <div
                              className={`w-[1px] h-1 mb-1 transition-colors ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`}
                            />
                            <span
                              className={`text-[10px] font-semibold transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : showGroups ? (
        <div className="space-y-2">
          {groupedSkillItems.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.key);
            const skillCount = group.entries.length;
            const collapsedPreview = group.entries
              .map((entry) => ((entry.item.name as string) ?? "").trim())
              .filter(Boolean)
              .join(", ");
            return (
            <div
              key={group.entries.map((entry) => entry.index).join("-")}
              className="rounded-md border border-border p-2.5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(group.key)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                  title={isCollapsed ? "Expand group" : "Collapse group"}
                  aria-expanded={!isCollapsed}
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  />
                </button>
                <Input
                  value={group.category}
                  onChange={(e) => renameGroup(group.key, e.target.value)}
                  placeholder="Group label"
                  className="h-9 lg:h-8 text-sm font-semibold"
                />
                <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 select-none min-w-[1.25rem] text-center">
                  {skillCount}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveGroup(groupIndex, -1)}
                    disabled={groupIndex === 0}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                    title="Move group up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGroup(groupIndex, 1)}
                    disabled={groupIndex === groupedSkillItems.length - 1}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                    title="Move group down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGroup(group.key)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    title="Delete group"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {isCollapsed ? (
                collapsedPreview ? (
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapsed(group.key)}
                    className="block w-full text-left text-[11px] text-muted-foreground truncate pl-10 pr-1"
                    title={collapsedPreview}
                  >
                    {collapsedPreview}
                  </button>
                ) : null
              ) : (
                <>
              <div className="space-y-1.5">
                {group.entries.map((entry, entryIndex) => (
                  <div key={entry.index} className="flex items-center gap-2">
                    <Input
                      value={(entry.item.name as string) ?? ""}
                      onChange={(e) =>
                        updateSkill(entry.index, { name: e.target.value })
                      }
                      placeholder="Skill name"
                      className="h-9 lg:h-8 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        moveSkillBetweenIndexes(
                          entry.index,
                          group.entries[entryIndex - 1]?.index ?? entry.index,
                        )
                      }
                      disabled={entryIndex === 0}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 shrink-0"
                      title="Move skill up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        moveSkillBetweenIndexes(
                          entry.index,
                          group.entries[entryIndex + 1]?.index ?? entry.index,
                        )
                      }
                      disabled={entryIndex === group.entries.length - 1}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 shrink-0"
                      title="Move skill down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSkill(entry.index)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete skill"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSkillToGroup(group.category)}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add skill to group
              </Button>
                </>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="gap-1 pr-1 pl-1.5 py-1 max-w-full"
            >
              <span className="truncate max-w-[12rem]">{item.name as string}</span>
              <button
                type="button"
                onClick={() => moveSkill(i, -1)}
                disabled={i === 0}
                className="hover:text-foreground transition-colors disabled:opacity-30"
                title="Move skill up"
              >
                <ArrowUp className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                onClick={() => moveSkill(i, 1)}
                disabled={i === items.length - 1}
                className="hover:text-foreground transition-colors disabled:opacity-30"
                title="Move skill down"
              >
                <ArrowDown className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="hover:text-destructive transition-colors ml-0.5"
                title="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {showGroups ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(7rem,0.35fr)_minmax(10rem,1fr)_auto]">
          <Input
            value={newGroupLabel}
            onChange={(e) => setNewGroupLabel(e.target.value)}
            placeholder="Group label"
            className="h-10 lg:h-8 text-sm font-semibold"
          />
          <Input
            value={newGroupSkills}
            onChange={(e) => setNewGroupSkills(e.target.value)}
            placeholder="Skills, separated by commas"
            className="h-10 lg:h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGroup();
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addGroup}
            className="h-10 lg:h-8 text-xs shrink-0 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add group
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add a skill..."
            className="h-10 lg:h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addSkill}
            className="h-10 lg:h-8 text-xs shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-10 lg:h-8 text-xs font-medium"
        onClick={handleSuggest}
        disabled={suggestSkills.isPending}
      >
        {suggestSkills.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3 text-primary" />
        )}
        Suggest skills with AI
      </Button>

      {suggested.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-foreground">
              Pick the skills you want to add
            </p>
            <span className="text-[10px] text-muted-foreground">
              {picked.size}/{suggested.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((s) => {
              const on = picked.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => togglePicked(s)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={addPicked}
              disabled={picked.size === 0}
            >
              Add {picked.size > 0 ? `${picked.size} ` : ""}selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={dismissSuggestions}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsEditor({
  content,
  onChange,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
}) {
  const collapse = useCollapsibleList();
  const rawItems = (content.items as Array<Record<string, unknown>>) ?? [];

  const items = useMemo<any[]>(() => {
    return rawItems.map((item, idx) => ({
      ...item,
      id: (item.id as string | number) ?? `proj-${idx}-${item.name || ""}`,
    }));
  }, [rawItems]);

  const updateItem = (i: number, key: string, val: unknown) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  /** Update several fields of a project at once (used to keep bullets + description in sync). */
  const updateItemFields = (i: number, patch: Record<string, unknown>) => {
    const updated = [...items];
    updated[i] = { ...updated[i], ...patch };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    collapse.handleAdd(newId);
    onChange({
      ...content,
      items: [
        ...rawItems,
        { id: newId, name: "", label: "", url: "", bullets: [] },
      ],
    });
  };

  const removeItem = (id: string | number) => {
    onChange({ ...content, items: rawItems.filter((item) => (item.id || "") !== id) });
    collapse.handleRemove(id);
  };

  return (
    <div className="space-y-3">
      <SortableBlockList
        items={items}
        onReorder={(newItems) => onChange({ ...content, items: newItems })}
        renderItem={(item, i, { ref, style, dragHandleProps, onMoveUp, onMoveDown }) => (
          <CollapsibleEditableBlock
            key={item.id}
            setNodeRef={ref}
            style={style}
            dragHandleProps={dragHandleProps}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            expanded={collapse.isExpanded(item.id)}
            onToggle={() => collapse.toggle(item.id)}
            onSave={() => collapse.collapse(item.id)}
            onDelete={() => removeItem(item.id as string | number)}
            preview={
              <BlockPreview
                title={(item.name as string) || ""}
                meta={(item.url as string) || ""}
                placeholder={`Project #${i + 1}`}
              />
            }
          >
            <div className="space-y-2">
              <Field label="Project Name">
                <Input
                  size={1}
                  value={(item.name as string) ?? ""}
                  onChange={(e) => updateItem(i, "name", e.target.value)}
                  placeholder="My Project"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2 items-end">
                <Field label="Link Label">
                  <Input
                    size={1}
                    value={(item.label as string) ?? ""}
                    onChange={(e) => updateItem(i, "label", e.target.value)}
                    placeholder="e.g. View Live"
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
                <Field label="URL">
                  <Input
                    size={1}
                    value={(item.url as string) ?? ""}
                    onChange={(e) => updateItem(i, "url", e.target.value)}
                    placeholder="github.com/..."
                    className="h-10 lg:h-8 text-sm"
                  />
                </Field>
              </div>
            </div>
            <BulletListEditor
              bullets={deriveProjectBullets(item)}
              onChange={(newBullets) =>
                updateItemFields(i, {
                  bullets: newBullets,
                  // Keep a plain-text description in sync for legacy/ATS consumers.
                  description: syncBulletsToDescription(newBullets),
                })
              }
              context={`Project named ${(item.name as string) || "Project"}`}
              placeholder="e.g. Built a real-time collaboration engine handling 10k concurrent users"
              label="Bullet Points"
            />
          </CollapsibleEditableBlock>
        )}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="gap-1.5 h-10 lg:h-8 text-xs font-medium w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        Add project
      </Button>
    </div>
  );
}

function CertificationsEditor({
  content,
  onChange,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
}) {
  const collapse = useCollapsibleList();
  const rawItems = (content.items as Array<Record<string, unknown>>) ?? [];

  const items = useMemo<any[]>(() => {
    return rawItems.map((item, idx) => ({
      ...item,
      id: (item.id as string | number) ?? `cert-${idx}-${item.name || ""}`,
    }));
  }, [rawItems]);

  const updateItem = (i: number, key: string, val: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    collapse.handleAdd(newId);
    onChange({
      ...content,
      items: [
        ...rawItems,
        { id: newId, name: "", issuer: "", date: "", credentialUrl: "" },
      ],
    });
  };

  const removeItem = (id: string | number) => {
    onChange({ ...content, items: rawItems.filter((item) => (item.id || "") !== id) });
    collapse.handleRemove(id);
  };

  return (
    <div className="space-y-3">
      <SortableBlockList
        items={items}
        onReorder={(newItems) => onChange({ ...content, items: newItems })}
        renderItem={(item, i, { ref, style, dragHandleProps, onMoveUp, onMoveDown }) => (
          <CollapsibleEditableBlock
            key={item.id}
            setNodeRef={ref}
            style={style}
            dragHandleProps={dragHandleProps}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            expanded={collapse.isExpanded(item.id)}
            onToggle={() => collapse.toggle(item.id)}
            onSave={() => collapse.collapse(item.id)}
            onDelete={() => removeItem(item.id)}
            preview={
              <BlockPreview
                title={(item.name as string) || ""}
                subtitle={(item.issuer as string) || ""}
                meta={(item.date as string) || ""}
                placeholder={`Certification #${i + 1}`}
              />
            }
          >
            <div>
              <Field label="Certification Name">
                <Input
                  size={1}
                  value={(item.name as string) ?? ""}
                  onChange={(e) => updateItem(i, "name", e.target.value)}
                  placeholder="AWS Solutions Architect"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Field label="Issuer">
                <Input
                  size={1}
                  value={(item.issuer as string) ?? ""}
                  onChange={(e) => updateItem(i, "issuer", e.target.value)}
                  placeholder="Amazon"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
              <Field label="Date">
                <Input
                  size={1}
                  value={(item.date as string) ?? ""}
                  onChange={(e) => updateItem(i, "date", e.target.value)}
                  placeholder="Mar 2024"
                  className="h-10 lg:h-8 text-sm"
                />
              </Field>
            </div>
            <Field label="Credential Link">
              <Input
                size={1}
                value={
                  (item.credentialUrl as string) ?? (item.url as string) ?? ""
                }
                onChange={(e) => updateItem(i, "credentialUrl", e.target.value)}
                placeholder="https://verify.example.com/abc"
                className="h-10 lg:h-8 text-sm"
              />
            </Field>
          </CollapsibleEditableBlock>
        )}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="gap-1.5 h-10 lg:h-8 text-xs font-medium w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        Add certification
      </Button>
    </div>
  );
}

export function SectionEditor({
  section,
  onChange,
  onVisibilityToggle,
  resumeId,
  allSections,
  templateId,
}: SectionEditorProps) {
  const { user } = useUser();
  const isPremium = user?.publicMetadata?.isPremium === true;
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          {((section.content.heading as string) ?? "").trim() || section.title}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={onVisibilityToggle}
        >
          {section.isVisible !== false ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {section.isVisible === false ? (
        <p className="text-xs text-muted-foreground italic">
          This section is hidden from your resume.
        </p>
      ) : (
        <>
          {section.type !== "personal" && (
            <div className="mb-4 pb-4 border-b border-border">
              <SectionHeadingField
                type={section.type}
                content={section.content}
                onChange={onChange}
              />
            </div>
          )}
          {section.type === "personal" && (
            <PersonalEditor content={section.content} onChange={onChange} />
          )}
          {section.type === "summary" && (
            <SummaryEditor
              content={section.content}
              onChange={onChange}
              allSections={allSections}
              isPremium={isPremium}
              onShowPaywall={() => setShowPaywall(true)}
            />
          )}
          {section.type === "experience" && (
            <ExperienceEditor
              content={section.content}
              onChange={onChange}
              isPremium={isPremium}
              onShowPaywall={() => setShowPaywall(true)}
            />
          )}
          {section.type === "education" && (
            <EducationEditor content={section.content} onChange={onChange} />
          )}
          {section.type === "skills" && (
            <SkillsEditor
              content={section.content}
              onChange={onChange}
              allSections={allSections}
              isPremium={isPremium}
              onShowPaywall={() => setShowPaywall(true)}
              templateId={templateId}
            />
          )}
          {section.type === "projects" && (
            <ProjectsEditor
              content={section.content}
              onChange={onChange}
            />
          )}
          {section.type === "certifications" && (
            <CertificationsEditor
              content={section.content}
              onChange={onChange}
            />
          )}
        </>
      )}

      <PaywallDialog
        open={showPaywall}
        onOpenChange={setShowPaywall}
        title="AI Features are Premium"
        description="Unlock unlimited AI writing, bullet point improvement, and skill suggestions with the Pro plan."
      />
    </div>
  );
}
