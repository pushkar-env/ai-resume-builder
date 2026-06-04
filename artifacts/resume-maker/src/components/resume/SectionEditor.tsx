import { useState, useRef, startTransition } from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  X,
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
import { TEMPLATE_DEFAULT_SKILL_STYLES } from "@/lib/template-config";

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

/* ─── Tiny icon-only delete button used inside item cards ─── */
function DeleteIconButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Delete ${label}`}
      aria-label={`Delete ${label}`}
      className="absolute top-2 right-2 h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-destructive border border-transparent hover:border-destructive transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
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
    if (!isPremium) {
      onShowPaywall();
      return;
    }
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
  const items: Array<Record<string, unknown>> =
    (content.items as Array<Record<string, unknown>>) ?? [];

  const updateItem = (i: number, key: string, val: unknown) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    onChange({
      ...content,
      items: [
        ...items,
        {
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

  const removeItem = (i: number) => {
    onChange({ ...content, items: items.filter((_, idx) => idx !== i) });
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
      {items.map((item, i) => {
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
          <div
            key={i}
            className="rounded-lg border border-border p-3 space-y-2.5 relative"
          >
            <DeleteIconButton
              onClick={() => removeItem(i)}
              label={`experience #${i + 1}`}
            />
            <div className="grid grid-cols-2 gap-2 items-end pr-7">
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
                    <div className="flex gap-1.5">
                      <div className="flex-1 min-w-0">
                        <RichTextEditor
                          value={b.text}
                          onChange={(val) => updateBulletAt(bi, { text: val })}
                          placeholder="• Led ..."
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Improve with AI"
                          onClick={() => {
                            if (!isPremium) {
                              onShowPaywall();
                              return;
                            }
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
                            <Sparkles className="h-3 w-3 text-primary" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete bullet"
                          onClick={() => removeBullet(bi)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
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
          </div>
        );
      })}
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
  const items: Array<Record<string, unknown>> =
    (content.items as Array<Record<string, unknown>>) ?? [];

  const updateItem = (i: number, key: string, val: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-3 space-y-2 relative"
        >
          <DeleteIconButton
            onClick={() =>
              onChange({
                ...content,
                items: items.filter((_, idx) => idx !== i),
              })
            }
            label={`education #${i + 1}`}
          />
          <div className="pr-7">
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
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...content,
            items: [
              ...items,
              {
                school: "",
                degree: "",
                field: "",
                startDate: "",
                endDate: "",
                gpa: "",
                gpaMode: "gpa",
              },
            ],
          })
        }
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
  const { toast } = useToast();
  const items: Array<Record<string, unknown>> =
    (content.items as Array<Record<string, unknown>>) ?? [];
  const defaultStyle = templateId
    ? (TEMPLATE_DEFAULT_SKILL_STYLES[templateId] ?? "chips")
    : "chips";
  const style = (content.style as string) ?? defaultStyle;
  const showLevel = style === "bars" || style === "radial";

  const [suggested, setSuggested] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

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
      .map((s) => ({ name: s, level: 70 }));
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
      items: [...items, { name: newSkill.trim(), level: 70 }],
    });
    setNewSkill("");
  };

  const updateLevel = (i: number, lvl: number) => {
    const next = [...items];
    next[i] = { ...next[i], level: lvl };
    onChange({ ...content, items: next });
  };

  const personal = findPersonal(allSections);
  const jobTitle = jobTitleFrom(personal);
  const summaryText = findSummary(allSections);

  const handleSuggest = () => {
    if (!isPremium) {
      onShowPaywall();
      return;
    }
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
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = { ...next[i], name: e.target.value };
                        onChange({ ...content, items: next });
                      }}
                      placeholder="Skill name"
                      className="h-9 lg:h-7 text-sm"
                    />
                    <span className="text-[10px] tabular-nums w-9 shrink-0 whitespace-nowrap text-right text-muted-foreground select-none">
                      {currentVal} / 5
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...content,
                          items: items.filter((_, idx) => idx !== i),
                        })
                      }
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
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {item.name as string}
              <button
                onClick={() =>
                  onChange({
                    ...content,
                    items: items.filter((_, idx) => idx !== i),
                  })
                }
                className="hover:text-destructive transition-colors ml-0.5"
                title="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

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
  isPremium,
  onShowPaywall,
}: {
  content: SectionContent;
  onChange: (c: SectionContent) => void;
  isPremium: boolean;
  onShowPaywall: () => void;
}) {
  const { toast } = useToast();
  const items: Array<Record<string, unknown>> =
    (content.items as Array<Record<string, unknown>>) ?? [];

  const updateItem = (i: number, key: string, val: unknown) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  const [pendingProject, setPendingProject] = useState<number | null>(null);

  const contentRef = useRef(content);
  contentRef.current = content;

  const improveDescription = useImproveBullet({
    request: createAiQuickRequestOptions(),
    mutation: {
      onSuccess: (data) => {
        if (pendingProject === null) return;
        if (!data?.text?.trim()) {
          setPendingProject(null);
          toast({
            title: "AI returned no content — try again",
            variant: "destructive",
          });
          return;
        }
        const idx = pendingProject;
        const latestItems =
          (contentRef.current.items as Array<Record<string, unknown>>) ?? [];
        const updatedItems = [...latestItems];
        updatedItems[idx] = {
          ...updatedItems[idx],
          description: plainTextToRichHtml(data.text),
        };
        startTransition(() => {
          onChange({ ...contentRef.current, items: updatedItems });
        });
        setPendingProject(null);
        toast({ title: "Description improved" });
      },
      onError: (err) => {
        setPendingProject(null);
        aiErrorToast(toast, err, "Failed to improve description");
      },
    },
  });

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-3 space-y-2 relative"
        >
          <DeleteIconButton
            onClick={() =>
              onChange({
                ...content,
                items: items.filter((_, idx) => idx !== i),
              })
            }
            label={`project #${i + 1}`}
          />
          <div className="space-y-2 pr-7">
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
          <Field label="Description">
            <div className="flex gap-1.5">
              <div className="flex-1 min-w-0">
                <RichTextEditor
                  value={(item.description as string) ?? ""}
                  onChange={(val) => updateItem(i, "description", val)}
                  placeholder="Brief description..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Improve with AI"
                  onClick={() => {
                    if (!isPremium) {
                      onShowPaywall();
                      return;
                    }
                    setPendingProject(i);
                    improveDescription.mutate({
                      data: {
                        bullet: richHtmlToPlainText(
                          (item.description as string) ?? "",
                        ),
                        context: `Project named ${item.name ?? ""}`,
                      },
                    });
                  }}
                  disabled={
                    improveDescription.isPending && pendingProject === i
                  }
                >
                  {improveDescription.isPending && pendingProject === i ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-primary" />
                  )}
                </Button>
              </div>
            </div>
          </Field>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...content,
            items: [...items, { name: "", url: "", description: "" }],
          })
        }
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
  const items: Array<Record<string, unknown>> =
    (content.items as Array<Record<string, unknown>>) ?? [];

  const updateItem = (i: number, key: string, val: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    onChange({ ...content, items: updated });
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-3 space-y-2 relative"
        >
          <DeleteIconButton
            onClick={() =>
              onChange({
                ...content,
                items: items.filter((_, idx) => idx !== i),
              })
            }
            label={`certification #${i + 1}`}
          />
          <div className="pr-7">
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
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...content,
            items: [
              ...items,
              { name: "", issuer: "", date: "", credentialUrl: "" },
            ],
          })
        }
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
        <h3 className="text-sm font-semibold">{section.title}</h3>
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
              isPremium={isPremium}
              onShowPaywall={() => setShowPaywall(true)}
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
