import type * as React from "react";
import { useMemo, memo, cloneElement, isValidElement } from "react";
import type { ResumeDetail } from "@workspace/api-client-react";
import { sanitizeResumeRichHtml } from "@/lib/sanitize-resume-rich-html";
import { RESUME_EXPORT_CSS } from "@/lib/resume-export-styles";
import { RESUME_GALLERY_THUMB_CSS } from "@/lib/resume-gallery-thumb-styles";
import { ResumePagedView } from "@/components/resume/ResumePagedView";
import { ResumeWatermark } from "@/components/resume/ResumeWatermark";
import {
  getDefaultAccentColor,
  getDefaultSkillStyle,
  getDefaultFontFamily,
  resolveAccentColor,
  resolveTemplateId,
} from "@/lib/template-config";

/* ─── Types ─── */
type SC = Record<string, unknown>;
type Item = Record<string, unknown>;
interface TP {
  sections: ResumeDetail["sections"];
  color: string;
  font: string;
}

/* ─── Data helpers ─── */
function sorted(sections: ResumeDetail["sections"]) {
  return [...(sections ?? [])]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .filter((s) => s.isVisible !== false);
}
function getter(s: ResumeDetail["sections"]) {
  const arr = sorted(s);
  return (type: string) =>
    arr.find((x) => x.type === type)?.content as SC | undefined;
}
function items<T = Item>(sc: SC | undefined, key = "items"): T[] {
  return (sc?.[key] ?? []) as T[];
}
/**
 * Body section types (personal excluded) in the user's chosen display order.
 * Templates iterate this so drag-reordering in the builder is reflected everywhere.
 */
function orderedBodyTypes(sections: ResumeDetail["sections"]): string[] {
  return sorted(sections)
    .map((s) => s.type)
    .filter((t) => t !== "personal");
}
/**
 * Resolve a section's heading: the user override (`content.heading`) wins, otherwise
 * the template's own default label. Keeps each template's bespoke wording until edited.
 */
function headingOf(
  get: (type: string) => SC | undefined,
  type: string,
  fallback: string,
): string {
  const h = ((get(type)?.heading as string) ?? "").trim();
  return h || fallback;
}
/**
 * Render section blocks in display order. `blocks` maps a section type to its rendered
 * node (only present when it has content). `only` restricts to a subset of types while
 * preserving their relative order — used by two-column templates to order within a column.
 */
function orderedBlocks(
  sections: ResumeDetail["sections"],
  blocks: Partial<Record<string, React.ReactNode>>,
  only?: readonly string[],
): React.ReactNode[] {
  const allow = only ? new Set(only) : null;
  const out: React.ReactNode[] = [];
  for (const t of orderedBodyTypes(sections)) {
    if (allow && !allow.has(t)) continue;
    const node = blocks[t];
    if (node == null || node === false) continue;
    out.push(isValidElement(node) ? cloneElement(node, { key: t }) : node);
  }
  return out;
}
function str(v: unknown): string {
  return (v as string) ?? "";
}
/** Rich-text fields: sanitize on render so older saved HTML still lays out correctly */
function richHtml(v: unknown): string {
  let html = sanitizeResumeRichHtml(str(v));
  // Replace non-breaking spaces during render to prevent words from being glued together and split abruptly
  return html.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ");
}
function formatGpa(v: unknown): string {
  const gpaStr = str(v).trim();
  if (!gpaStr) return "";
  const num = Number(gpaStr);
  if (gpaStr !== "" && !isNaN(num) && Number.isInteger(num)) {
    return num.toFixed(1);
  }
  return gpaStr;
}
function renderGpa(gpa: unknown, mode: unknown): string {
  const val = str(gpa).trim();
  if (!val) return "";
  if (mode === "percentage") {
    return `${val} %`;
  }
  const formattedVal = formatGpa(gpa);
  return `GPA: ${formattedVal}`;
}
/** Coerce a skill level to a 0–100 number. Handles legacy string values like "intermediate". */
function skillPct(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v))
    return Math.min(100, Math.max(0, v));
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    const map: Record<string, number> = {
      beginner: 35,
      intermediate: 65,
      advanced: 85,
      expert: 95,
    };
    return map[v.toLowerCase()] ?? 75;
  }
  return 75;
}
function alpha(hex: string, a: number) {
  const v = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return hex.startsWith("#") ? hex + v : hex;
}

function groupedSkills(skills: Item[]): Array<{ category: string; skills: Item[] }> {
  const groups: Array<{ category: string; skills: Item[] }> = [];
  const byCategory = new Map<string, { category: string; skills: Item[] }>();
  for (const skill of skills) {
    if (!str(skill.name).trim()) continue;
    const raw = str(skill.category).trim() || "Core";
    const key = raw.toLowerCase();
    let group = byCategory.get(key);
    if (!group) {
      group = { category: raw, skills: [] };
      byCategory.set(key, group);
      groups.push(group);
    }
    group.skills.push(skill);
  }
  return groups;
}

function getSidebarNameFontSize(name: string, maxDefaultSize = 24): string {
  const nameStr = str(name).trim();
  if (!nameStr) return `calc(var(--resume-header-scale) * ${maxDefaultSize}px)`;
  const words = nameStr.split(/\s+/);
  const maxWordLength = Math.max(...words.map((w) => w.length));
  if (maxWordLength > 8) {
    const calculated = Math.max(
      16,
      Math.round(maxDefaultSize * (8 / maxWordLength)),
    );
    return `calc(var(--resume-header-scale) * ${calculated}px)`;
  }
  return `calc(var(--resume-header-scale) * ${maxDefaultSize}px)`;
}

/** Parse #RGB / #RRGGBB / #RRGGBBAA (alpha stripped for luminance). */
function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function blendWithWhite(hex: string, a: number) {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const r = Math.round(rgb.r * a + 255 * (1 - a));
  const g = Math.round(rgb.g * a + 255 * (1 - a));
  const b = Math.round(rgb.b * a + 255 * (1 - a));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminanceHex(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const R = srgbChannelToLinear(rgb.r);
  const G = srgbChannelToLinear(rgb.g);
  const B = srgbChannelToLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio for two sRGB hex colors. */
function contrastRatio(fgHex: string, bgHex: string): number | null {
  const L1 = relativeLuminanceHex(fgHex);
  const L2 = relativeLuminanceHex(bgHex);
  if (L1 == null || L2 == null) return null;
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Use accent for links when it reads clearly on `backgroundHex`; otherwise fall back to
 * light or dark neutrals aligned with the resume palette (slate / off-white).
 */
function readableAccentOnBackground(
  backgroundHex: string,
  accentHex: string,
  minRatio = 4.5,
): string {
  const onBg = contrastRatio(accentHex, backgroundHex);
  if (onBg != null && onBg >= minRatio) return accentHex;
  const light = "#f1f5f9"; // slate-100 — readable on deep navy / saturated accents
  const ink = "#0f172a"; // slate-900 — for very light header fills
  const rLight = contrastRatio(light, backgroundHex);
  const rInk = contrastRatio(ink, backgroundHex);
  if (rLight != null && rLight >= minRatio && (rInk == null || rLight >= rInk))
    return light;
  if (rInk != null && rInk >= minRatio) return ink;
  return light;
}

/* ─── Skill progress bar ─── */
function SkillBar({
  name,
  level,
  color,
}: {
  name: string;
  level?: unknown;
  color: string;
}) {
  const pct = skillPct(level);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[11px] text-gray-700 font-medium">{name}</span>
        <span className="text-[9.5px] text-gray-400">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ─── Personal-section helpers (job title, contacts, socials, photo / initials) ─── */
function roleOf(p: SC): string {
  return ((p.jobTitle as string) || (p.title as string) || "").trim();
}
type Social = { label: string; url: string };
function socialsList(p: SC): Social[] {
  const arr = p.socials as unknown;
  if (Array.isArray(arr)) {
    return arr
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({ label: str(x.label).trim(), url: str(x.url).trim() }))
      .filter((s) => s.label.length > 0);
  }
  // Backward-compat: derive from legacy fixed fields
  const legacy: Social[] = [];
  if (str(p.github).trim())
    legacy.push({ label: "GitHub", url: str(p.github).trim() });
  if (str(p.linkedin).trim())
    legacy.push({ label: "LinkedIn", url: str(p.linkedin).trim() });
  if (str(p.twitter).trim())
    legacy.push({ label: "Twitter", url: str(p.twitter).trim() });
  return legacy;
}
function ensureProto(u: string): string {
  if (!u) return u;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
function normalizeEmailHref(v: unknown): string | null {
  const email = str(v).trim();
  if (!email) return null;
  return `mailto:${email}`;
}
function normalizeTelHref(v: unknown): string | null {
  const phone = str(v).trim();
  if (!phone) return null;
  // Keep leading +, strip all other non-digit characters for robust tel links.
  const normalized = phone.replace(/(?!^\+)[^\d]/g, "").replace(/^\+{2,}/, "+");
  const hasDigits = /\d/.test(normalized);
  if (!hasDigits) return null;
  return `tel:${normalized}`;
}
function contactValues(p: SC, color?: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const emailText = str(p.email).trim();
  if (emailText) {
    const emailHref = normalizeEmailHref(emailText);
    out.push(
      emailHref ? (
        <a
          key="contact-email"
          href={emailHref}
          className="underline underline-offset-2"
          style={color ? { color } : undefined}
        >
          {emailText}
        </a>
      ) : (
        emailText
      ),
    );
  }
  const phoneText = str(p.phone).trim();
  if (phoneText) {
    const phoneHref = normalizeTelHref(phoneText);
    out.push(
      phoneHref ? (
        <a
          key="contact-phone"
          href={phoneHref}
          className="underline underline-offset-2"
          style={color ? { color } : undefined}
        >
          {phoneText}
        </a>
      ) : (
        phoneText
      ),
    );
  }
  const locationText = str(p.location).trim();
  if (locationText) out.push(locationText);
  socialsList(p).forEach((s, i) => {
    out.push(
      s.url ? (
        <a
          key={`s-${i}-${s.label}`}
          href={ensureProto(s.url)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold underline underline-offset-2"
          style={color ? { color } : undefined}
        >
          {s.label}
        </a>
      ) : (
        <span
          key={`s-${i}-${s.label}`}
          className="font-semibold"
          style={color ? { color } : undefined}
        >
          {s.label}
        </span>
      ),
    );
  });
  return out;
}
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function Avatar({
  p,
  sizeClass = "h-14 w-14 text-xl",
  bg,
  textColor = "#fff",
}: {
  p: SC;
  sizeClass?: string;
  bg: string;
  textColor?: string;
}) {
  const photo = (p.photo as string) ?? "";
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center font-black shrink-0`}
      style={{ background: bg, color: textColor }}
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsFor((p.name as string) ?? "")
      )}
    </div>
  );
}

/* ─── Bullet helpers (text + optional work-sample link/label) ─── */
function bulletParts(b: unknown): {
  text: string;
  label: string;
  link: string;
} {
  if (typeof b === "string") return { text: b, label: "", link: "" };
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    return {
      text: str(o.text),
      label: str(o.label).trim(),
      link: str(o.link ?? o.url).trim(),
    };
  }
  return { text: "", label: "", link: "" };
}
function BulletContent({ b, color }: { b: unknown; color: string }) {
  const { text, label, link } = bulletParts(b);
  if (!text && !label && !link) return null;
  return (
    <div className="flex flex-col gap-1 w-full min-w-0" data-resume-keep>
      <div
        dangerouslySetInnerHTML={{ __html: richHtml(text) }}
        className="resume-text text-[11px] leading-[1.55] [&>p]:mb-1 last:[&>p]:mb-0"
      />
      {link ? (
        <div>
          <a
            href={ensureProto(link)}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 font-semibold"
            style={{ color }}
          >
            {label || "view sample"}
          </a>
        </div>
      ) : label ? (
        <div>
          <span className="font-semibold" style={{ color }}>
            — {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Structured project bullet points (new). Returns the non-empty bullets, or `[]` when a project
 * still only has the legacy single `description`. Bullets may be plain strings or {text,label,link}.
 */
function projectBullets(pr: Item): unknown[] {
  const bl = (pr.bullets as unknown[]) ?? [];
  return bl.filter((b) => {
    const p = bulletParts(b);
    return p.text || p.label || p.link;
  });
}

/**
 * Renders a project's body: multiple structured bullets styled to match the template's own
 * Experience bullets, or the legacy single `description` HTML as a fallback. Each template passes
 * its bullet `marker`, `rowClassName`, and text classes so projects and experience look identical.
 */
function ProjectDetail({
  pr,
  color,
  marker,
  rowClassName,
  textClassName,
  containerClassName = "mt-1 space-y-1",
  descClassName,
}: {
  pr: Item;
  color: string;
  marker: React.ReactNode;
  rowClassName: string;
  textClassName: string;
  containerClassName?: string;
  descClassName: string;
}) {
  const bl = projectBullets(pr);
  if (bl.length > 0) {
    return (
      <div className={containerClassName}>
        {bl.map((b, j) => (
          <div key={j} className={rowClassName}>
            {marker}
            <div className={`flex-1 min-w-0 ${textClassName}`}>
              <BulletContent b={b} color={color} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (str(pr.description)) {
    return (
      <div
        className={descClassName}
        dangerouslySetInnerHTML={{ __html: richHtml(pr.description) }}
      />
    );
  }
  return null;
}

/* ─── Certification line with optional credential link ─── */
function CertLine({
  c,
  className = "",
  color,
  dark = false,
}: {
  c: Item;
  className?: string;
  color?: string;
  dark?: boolean;
}) {
  const url = (str(c.credentialUrl) || str(c.url)).trim();
  return (
    <p className={className} data-resume-keep>
      {str(c.name)}
      {c.issuer ? ` — ${str(c.issuer)}` : ""}
      {c.date ? ` (${str(c.date)})` : ""}
      {url && (
        <>
          {" · "}
          <a
            href={ensureProto(url)}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:opacity-80"
            style={{ color: color ?? (dark ? "#fff" : undefined) }}
          >
            verify
          </a>
        </>
      )}
    </p>
  );
}

/* ─── Project Link ─── */
function ProjectLink({
  url,
  label,
  color,
  className = "text-[10px]",
  dark = false,
}: {
  url: unknown;
  label: unknown;
  color?: string;
  className?: string;
  dark?: boolean;
}) {
  const u = str(url).trim();
  const l = str(label).trim();
  if (!u && !l) return null;
  const href = ensureProto(u);
  const displayText = l || u.replace(/^https?:\/\//i, "");
  if (!href) {
    return (
      <span
        className={className}
        style={{ color: color ?? (dark ? "#fff" : undefined) }}
      >
        {displayText}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`${className} underline underline-offset-2 hover:opacity-80 transition-opacity`}
      style={{ color: color ?? (dark ? "#fff" : undefined) }}
    >
      {displayText}
    </a>
  );
}

/* ─── Unified skill block — bars / chips / radial / text ─── */
function renderSkills(
  skills: Item[],
  style: string | undefined,
  color: string,
  dark: boolean,
  groupedLayout: "inline" | "stacked" = "inline",
): React.ReactElement | null {
  if (!skills || skills.length === 0) return null;
  const effective = style ?? "chips";

  if (effective === "grouped") {
    const groups = groupedSkills(skills);
    if (groups.length === 0) return null;
    if (groupedLayout === "inline") {
      return (
        <div className="space-y-1.5">
          {groups.map((group) => (
            <div
              key={group.category}
              className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[10.8px] leading-[1.55] ${dark ? "text-white/82" : "text-gray-700"}`}
            >
              <span
                className={`font-bold ${dark ? "text-white" : "text-gray-800"}`}
                style={{ color }}
              >
                {group.category}
              </span>
              <span className={dark ? "text-white/55" : "text-gray-400"}>-</span>
              {group.skills.map((s, i) => (
                <span key={`${group.category}-${i}-${str(s.name)}`}>
                  {str(s.name)}
                  {i < group.skills.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.category} className="min-w-0">
            <p
              className={`text-[10px] font-bold uppercase tracking-wide leading-snug mb-1 ${dark ? "text-white" : "text-gray-800"}`}
              style={{ color }}
            >
              {group.category}
            </p>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {group.skills.map((s, i) => (
                <span
                  key={`${group.category}-${i}-${str(s.name)}`}
                  className={`text-[10.5px] leading-snug ${dark ? "text-white/82" : "text-gray-700"}`}
                >
                  {str(s.name)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (effective === "bars") {
    return (
      <div className="space-y-1.5">
        {skills.map((s, i) => {
          const rating = Math.ceil(skillPct(s.level) / 20) || 1;
          return (
            <div key={i}>
              <div className="flex justify-between mb-0.5">
                <span
                  className={`text-[11px] font-medium ${dark ? "text-white" : "text-gray-700"}`}
                >
                  {str(s.name)}
                </span>
                <span
                  className={`text-[9.5px] ${dark ? "text-white/60" : "text-gray-400"}`}
                >
                  {rating} / 5
                </span>
              </div>
              <div className="flex gap-[2px]">
                {[1, 2, 3, 4, 5].map((slot) => (
                  <div
                    key={slot}
                    className="h-1 flex-1 rounded-[1px] transition-all"
                    style={{
                      background:
                        slot <= rating
                          ? color
                          : dark
                            ? alpha("#ffffff", 0.15)
                            : alpha("#000000", 0.08),
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (effective === "radial") {
    const C = 2 * Math.PI * 14;
    const step = C / 5;
    const slotLen = 10;

    return (
      <div className="grid grid-cols-3 gap-x-1 gap-y-2">
        {skills.map((s, i) => {
          const rating = Math.ceil(skillPct(s.level) / 20) || 1;
          return (
            <div key={i} className="flex flex-col items-center">
              <svg width="34" height="34" viewBox="0 0 36 36">
                {[1, 2, 3, 4, 5].map((slot) => {
                  const isActive = slot <= rating;
                  const offset = -(slot - 1) * step;
                  return (
                    <circle
                      key={slot}
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={
                        isActive
                          ? color
                          : dark
                            ? "rgba(255,255,255,0.18)"
                            : "#e5e7eb"
                      }
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${slotLen} ${C - slotLen}`}
                      strokeDashoffset={offset}
                      transform="rotate(-90 18 18)"
                    />
                  );
                })}
                <text
                  x="18"
                  y="20.5"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={700}
                  fill={color}
                >
                  {rating}/5
                </text>
              </svg>
              <span
                className={`text-[9.5px] mt-0.5 text-center leading-tight ${dark ? "text-white/85" : "text-gray-700"}`}
              >
                {str(s.name)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (effective === "text") {
    return (
      <p
        className={`text-[11px] leading-[1.7] ${dark ? "text-white/75" : "text-gray-600"}`}
      >
        {skills
          .map((s) => str(s.name))
          .filter(Boolean)
          .join("  ·  ")}
      </p>
    );
  }

  if (effective === "bullets") {
    return (
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {skills.map((s, i) => (
          <div key={i} className="inline-flex items-center gap-1.5 min-w-0">
            <span
              className="h-1 w-1 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span
              className={`text-[11px] font-medium leading-normal ${dark ? "text-white/90" : "text-gray-700"}`}
            >
              {str(s.name)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // chips (default)
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s, i) => (
        <span
          key={i}
          className="text-[10.5px] px-2 py-0.5 rounded font-semibold"
          style={{
            background: dark ? alpha(color, 0.3) : alpha(color, 0.12),
            color: color,
          }}
        >
          {str(s.name)}
        </span>
      ))}
    </div>
  );
}
function skillsStyleOf(sections: ResumeDetail["sections"]): string | undefined {
  const sec = (sections ?? []).find((s) => s.type === "skills");
  return (sec?.content as SC | undefined)?.style as string | undefined;
}

/* ─── Timeline dot — sits centered on the parent's left border (Silicon Valley uses pl-4) ─── */
function TimelineDot({ color }: { color: string }) {
  return (
    <div
      className="absolute top-[4px] h-2.5 w-2.5 rounded-full border-2 bg-white"
      style={{
        left: "-21px",
        transform: "translateX(-50%)",
        borderColor: color,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   1. SILICON VALLEY — Dark sidebar, tech chips, clean timeline
═══════════════════════════════════════════════════════════ */
export function SiliconValleyTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const sidebar = alpha(color, 0.05);
  const H = (t: string, fb: string) => headingOf(get, t, fb);
  const sideDivider = { borderBottom: `1px solid rgba(0,0,0,0.06)` };

  const MainHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3.5 resume-section-header">
      <p
        className="text-[14px] font-bold uppercase tracking-[0.13em]"
        style={{ color }}
      >
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: alpha(color, 0.25) }} />
    </div>
  );

  const sidebarBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (skills.length > 0) {
    sidebarBlocks.skills = (
      <div className="resume-export-block px-5 py-5" style={sideDivider}>
        <p
          className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3.5"
          style={{ color }}
        >
          {H("skills", "Skills")}
        </p>
        {renderSkills(skills, skillsStyle, color, false, "stacked")}
      </div>
    );
  }
  if (edu.length > 0) {
    sidebarBlocks.education = (
      <div className="px-5 py-5" style={sideDivider}>
        <div className="resume-export-block">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3.5"
            style={{ color }}
          >
            {H("education", "Education")}
          </p>
          <div>
            <p className="text-[12px] font-bold text-gray-900">
              {str(edu[0].school)}
            </p>
            <p className="text-[11px] text-gray-600">
              {str(edu[0].degree)}
              {edu[0].field ? `, ${str(edu[0].field)}` : ""}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {str(edu[0].startDate)}
              {edu[0].endDate ? ` – ${str(edu[0].endDate)}` : ""}
              {edu[0].gpa ? ` · ${renderGpa(edu[0].gpa, edu[0].gpaMode)}` : ""}
            </p>
          </div>
        </div>
        {edu.length > 1 && (
          <div className="space-y-3.5 mt-3.5">
            {edu.slice(1).map((e, i) => (
              <div key={i} className="resume-export-block">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.school)}
                </p>
                <p className="text-[11px] text-gray-600">
                  {str(e.degree)}
                  {e.field ? `, ${str(e.field)}` : ""}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {str(e.startDate)}
                  {e.endDate ? ` – ${str(e.endDate)}` : ""}
                  {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (certs.length > 0) {
    sidebarBlocks.certifications = (
      <div className="px-5 py-5" style={sideDivider}>
        <div className="resume-export-block">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3.5"
            style={{ color }}
          >
            {H("certifications", "Certifications")}
          </p>
          <div>
            <CertLine
              c={certs[0]}
              className="text-[11px] text-gray-600 mb-1"
              color={color}
            />
          </div>
        </div>
        {certs.length > 1 && (
          <div className="space-y-1 mt-1">
            {certs.slice(1).map((c, i) => (
              <div key={i} className="resume-export-block">
                <CertLine
                  c={c}
                  className="text-[11px] text-gray-600 mb-1"
                  color={color}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const mainBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    mainBlocks.summary = (
      <div className="resume-export-block mb-7">
        <MainHead label={H("summary", "About")} />
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.65]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    mainBlocks.experience = (
      <div className="mb-7">
        <MainHead label={H("experience", "Experience")} />
        <div className="relative pl-5 border-l-2 border-transparent">
          <div
            className="absolute w-[2px] bg-gray-100"
            style={{
              top: "8px",
              bottom: "-4px",
              left: "-1px",
              transform: "translateX(-50%)",
              zIndex: 0,
            }}
          />
          <div className="space-y-4">
            {exp.map((e, i) => (
              <div key={i} className="resume-export-block relative">
                <TimelineDot color={color} />
                <div className="flex justify-between items-start mb-0.5">
                  <div>
                    <p className="text-[12.5px] font-bold text-gray-900">
                      {str(e.title)}
                    </p>
                    <p className="text-[11.5px] font-semibold text-gray-500">
                      {str(e.company)}
                      {e.location ? ` · ${str(e.location)}` : ""}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400 shrink-0 ml-3 mt-0.5">
                    {str(e.startDate)}
                    {e.endDate
                      ? ` – ${str(e.endDate)}`
                      : e.startDate
                        ? " – Present"
                        : ""}
                  </p>
                </div>
                {items<unknown>(e as SC, "bullets")
                  .filter((b) => {
                    const p = bulletParts(b);
                    return p.text || p.label || p.link;
                  })
                  .map((b, j) => (
                    <div key={j} className="flex gap-1.5 mt-1">
                      <span
                        className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.55]">
                        <BulletContent b={b} color={color} />
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    mainBlocks.projects = (
      <div className="mb-7">
        <MainHead label={H("projects", "Projects")} />
        <div className="space-y-4">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12.5px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10.5px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={
                  <span
                    className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                }
                rowClassName="flex gap-1.5"
                textClassName="text-[11px] text-gray-600 leading-[1.55]"
                descClassName="resume-text text-[11px] text-gray-600 mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full"
      data-resume-two-col-root
      style={{ fontFamily: font, minHeight: "100%" }}
    >
      {/* Sidebar */}
      <div
        className="w-[240px] shrink-0 flex flex-col"
        data-resume-sidebar
        style={{ background: sidebar, minHeight: "100%" }}
      >
        {/* Name block */}
        <div
          className="p-6 pb-4"
          style={{ borderBottom: `1px solid rgba(0,0,0,0.08)` }}
        >
          <h1
            className="font-bold text-gray-900 tracking-tight"
            style={{
              fontSize: getSidebarNameFontSize(str(p.name), 24),
              lineHeight: "1.2",
            }}
          >
            {str(p.name) || "Your Name"}
          </h1>
          {roleOf(p) && (
            <p className="text-[12px] mt-1 font-semibold" style={{ color }}>
              {roleOf(p)}
            </p>
          )}
        </div>

        {/* Contact */}
        <div className="resume-export-block px-5 py-5" style={sideDivider}>
          <p
            className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3"
            style={{ color }}
          >
            Contact
          </p>
          {contactValues(p, color).map((v, i) => (
            <p
              key={i}
              className="text-[11px] text-gray-600 mb-1 leading-relaxed break-all"
            >
              {v}
            </p>
          ))}
        </div>

        {orderedBlocks(sections, sidebarBlocks, [
          "skills",
          "education",
          "certifications",
        ])}
      </div>

      {/* Main */}
      <div className="resume-template-columns-main flex-1 px-8 py-7">
        {orderedBlocks(sections, mainBlocks, [
          "summary",
          "experience",
          "projects",
        ])}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. FAANG ENGINEER — Precision layout, skill bars, timeline
═══════════════════════════════════════════════════════════ */
export function FaangTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const H = (t: string, fb: string) => headingOf(get, t, fb);

  const MainHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-4 w-[3px] rounded-full" style={{ background: color }} />
      <p className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800">
        {label}
      </p>
    </div>
  );

  const mainBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    mainBlocks.summary = (
      <div className="resume-export-block mb-6">
        <MainHead label={H("summary", "Summary")} />
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.65]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    mainBlocks.experience = (
      <div className="mb-6">
        <MainHead label={H("experience", "Experience")} />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div
              key={i}
              className="resume-export-block pl-3"
              style={{ borderLeft: `2px solid ${alpha(color, 0.2)}` }}
            >
              <div className="flex justify-between items-baseline">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.title)}
                </p>
                <p className="text-[10px] text-gray-400 shrink-0 ml-2">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Present"
                      : ""}
                </p>
              </div>
              <p className="text-[11px] font-bold" style={{ color }}>
                {str(e.company)}
                {e.location ? ` · ${str(e.location)}` : ""}
              </p>
              {items<unknown>(e as SC, "bullets")
                .filter((b) => {
                  const p = bulletParts(b);
                  return p.text || p.label || p.link;
                })
                .map((b, j) => (
                  <div key={j} className="flex gap-1.5 mt-1.5">
                    <span className="shrink-0 mt-[6px] text-gray-400">
                      <svg
                        viewBox="0 0 10 10"
                        width="4.5"
                        height="4.5"
                        fill="currentColor"
                      >
                        <path d="M0,0 L10,5 L0,10 Z" />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.55]">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    mainBlocks.projects = (
      <div className="mb-6">
        <MainHead label={H("projects", "Projects")} />
        <div className="space-y-4">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={
                  <span className="shrink-0 mt-[6px] text-gray-400">
                    <svg
                      viewBox="0 0 10 10"
                      width="4.5"
                      height="4.5"
                      fill="currentColor"
                    >
                      <path d="M0,0 L10,5 L0,10 Z" />
                    </svg>
                  </span>
                }
                rowClassName="flex gap-1.5"
                textClassName="text-[11px] text-gray-600 leading-[1.55]"
                descClassName="resume-text text-[11px] text-gray-600 mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (edu.length > 0) {
    mainBlocks.education = (
      <div className="mb-6">
        <MainHead label={H("education", "Education")} />
        <div className="space-y-3.5">
          {edu.map((e, i) => (
            <div
              key={i}
              className="resume-export-block flex justify-between items-start"
            >
              <div>
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.school)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {str(e.degree)}
                  {e.field ? `, ${str(e.field)}` : ""}
                  {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 shrink-0 ml-2 mt-0.5">
                {str(e.startDate)}
                {e.endDate ? ` – ${str(e.endDate)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sideBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (skills.length > 0) {
    sideBlocks.skills = (
      <div className="resume-export-block mb-6">
        <p
          className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800 mb-3"
          style={{ color }}
        >
          {H("skills", "Skills")}
        </p>
        {renderSkills(skills, skillsStyle, color, false, "stacked")}
      </div>
    );
  }
  if (certs.length > 0) {
    sideBlocks.certifications = (
      <div>
        <p
          className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800 mb-3"
          style={{ color }}
        >
          {H("certifications", "Certs")}
        </p>
        <div className="space-y-2">
          {certs.map((c, i) => {
            const url = (str(c.credentialUrl) || str(c.url)).trim();
            return (
              <div
                key={i}
                className="resume-export-block p-2 rounded"
                style={{ background: alpha(color, 0.06) }}
              >
                <p className="text-[11px] font-semibold text-gray-800">
                  {str(c.name)}
                </p>
                {str(c.issuer) && (
                  <p className="text-[9.5px] text-gray-500 mt-0.5">
                    {str(c.issuer)}
                  </p>
                )}
                {url && (
                  <a
                    href={ensureProto(url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[9.5px] underline mt-0.5 block"
                    style={{ color }}
                  >
                    verify
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 py-8" style={{ fontFamily: font }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[30px] font-black text-gray-950 tracking-tight leading-none">
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p className="text-[12px] font-bold mt-1.5" style={{ color }}>
            {roleOf(p)}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[10px] text-gray-500">
              {v}
            </span>
          ))}
        </div>
        <div
          className="mt-3.5 h-0.5 rounded-full"
          style={{
            background: `linear-gradient(to right, ${color}, transparent)`,
          }}
        />
      </div>

      <div className="flex gap-8">
        {/* Main column */}
        <div className="flex-1 min-w-0">
          {orderedBlocks(sections, mainBlocks, [
            "summary",
            "experience",
            "projects",
            "education",
          ])}
        </div>

        {/* Right skills column */}
        {(skills.length > 0 || certs.length > 0) && (
          <div className="w-[170px] shrink-0">
            {orderedBlocks(sections, sideBlocks, ["skills", "certifications"])}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. NOVA MINIMAL — Ultra-clean Scandinavian whitespace
═══════════════════════════════════════════════════════════ */
export function NovaTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const H = (t: string, fb: string) => headingOf(get, t, fb);

  const NovaHead = ({
    label,
    className = "",
  }: {
    label: string;
    className?: string;
  }) => (
    <p
      className={`text-[13.5px] font-bold uppercase tracking-[0.2em] ${className}`}
      style={{ color }}
    >
      {label}
    </p>
  );

  const blocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    blocks.summary = (
      <div className="resume-export-block mb-6">
        <NovaHead label={H("summary", "Profile")} className="mb-2 text-center" />
        <div
          className="resume-text text-[11px] text-gray-500 leading-[1.7] text-center max-w-[480px] mx-auto"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    blocks.experience = (
      <div className="mb-6">
        <NovaHead label={H("experience", "Experience")} className="mb-3.5" />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block flex gap-5">
              <div className="w-[115px] shrink-0 text-right">
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  {str(e.startDate)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {str(e.endDate) || (e.startDate ? "Present" : "")}
                </p>
              </div>
              <div className="flex-1 border-l border-gray-100 pl-5">
                <p className="text-[12px] font-bold text-gray-800">
                  {str(e.title)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {str(e.company)}
                  {e.location ? `, ${str(e.location)}` : ""}
                </p>
                {items<unknown>(e as SC, "bullets")
                  .filter((b) => {
                    const p = bulletParts(b);
                    return p.text || p.label || p.link;
                  })
                  .map((b, j) => (
                    <div
                      key={j}
                      className="flex-1 min-w-0 text-[11px] text-gray-500 leading-[1.6] mt-1"
                    >
                      <BulletContent b={b} color={color} />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (edu.length > 0) {
    blocks.education = (
      <div className="mb-6">
        <NovaHead label={H("education", "Education")} className="mb-3.5" />
        <div className="space-y-3">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              <p className="text-[12px] font-bold text-gray-800">
                {str(e.school)}
              </p>
              <p className="text-[11px] text-gray-400">
                {str(e.degree)}
                {e.field ? `, ${str(e.field)}` : ""}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">
                {str(e.startDate)}
                {e.endDate ? ` – ${str(e.endDate)}` : ""}
                {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (skills.length > 0) {
    blocks.skills = (
      <div className="resume-export-block mb-6">
        <NovaHead label={H("skills", "Expertise")} className="mb-3.5" />
        {renderSkills(skills, skillsStyle, color, false)}
      </div>
    );
  }
  if (projects.length > 0) {
    blocks.projects = (
      <div className="mb-6">
        <NovaHead
          label={H("projects", "Selected Projects")}
          className="mb-3.5"
        />
        <div className="space-y-3">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block flex gap-4">
              <div className="w-[150px] shrink-0">
                <p className="text-[12px] font-bold text-gray-700">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <div className="flex-1 min-w-0">
                <ProjectDetail
                  pr={pr}
                  color={color}
                  marker={
                    <span
                      className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                  }
                  rowClassName="flex gap-1.5"
                  textClassName="text-[11px] text-gray-500 leading-[1.6]"
                  containerClassName="space-y-1"
                  descClassName="resume-text text-[11px] text-gray-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (certs.length > 0) {
    blocks.certifications = (
      <div className="resume-export-block mb-6">
        <NovaHead label={H("certifications", "Certifications")} className="mb-3.5" />
        <div className="flex flex-wrap gap-3">
          {certs.map((c, i) => (
            <CertLine
              key={i}
              c={c}
              className="text-[11px] text-gray-500"
              color={color}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10" style={{ fontFamily: font }}>
      {/* Header — centered, minimal */}
      <div className="text-center mb-7">
        <h1 className="text-[30px] font-extralight tracking-[0.18em] text-gray-900 uppercase leading-tight">
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p
            className="text-[12px] mt-2 font-semibold uppercase tracking-[0.2em]"
            style={{ color }}
          >
            {roleOf(p)}
          </p>
        )}
        <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1.5 mt-3.5">
          {contactValues(p, color).map((v, i, arr) => (
            <span key={i} className="flex items-center gap-4">
              <span className="text-[10px] text-gray-400 tracking-wide">
                {v}
              </span>
              {i < arr.length - 1 && (
                <span className="text-gray-200 text-xs">·</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex justify-center mt-4">
          <div className="h-px w-20" style={{ background: color }} />
        </div>
      </div>

      {orderedBlocks(sections, blocks)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   4. EXECUTIVE PRO — Serif elegance, decorative rules
═══════════════════════════════════════════════════════════ */
export function ExecutiveProTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const H = (t: string, fb: string) => headingOf(get, t, fb);

  const rule = (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px" style={{ background: alpha(color, 0.2) }} />
      <div
        className="h-1 w-1 rounded-full"
        style={{ background: alpha(color, 0.4) }}
      />
      <div className="flex-1 h-px" style={{ background: alpha(color, 0.2) }} />
    </div>
  );

  const ExecHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-3.5 resume-section-header">
      <div className="flex-1 h-px bg-gray-200" />
      <p
        className="text-[13.5px] uppercase tracking-[0.18em] text-gray-400 shrink-0"
        style={{ color }}
      >
        {label}
      </p>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );

  const blocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    const customSummaryHeading = ((summary.heading as string) ?? "").trim();
    blocks.summary = (
      <div className="resume-export-block mb-6 text-center">
        {customSummaryHeading && <ExecHead label={customSummaryHeading} />}
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.8] max-w-[480px] mx-auto"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    blocks.experience = (
      <div className="mb-6">
        <ExecHead label={H("experience", "Professional Experience")} />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-[12px] font-bold text-gray-900">
                    {str(e.title)}
                  </span>
                  <span className="text-[10px] text-gray-500 ml-2">·</span>
                  <span className="text-[11px] text-gray-600 ml-2 italic">
                    {str(e.company)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0 ml-3">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Present"
                      : ""}
                </p>
              </div>
              {items<unknown>(e as SC, "bullets")
                .filter((b) => {
                  const p = bulletParts(b);
                  return p.text || p.label || p.link;
                })
                .map((b, j) => (
                  <div key={j} className="flex gap-2 mt-1.5">
                    <span
                      className="text-[10px] shrink-0 mt-0.5"
                      style={{ color }}
                    >
                      —
                    </span>
                    <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.6]">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (edu.length > 0) {
    blocks.education = (
      <div className="mb-6">
        <ExecHead label={H("education", "Education")} />
        <div className="space-y-3.5">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              <p className="text-[12px] font-bold text-gray-900">
                {str(e.school)}
              </p>
              <p className="text-[11px] italic text-gray-600">
                {str(e.degree)}
                {e.field ? `, ${str(e.field)}` : ""}
              </p>
              <p className="text-[10px] text-gray-400">
                {str(e.startDate)}
                {e.endDate ? ` – ${str(e.endDate)}` : ""}
                {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (skills.length > 0) {
    blocks.skills = (
      <div className="resume-export-block mb-6">
        <ExecHead label={H("skills", "Core Competencies")} />
        {renderSkills(skills, skillsStyle, color, false)}
      </div>
    );
  }
  if (certs.length > 0) {
    blocks.certifications = (
      <div className="resume-export-block mb-6">
        <ExecHead label={H("certifications", "Certifications")} />
        <div className="space-y-1">
          {certs.map((c, i) => (
            <div key={i}>
              <CertLine
                c={c}
                className="text-[11px] italic text-gray-600"
                color={color}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    blocks.projects = (
      <div className="mb-6">
        <ExecHead label={H("projects", "Notable Projects")} />
        <div className="space-y-2">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <span className="text-[12px] font-bold text-gray-900">
                {str(pr.name)}
              </span>
              {(str(pr.url) || str(pr.label)) && (
                <span className="ml-2">
                  <ProjectLink
                    url={pr.url}
                    label={pr.label}
                    color={color}
                    className="text-[10px] italic"
                  />
                </span>
              )}
              {(() => {
                const pbs = projectBullets(pr);
                if (pbs.length > 0) {
                  return (
                    <div className="mt-1.5 space-y-1">
                      {pbs.map((b, j) => (
                        <div key={j} className="flex gap-2">
                          <span
                            className="text-[10px] shrink-0 mt-0.5"
                            style={{ color }}
                          >
                            —
                          </span>
                          <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.6]">
                            <BulletContent b={b} color={color} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return str(pr.description) ? (
                  <span className="resume-text text-[11px] text-gray-600 ml-2">
                    —{" "}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: richHtml(pr.description),
                      }}
                    />
                  </span>
                ) : null;
              })()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10" style={{ fontFamily: font }}>
      {/* Header */}
      <div className="text-center mb-1">
        <h1
          className="text-[30px] tracking-[0.06em] text-gray-900"
          style={{ fontWeight: 400 }}
        >
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p
            className="text-[12px] font-semibold tracking-[0.15em] uppercase mt-1.5"
            style={{ color }}
          >
            {roleOf(p)}
          </p>
        )}
        <div className="flex justify-center flex-wrap gap-x-5 gap-y-1 mt-2">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[10px] text-gray-500 italic">
              {v}
            </span>
          ))}
        </div>
      </div>

      {rule}

      {orderedBlocks(sections, blocks)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   5. CREATIVE PRO — Bold sidebar, vivid color, cards
═══════════════════════════════════════════════════════════ */
export function CreativeProTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const H = (t: string, fb: string) => headingOf(get, t, fb);

  const MainHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3.5">
      <div className="h-3.5 w-[3px] rounded-full" style={{ background: color }} />
      <p
        className="text-[13.5px] font-black uppercase tracking-[0.15em] text-gray-800"
        style={{ color }}
      >
        {label}
      </p>
    </div>
  );

  const sidebarBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (skills.length > 0) {
    sidebarBlocks.skills = (
      <div
        className="resume-export-block px-5 py-4"
        style={{ background: alpha(color, 0.02) }}
      >
        <p
          className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2.5"
          style={{ color }}
        >
          {H("skills", "Skills")}
        </p>
        {renderSkills(skills, skillsStyle, color, false, "stacked")}
      </div>
    );
  }
  if (edu.length > 0) {
    sidebarBlocks.education = (
      <div className="resume-export-block px-5 py-4">
        <p
          className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2.5"
          style={{ color }}
        >
          {H("education", "Education")}
        </p>
        <div className="space-y-3.5">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              <p className="text-[12px] font-bold text-gray-900">
                {str(e.school)}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {str(e.degree)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {str(e.startDate)}
                {e.endDate ? ` – ${str(e.endDate)}` : ""}
                {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (certs.length > 0) {
    sidebarBlocks.certifications = (
      <div className="resume-export-block px-5 py-4">
        <p
          className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2.5"
          style={{ color }}
        >
          {H("certifications", "Certifications")}
        </p>
        <div className="space-y-1">
          {certs.map((c, i) => (
            <div key={i} className="resume-export-block">
              <CertLine
                c={c}
                className="text-[11px] text-gray-600 mb-1 last:mb-0"
                color={color}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    mainBlocks.summary = (
      <div
        className="resume-export-block mb-6 p-4 rounded-xl"
        style={{ background: alpha(color, 0.06) }}
      >
        <p
          className="text-[13.5px] font-bold uppercase tracking-[0.15em] mb-2"
          style={{ color }}
        >
          {H("summary", "About Me")}
        </p>
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    mainBlocks.experience = (
      <div className="mb-6">
        <MainHead label={H("experience", "Experience")} />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div
              key={i}
              className="resume-export-block rounded-xl p-3.5"
              style={{ border: `1px solid ${alpha(color, 0.15)}` }}
            >
              <div className="flex justify-between items-start gap-4 flex-wrap mb-1">
                <div>
                  <p className="text-[12px] font-black text-gray-900">
                    {str(e.title)}
                  </p>
                  <p
                    className="text-[11px] font-semibold mt-0.5"
                    style={{ color }}
                  >
                    {str(e.company)}
                  </p>
                </div>
                <span
                  className="text-[10px] text-white px-2.5 py-0.5 rounded-full shrink-0"
                  style={{ background: color }}
                >
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Now"
                      : ""}
                </span>
              </div>
              {items<unknown>(e as SC, "bullets")
                .filter((b) => {
                  const p = bulletParts(b);
                  return p.text || p.label || p.link;
                })
                .map((b, j) => (
                  <div key={j} className="flex gap-1.5 mt-1.5">
                    <span
                      className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.5]">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    mainBlocks.projects = (
      <div className="mb-6">
        <MainHead label={H("projects", "Projects")} />
        <div className="space-y-4">
          {projects.map((pr, i) => (
            <div
              key={i}
              className="resume-export-block rounded-xl p-3.5"
              style={{ border: `1px solid ${alpha(color, 0.15)}` }}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={
                  <span
                    className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                }
                rowClassName="flex gap-1.5"
                textClassName="text-[11px] text-gray-600 leading-[1.5]"
                descClassName="resume-text text-[11px] text-gray-500 mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex"
      data-resume-two-col-root
      style={{ fontFamily: font, minHeight: "100%" }}
    >
      <div
        className="w-[220px] shrink-0 flex flex-col"
        data-resume-sidebar
        style={{
          background: alpha(color, 0.08),
          minHeight: "100%",
          borderRight: `1px solid ${alpha(color, 0.15)}`,
        }}
      >
        {/* Avatar + name */}
        <div className="p-5 pb-4">
          <div className="mb-3.5">
            <Avatar p={p} bg={color} sizeClass="h-16 w-16 text-[22px]" />
          </div>
          <h1
            className="font-black text-gray-900 tracking-tight"
            style={{
              fontSize: getSidebarNameFontSize(str(p.name), 24),
              lineHeight: "1.2",
            }}
          >
            {str(p.name) || "Your Name"}
          </h1>
          {roleOf(p) && (
            <p
              className="text-[12px] font-bold mt-1.5 uppercase tracking-wide"
              style={{ color }}
            >
              {roleOf(p)}
            </p>
          )}
        </div>

        {/* Contact */}
        <div
          className="resume-export-block px-5 py-4"
          style={{ background: alpha(color, 0.04) }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2"
            style={{ color }}
          >
            Contact
          </p>
          {contactValues(p, color).map((v, i) => (
            <p
              key={i}
              className="text-[11px] text-gray-600 break-all leading-relaxed mb-0.5 last:mb-0"
            >
              {v}
            </p>
          ))}
        </div>

        {orderedBlocks(sections, sidebarBlocks, [
          "skills",
          "education",
          "certifications",
        ])}
      </div>

      {/* Main */}
      <div className="resume-template-columns-main flex-1 px-8 py-7">
        {orderedBlocks(sections, mainBlocks, [
          "summary",
          "experience",
          "projects",
        ])}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   6. VANGUARD ELITE — Editorial single-column premium, ATS-first
═══════════════════════════════════════════════════════════ */
/**
 * Premium look is carried entirely by typography and accent keylines: one
 * linear column, real text nodes, no tables/columns/text-in-graphics — so the
 * reading order a parser extracts is exactly the visual order. Every section
 * heading is a plain uppercase text node preceded by a decorative rule, which
 * keyword scanners ignore.
 */
export function VanguardTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const rule = alpha(color, 0.24);
  const H = (t: string, fb: string) => headingOf(get, t, fb);

  const SH = ({ label }: { label: string }) => (
    <div className="resume-section-header flex items-center gap-2.5 mb-2.5">
      <span
        aria-hidden
        className="h-[11px] w-[3px] shrink-0"
        style={{ background: color }}
      />
      <p
        className="text-[12px] font-bold uppercase tracking-[0.16em] shrink-0"
        style={{ color }}
      >
        {label}
      </p>
      <span aria-hidden className="flex-1 h-px" style={{ background: rule }} />
    </div>
  );

  const marker = (
    <span
      aria-hidden
      className="mt-[6px] h-[3px] w-[3px] rounded-full shrink-0"
      style={{ background: color }}
    />
  );
  const dateRange = (start: unknown, end: unknown) =>
    `${str(start)}${end ? ` – ${str(end)}` : start ? " – Present" : ""}`;

  /**
   * List section. The heading lives *inside* the first entry's keep-block rather
   * than beside it: ResumePagedView moves a whole keep-block to the next page
   * when it crosses a page boundary, so grouping them means a break can never
   * strand a heading alone at the foot of a page.
   */
  const listSection = <T,>(
    label: string,
    list: T[],
    spacing: string,
    renderEntry: (item: T) => React.ReactNode,
  ) => (
    <div className="mb-6">
      <div className={spacing}>
        {list.map((item, i) => (
          <div key={i} className="resume-export-block">
            {i === 0 ? <SH label={label} /> : null}
            {renderEntry(item)}
          </div>
        ))}
      </div>
    </div>
  );

  const blocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    blocks.summary = (
      <div className="resume-export-block mb-6">
        <SH label={H("summary", "Executive Summary")} />
        <div
          className="resume-text text-[11px] text-gray-700 leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    blocks.experience = listSection(
      H("experience", "Professional Experience"),
      exp,
      "space-y-3.5",
      (e) => (
        <>
          <div className="flex justify-between items-baseline gap-3">
            <p className="text-[12px] font-bold text-gray-900 min-w-0">
              {str(e.title)}
            </p>
            <p className="text-[10px] font-medium text-gray-600 shrink-0 tracking-wide">
              {dateRange(e.startDate, e.endDate)}
            </p>
          </div>
          {str(e.company) || str(e.location) ? (
            <p className="text-[11px] font-semibold mt-0.5" style={{ color }}>
              {str(e.company)}
              {str(e.location) ? (
                <span className="font-normal text-gray-600">
                  {`${str(e.company) ? " · " : ""}${str(e.location)}`}
                </span>
              ) : null}
            </p>
          ) : null}
          {items<unknown>(e as SC, "bullets")
            .filter((b) => {
              const bp = bulletParts(b);
              return bp.text || bp.label || bp.link;
            })
            .map((b, j) => (
              <div key={j} className="flex gap-2 mt-1">
                {marker}
                <div className="flex-1 min-w-0 text-[11px] text-gray-700 leading-[1.55]">
                  <BulletContent b={b} color={color} />
                </div>
              </div>
            ))}
        </>
      ),
    );
  }
  if (edu.length > 0) {
    blocks.education = listSection(
      H("education", "Education"),
      edu,
      "space-y-3",
      (e) => (
        <>
          <div className="flex justify-between items-baseline gap-3">
            <p className="text-[12px] font-bold text-gray-900 min-w-0">
              {str(e.school)}
            </p>
            <p className="text-[10px] font-medium text-gray-600 shrink-0 tracking-wide">
              {dateRange(e.startDate, e.endDate)}
            </p>
          </div>
          {str(e.degree) || str(e.field) || str(e.gpa) ? (
            <p className="text-[11px] text-gray-700 mt-0.5">
              {str(e.degree)}
              {str(e.field)
                ? `${str(e.degree) ? ", " : ""}${str(e.field)}`
                : ""}
              {str(e.gpa)
                ? `${str(e.degree) || str(e.field) ? " · " : ""}${renderGpa(e.gpa, e.gpaMode)}`
                : ""}
            </p>
          ) : null}
        </>
      ),
    );
  }
  if (skills.length > 0) {
    blocks.skills = (
      <div className="resume-export-block mb-6">
        <SH label={H("skills", "Core Competencies")} />
        {renderSkills(skills, skillsStyle, color, false)}
      </div>
    );
  }
  if (projects.length > 0) {
    blocks.projects = listSection(
      H("projects", "Selected Projects"),
      projects,
      "space-y-3",
      (pr) => (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-bold text-gray-900 min-w-0">
              {str(pr.name)}
            </p>
            <ProjectLink
              url={pr.url}
              label={pr.label}
              color={color}
              className="text-[10px] shrink-0"
            />
          </div>
          <ProjectDetail
            pr={pr}
            color={color}
            marker={marker}
            rowClassName="flex gap-2"
            textClassName="text-[11px] text-gray-700 leading-[1.55]"
            containerClassName="mt-1 space-y-1"
            descClassName="resume-text text-[11px] text-gray-700 leading-[1.55] mt-1"
          />
        </>
      ),
    );
  }
  if (certs.length > 0) {
    blocks.certifications = listSection(
      H("certifications", "Certifications"),
      certs,
      "space-y-1.5",
      (c) => (
        <div className="flex gap-2">
          {marker}
          <CertLine
            c={c}
            className="flex-1 min-w-0 text-[11px] text-gray-700 leading-[1.55]"
            color={color}
          />
        </div>
      ),
    );
  }

  return (
    <div className="px-9 py-8" style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <span
              aria-hidden
              className="block h-[3px] w-10 mb-2.5"
              style={{ background: color }}
            />
            <h1 className="text-[30px] font-black text-gray-950 tracking-tight leading-[1.05]">
              {str(p.name) || "Your Name"}
            </h1>
            {roleOf(p) && (
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em] mt-1.5"
                style={{ color }}
              >
                {roleOf(p)}
              </p>
            )}
          </div>
          <Avatar
            p={p}
            bg={color}
            textColor="#ffffff"
            sizeClass="h-14 w-14 text-lg"
          />
        </div>
        <p
          className="text-[10px] text-gray-600 leading-[1.7] mt-3.5 pt-3"
          style={{ borderTop: `1px solid ${rule}` }}
        >
          {contactValues(p, color).map((v, i) => (
            <span key={i}>
              {i > 0 ? (
                <span aria-hidden className="mx-1.5 text-gray-400">
                  ·
                </span>
              ) : null}
              {v}
            </span>
          ))}
        </p>
      </div>

      {orderedBlocks(sections, blocks)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   7. ATS CLEAN — Pure text, maximum compatibility
═══════════════════════════════════════════════════════════ */
export function AtsCleanTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));

  const SH = ({ label }: { label: string }) => (
    <div className="mt-4.5 resume-section-header">
      <p
        className="text-[12px] font-black uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </p>
      <div className="h-px mt-0.5 mb-2" style={{ background: color }} />
    </div>
  );

  const H = (t: string, fb: string) => headingOf(get, t, fb);
  const blocks: Partial<Record<string, React.ReactNode>> = {};

  if (str(summary.text)) {
    blocks.summary = (
      <div className="resume-export-block">
        <SH label={H("summary", "Professional Summary")} />
        <div
          className="resume-text text-[11px] text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    blocks.experience = (
      <div>
        <SH label={H("experience", "Work Experience")} />
        <div className="space-y-3.5">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline mb-0.5">
                {/* "Title · Company, Location". The middot is a real character
                    in the text node (not a border or pseudo-element), so it
                    survives PDF text extraction and copy-paste and still gives
                    parsers a delimiter between title and company. The typography
                    carries the hierarchy: bold full-strength title vs. smaller
                    muted italics for company/location.
                    The character before the middot is a literal non-breaking
                    space (U+00A0), not a plain space — keep it. When a long
                    title wraps it holds the middot on the title's line instead
                    of orphaning it to the start of the next one. */}
                <p className="text-[12px] font-bold text-gray-900 min-w-0">
                  {str(e.title)}
                  {e.company || e.location ? (
                    <span className="text-[10.5px] font-normal italic text-gray-600">
                      {str(e.title) ? " · " : ""}
                      {str(e.company)}
                      {e.location
                        ? `${str(e.company) ? ", " : ""}${str(e.location)}`
                        : ""}
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-gray-700 shrink-0 ml-2">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Present"
                      : ""}
                </p>
              </div>
              {items<unknown>(e as SC, "bullets")
                .filter((b) => {
                  const p = bulletParts(b);
                  return p.text || p.label || p.link;
                })
                .map((b, j) => (
                  <div
                    key={j}
                    className="flex gap-1.5 text-[11px] text-gray-700 leading-relaxed ml-3"
                  >
                    <span className="shrink-0 font-bold">•</span>
                    <div className="flex-1 min-w-0">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (edu.length > 0) {
    blocks.education = (
      <div>
        <SH label={H("education", "Education")} />
        <div className="space-y-2">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline">
                <p className="text-[11.5px] font-bold text-gray-900">
                  {str(e.school)} — {str(e.degree)}
                  {e.field ? `, ${str(e.field)}` : ""}
                  {e.gpa ? ` (${renderGpa(e.gpa, e.gpaMode)})` : ""}
                </p>
                <p className="text-[10px] text-gray-700 shrink-0 ml-2">
                  {str(e.startDate)}
                  {e.endDate ? ` – ${str(e.endDate)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (skills.length > 0) {
    blocks.skills = (
      <div className="resume-export-block">
        <SH label={H("skills", "Skills")} />
        {(() => {
          const style = skillsStyleOf(sections);
          return style && style !== "text" ? (
            renderSkills(skills, style, color, false)
          ) : (
            <p className="text-[11px] text-gray-700">
              {skills
                .map((s) => str(s.name))
                .filter(Boolean)
                .join(" | ")}
            </p>
          );
        })()}
      </div>
    );
  }
  if (projects.length > 0) {
    blocks.projects = (
      <div>
        <SH label={H("projects", "Projects")} />
        <div className="space-y-2.5">
          {projects.map((pr, i) => (
            <div
              key={i}
              className="resume-export-block text-[11px] text-gray-700"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={<span className="shrink-0 font-bold">•</span>}
                rowClassName="flex gap-1.5 ml-3"
                textClassName="text-[11px] text-gray-700 leading-relaxed"
                containerClassName="mt-0.5 space-y-0.5"
                descClassName="resume-text text-[11px] text-gray-700 mt-0.5 [&_p]:m-0"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (certs.length > 0) {
    blocks.certifications = (
      <div>
        <SH label={H("certifications", "Certifications")} />
        <div className="space-y-1.5">
          {certs.map((c, i) => (
            <div key={i} className="resume-export-block">
              <CertLine
                c={c}
                className="text-[11px] text-gray-700"
                color={color}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-7" style={{ fontFamily: font }}>
      <div className="text-center mb-3">
        <h1 className="text-[28px] font-black text-gray-950 leading-tight">
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p
            className="text-[12.5px] font-bold tracking-wider uppercase mt-0.5"
            style={{ color }}
          >
            {roleOf(p)}
          </p>
        )}
        <p className="text-[10px] text-gray-600 mt-1">
          {contactValues(p, color).map((v, i) => (
            <span key={i}>
              {i > 0 && "  |  "}
              {v}
            </span>
          ))}
        </p>
      </div>
      {orderedBlocks(sections, blocks)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   8. ACADEMIC CV — Traditional scholarly format
═══════════════════════════════════════════════════════════ */
export function AcademicTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));

  const H = (t: string, fb: string) => headingOf(get, t, fb);
  const SH = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mt-6 mb-3 resume-section-header">
      <h2
        className="text-[13.5px] font-bold uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {label}
      </h2>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );

  /* Bullet marker. A sized dot, not a "•" text glyph: Merriweather draws U+2022
     at a very small optical size, so at 11px in muted gray it reads as a speck
     and effectively vanishes once auto-fit compresses the page or the PDF is
     rasterised. An element is crisp at any scale and prints exactly (the export
     HTML sets print-color-adjust). `mt-[6px]` optically centers it on the first
     line of an 11px/1.55 bullet — the same marker the other templates use. */
  const marker = (
    <span
      aria-hidden
      className="mt-[6px] h-1 w-1 rounded-full shrink-0"
      style={{ background: color }}
    />
  );

  const blocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    blocks.summary = (
      <div className="resume-export-block">
        <SH label={H("summary", "Research Interests / Summary")} />
        <div
          className="resume-text text-[11px] text-gray-700 leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (edu.length > 0) {
    blocks.education = (
      <div>
        <SH label={H("education", "Education")} />
        <div className="space-y-3">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline">
                <div>
                  <p className="text-[12px] font-bold text-gray-900">
                    {str(e.degree)}
                    {e.field ? ` in ${str(e.field)}` : ""}
                  </p>
                  <p className="text-[11px] italic text-gray-600 mt-0.5">
                    {str(e.school)}
                  </p>
                  {e.gpa ? (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {renderGpa(e.gpa, e.gpaMode)}
                    </p>
                  ) : null}
                </div>
                <p className="text-[10px] text-gray-500 shrink-0 ml-3">
                  {str(e.startDate)}
                  {e.endDate ? ` – ${str(e.endDate)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (exp.length > 0) {
    blocks.experience = (
      <div>
        <SH label={H("experience", "Academic & Professional Experience")} />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline gap-3 mb-0.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-gray-900">
                    {str(e.title)}
                  </p>
                  <p className="text-[11px] italic text-gray-600 mt-0.5">
                    {str(e.company)}
                    {e.location ? `, ${str(e.location)}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-gray-500 shrink-0">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Present"
                      : ""}
                </p>
              </div>
              {(() => {
                const bl = items<unknown>(e as SC, "bullets").filter((b) => {
                  const bp = bulletParts(b);
                  return bp.text || bp.label || bp.link;
                });
                if (bl.length === 0) return null;
                return (
                  <div className="ml-3 mt-1.5 space-y-1">
                    {bl.map((b, j) => (
                      <div key={j} className="flex gap-2 text-[11px]">
                        {marker}
                        <div className="flex-1 min-w-0 text-gray-700 leading-[1.55]">
                          <BulletContent b={b} color={color} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    blocks.projects = (
      <div>
        <SH label={H("projects", "Publications & Research Projects")} />
        <div className="space-y-3.5">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <p className="text-[12px] font-bold text-gray-900">
                {str(pr.name)}
                <span className="ml-2 font-normal not-italic">
                  <ProjectLink
                    url={pr.url}
                    label={pr.label}
                    color={color}
                    className="text-[10px]"
                  />
                </span>
              </p>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={marker}
                rowClassName="flex gap-2 text-[11px]"
                textClassName="text-gray-700 leading-[1.55]"
                containerClassName="ml-3 mt-1.5 space-y-1"
                descClassName="resume-text text-[11px] text-gray-600 leading-[1.55] mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (skills.length > 0) {
    blocks.skills = (
      <div className="resume-export-block">
        <SH label={H("skills", "Skills & Methods")} />
        {(() => {
          const style = skillsStyleOf(sections);
          return style && style !== "text" ? (
            renderSkills(skills, style, color, false)
          ) : (
            <p className="text-[11px] text-gray-700 leading-[1.7]">
              {skills
                .map((s) => str(s.name))
                .filter(Boolean)
                .join(", ")}
            </p>
          );
        })()}
      </div>
    );
  }
  if (certs.length > 0) {
    blocks.certifications = (
      <div className="resume-export-block">
        <SH label={H("certifications", "Certifications")} />
        <div className="space-y-1.5 mt-3.5">
          {certs.map((c, i) => (
            <CertLine
              key={i}
              c={c}
              className="text-[11px] text-gray-700"
              color={color}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 py-8" style={{ fontFamily: font }}>
      <div
        className="text-center mb-4 pb-3.5"
        style={{ borderBottom: `2px solid ${color}` }}
      >
        <h1 className="text-[30px] font-bold text-gray-900 tracking-wide">
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p className="text-[12px] text-gray-600 italic mt-1">{roleOf(p)}</p>
        )}
        <div className="flex justify-center gap-4 mt-2.5 flex-wrap">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[10px] text-gray-500">
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="[&>*:first-child_.resume-section-header]:mt-0">
        {orderedBlocks(sections, blocks)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   9. CORPORATE NAVY — Navy authority, grid layout
═══════════════════════════════════════════════════════════ */
export function CorporateNavyTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const navy = color;
  const headerContactLinkColor = readableAccentOnBackground(navy, color);
  const H = (t: string, fb: string) => headingOf(get, t, fb);

  const NavyHead = ({
    label,
    className = "mb-3.5",
  }: {
    label: string;
    className?: string;
  }) => (
    <p
      className={`text-[13.5px] font-bold uppercase tracking-[0.16em] ${className}`}
      style={{ color: navy }}
    >
      {label}
    </p>
  );

  const blocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    blocks.summary = (
      <div
        className="resume-export-block mb-6 pb-5"
        style={{ borderBottom: `1px solid ${alpha(navy, 0.12)}` }}
      >
        <NavyHead label={H("summary", "Professional Summary")} className="mb-2" />
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    blocks.experience = (
      <div className="mb-6">
        <NavyHead label={H("experience", "Work Experience")} />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div
              key={i}
              className="resume-export-block pl-3"
              style={{ borderLeft: `3px solid ${alpha(navy, 0.2)}` }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[12.5px] font-bold text-gray-900">
                    {str(e.title)}
                  </p>
                  <p
                    className="text-[11.5px] font-semibold"
                    style={{ color: navy }}
                  >
                    {str(e.company)}
                    {e.location ? ` — ${str(e.location)}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0 ml-3 mt-0.5 font-medium">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Present"
                      : ""}
                </p>
              </div>
              {items<unknown>(e as SC, "bullets")
                .filter((b) => {
                  const p = bulletParts(b);
                  return p.text || p.label || p.link;
                })
                .map((b, j) => (
                  <div key={j} className="flex gap-1.5 mt-1.5">
                    <span
                      className="text-[9px] shrink-0 mt-0.5 font-bold"
                      style={{ color: navy }}
                    >
                      ›
                    </span>
                    <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.55]">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (edu.length > 0) {
    blocks.education = (
      <div className="mb-6">
        <NavyHead label={H("education", "Education")} />
        <div className="space-y-2.5">
          {edu.map((e, i) => (
            <div
              key={i}
              className="resume-export-block p-2 rounded"
              style={{ background: alpha(navy, 0.04) }}
            >
              <p className="text-[12px] font-bold text-gray-900">
                {str(e.school)}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {str(e.degree)}
                {e.field ? `, ${str(e.field)}` : ""}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {str(e.startDate)}
                {e.endDate ? ` – ${str(e.endDate)}` : ""}
                {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (skills.length > 0) {
    blocks.skills = (
      <div className="resume-export-block mb-6">
        <NavyHead label={H("skills", "Core Skills")} />
        {renderSkills(skills, skillsStyle, navy, false)}
      </div>
    );
  }
  if (projects.length > 0) {
    blocks.projects = (
      <div className="mb-6">
        <NavyHead label={H("projects", "Key Projects")} />
        <div className="space-y-2">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={
                  <span
                    className="text-[9px] shrink-0 mt-0.5 font-bold"
                    style={{ color: navy }}
                  >
                    ›
                  </span>
                }
                rowClassName="flex gap-1.5"
                textClassName="text-[11px] text-gray-600 leading-[1.55]"
                descClassName="resume-text text-[11px] text-gray-500 mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (certs.length > 0) {
    blocks.certifications = (
      <div className="mb-6">
        <NavyHead label={H("certifications", "Certifications")} />
        <div className="space-y-1">
          {certs.map((c, i) => (
            <div key={i} className="resume-export-block">
              <CertLine
                c={c}
                className="text-[11px] text-gray-600"
                color={navy}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Header */}
      <div className="px-8 py-7" style={{ background: navy }}>
        <h1 className="text-[30px] font-black text-white tracking-tight">
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p className="text-[12px] font-semibold text-white/70 mt-1 tracking-wide">
            {roleOf(p)}
          </p>
        )}
        <div className="flex gap-5 mt-3.5 flex-wrap">
          {contactValues(p, headerContactLinkColor).map((v, i) => (
            <span key={i} className="text-[10px] text-white/60">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Accent bar */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(to right, ${navy}, ${alpha(navy, 0.3)})`,
        }}
      />

      <div className="px-8 py-6">{orderedBlocks(sections, blocks)}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   10. COMPACT — Dense, one-page optimized
═══════════════════════════════════════════════════════════ */
export function CompactTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));

  const H = (t: string, fb: string) => headingOf(get, t, fb);
  const CompactHead = ({ label }: { label: string }) => (
    <p
      className="text-[12.5px] font-bold uppercase tracking-[0.14em] mb-2"
      style={{ color }}
    >
      {label}
    </p>
  );

  /* Bullet marker. A sized dot, not a "·" text glyph: Merriweather draws U+00B7
     tiny, so at 11px in muted gray it reads as a speck and effectively vanishes
     once auto-fit compresses the page or the PDF is rasterised. An element is
     crisp at any scale and prints exactly (the export HTML sets
     print-color-adjust). Kept to 3px — this template is the dense one, so the
     marker stays subordinate to the copy. */
  const marker = (
    <span
      aria-hidden
      className="mt-[6px] h-[3px] w-[3px] rounded-full shrink-0"
      style={{ background: color }}
    />
  );

  const blocks: Partial<Record<string, React.ReactNode>> = {};

  if (str(summary.text)) {
    const customSummaryHeading = ((summary.heading as string) ?? "").trim();
    blocks.summary = (
      <div className="resume-export-block">
        {customSummaryHeading && <CompactHead label={customSummaryHeading} />}
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.6]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }

  if (skills.length > 0) {
    const style = skillsStyleOf(sections);
    if (style && style !== "text") {
      blocks.skills = (
        <div className="resume-export-block">
          <p
            className="text-[12.5px] font-bold uppercase tracking-wide mb-2"
            style={{ color }}
          >
            {H("skills", "Skills")}
          </p>
          {renderSkills(skills, style, color, false)}
        </div>
      );
    } else {
      blocks.skills = (
        <div className="resume-export-block">
          <span
            className="text-[12.5px] font-bold uppercase tracking-wide mr-2"
            style={{ color }}
          >
            {H("skills", "Skills")}:
          </span>
          <span className="text-[11px] text-gray-700">
            {skills
              .map((s) => str(s.name))
              .filter(Boolean)
              .join("  ·  ")}
          </span>
        </div>
      );
    }
  }

  if (exp.length > 0) {
    blocks.experience = (
      <div>
        <CompactHead label={H("experience", "Experience")} />
        <div className="space-y-3.5">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline gap-2">
                <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <p className="text-[12px] font-bold text-gray-900">
                    {str(e.title)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    @ {str(e.company)}
                    {e.location ? `, ${str(e.location)}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Now"
                      : ""}
                </p>
              </div>
              {(() => {
                const bl = items<unknown>(e as SC, "bullets").filter((b) => {
                  const bp = bulletParts(b);
                  return bp.text || bp.label || bp.link;
                });
                if (bl.length === 0) return null;
                return (
                  <div className="ml-1.5 mt-1 space-y-0.5">
                    {bl.map((b, j) => (
                      <div key={j} className="flex gap-1.5 text-[11px]">
                        {marker}
                        <div className="flex-1 min-w-0 text-gray-600 leading-[1.5]">
                          <BulletContent b={b} color={color} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length > 0) {
    blocks.projects = (
      <div>
        <CompactHead label={H("projects", "Projects")} />
        <div className="space-y-2">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={marker}
                rowClassName="flex gap-1.5 text-[11px]"
                textClassName="text-gray-600 leading-[1.5]"
                containerClassName="ml-1.5 mt-1 space-y-0.5"
                descClassName="resume-text text-[11px] text-gray-500 leading-[1.5] mt-0.5"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (edu.length > 0) {
    blocks.education = (
      <div>
        <CompactHead label={H("education", "Education")} />
        <div className="space-y-2">
          {edu.map((e, i) => (
            <div
              key={i}
              className="resume-export-block flex justify-between items-baseline"
            >
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.school)}
                </p>
                <p className="text-[11px] text-gray-500">
                  — {str(e.degree)}
                  {e.field ? `, ${str(e.field)}` : ""}
                  {e.gpa ? ` (${renderGpa(e.gpa, e.gpaMode)})` : ""}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 shrink-0 ml-2">
                {str(e.startDate)}
                {e.endDate ? ` – ${str(e.endDate)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (certs.length > 0) {
    blocks.certifications = (
      <div>
        <CompactHead label={H("certifications", "Certifications")} />
        <div className="space-y-1">
          {certs.map((c, i) => (
            <div key={i} className="resume-export-block mb-1 last:mb-0">
              <CertLine
                c={c}
                className="text-[11px] text-gray-600"
                color={color}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderedSections = orderedBlocks(sections, blocks);

  return (
    <div className="px-7 py-5" style={{ fontFamily: font }}>
      <div
        className="text-center mb-3.5 pb-3.5"
        style={{ borderBottom: `2px solid ${color}` }}
      >
        <h1 className="text-[26px] font-black text-gray-950 leading-none">
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p className="text-[11.5px] font-semibold mt-1.5" style={{ color }}>
            {roleOf(p)}
          </p>
        )}
        <div className="text-[10px] text-gray-500 mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1 leading-normal">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">|</span>}
              <span>{v}</span>
            </span>
          ))}
        </div>
      </div>

      {renderedSections.map((sec, idx) => (
        <div
          key={idx}
          className={idx < renderedSections.length - 1 ? "mb-3 pb-3" : ""}
          style={
            idx < renderedSections.length - 1
              ? { borderBottom: `1px solid ${alpha(color, 0.15)}` }
              : undefined
          }
        >
          {sec}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   11. EUROPEAN — Photo placeholder, EU format, two-column
═══════════════════════════════════════════════════════════ */
export function EuropeanTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const photo = (p.photo as string) ?? "";

  const H = (t: string, fb: string) => headingOf(get, t, fb);
  const SH = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3 mt-4 resume-section-header">
      <div className="h-3 w-[3px] rounded-full" style={{ background: color }} />
      <p
        className="text-[13.5px] font-bold uppercase tracking-[0.14em]"
        style={{ color }}
      >
        {label}
      </p>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );

  const sidebarBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (skills.length > 0) {
    sidebarBlocks.skills = (
      <div className="resume-export-block mb-4">
        <SH label={H("skills", "Skills")} />
        {renderSkills(skills, skillsStyle, color, false, "stacked")}
      </div>
    );
  }
  if (edu.length > 0) {
    sidebarBlocks.education = (
      <div className="mb-4">
        <div className="resume-export-block">
          <SH label={H("education", "Education")} />
          <div>
            <p className="text-[12px] font-semibold text-gray-800">
              {str(edu[0].school)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {str(edu[0].degree)}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {str(edu[0].startDate)}
              {edu[0].endDate ? ` – ${str(edu[0].endDate)}` : ""}
              {edu[0].gpa ? ` · ${renderGpa(edu[0].gpa, edu[0].gpaMode)}` : ""}
            </p>
          </div>
        </div>
        {edu.length > 1 && (
          <div className="space-y-3.5 mt-3.5">
            {edu.slice(1).map((e, i) => (
              <div key={i} className="resume-export-block">
                <p className="text-[12px] font-semibold text-gray-800">
                  {str(e.school)}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {str(e.degree)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {str(e.startDate)}
                  {e.endDate ? ` – ${str(e.endDate)}` : ""}
                  {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (certs.length > 0) {
    sidebarBlocks.certifications = (
      <div className="mb-4">
        <div className="resume-export-block">
          <SH label={H("certifications", "Certifications")} />
          <div>
            <CertLine
              c={certs[0]}
              className="text-[11px] text-gray-600"
              color={color}
            />
          </div>
        </div>
        {certs.length > 1 && (
          <div className="space-y-1 mt-1">
            {certs.slice(1).map((c, i) => (
              <div key={i} className="resume-export-block">
                <CertLine
                  c={c}
                  className="text-[11px] text-gray-600"
                  color={color}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const mainBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    mainBlocks.summary = (
      <div className="resume-export-block mb-6">
        <SH label={H("summary", "Profile")} />
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    mainBlocks.experience = (
      <div className="mb-6">
        <SH label={H("experience", "Work Experience")} />
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline mb-0.5">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.title)}
                </p>
                <p className="text-[10px] text-gray-400 shrink-0 ml-2">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Present"
                      : ""}
                </p>
              </div>
              <p className="text-[11.5px] font-semibold" style={{ color }}>
                {str(e.company)}
                {e.location ? `, ${str(e.location)}` : ""}
              </p>
              {items<unknown>(e as SC, "bullets")
                .filter((b) => {
                  const p = bulletParts(b);
                  return p.text || p.label || p.link;
                })
                .map((b, j) => (
                  <div key={j} className="flex gap-1.5 mt-1.5">
                    <span
                      className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.5]">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    mainBlocks.projects = (
      <div className="mb-6">
        <SH label={H("projects", "Projects")} />
        <div className="space-y-3.5">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={
                  <span
                    className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                }
                rowClassName="flex gap-1.5"
                textClassName="text-[11px] text-gray-600 leading-[1.5]"
                descClassName="resume-text text-[11px] text-gray-600 mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ fontFamily: font, minHeight: "100%" }}
    >
      {/* Header with photo */}
      <div
        className="px-8 py-6 flex gap-5 items-center"
        style={{
          background: blendWithWhite(color, 0.06),
          borderBottom: `2px solid ${color}`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Photo (or initials placeholder) */}
        <div
          className="h-[84px] w-[70px] shrink-0 rounded overflow-hidden flex items-center justify-center text-[22px] font-black"
          style={{
            background: alpha(color, 0.2),
            border: `2px solid ${alpha(color, 0.3)}`,
          }}
        >
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span style={{ color }}>
              {initialsFor((p.name as string) ?? "")}
            </span>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-[30px] font-bold text-gray-900 leading-tight">
            {str(p.name) || "Your Name"}
          </h1>
          {roleOf(p) && (
            <p className="text-[12px] font-semibold mt-1" style={{ color }}>
              {roleOf(p)}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {contactValues(p, color).map((v, i) => (
            <p key={i} className="text-[10px] text-gray-500 leading-normal">
              {v}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-row" data-resume-two-col-root>
        {/* Left */}
        <div
          className="w-[230px] shrink-0 px-5 py-5 [&>*:first-child_.resume-section-header]:mt-0"
          data-resume-sidebar
          style={{
            background: alpha(color, 0.03),
            borderRight: `1px solid ${alpha(color, 0.1)}`,
          }}
        >
          {orderedBlocks(sections, sidebarBlocks, [
            "skills",
            "education",
            "certifications",
          ])}
        </div>

        {/* Right */}
        <div className="flex-1 min-w-0 px-7 py-5 [&>*:first-child_.resume-section-header]:mt-0">
          {orderedBlocks(sections, mainBlocks, [
            "summary",
            "experience",
            "projects",
          ])}
        </div>
      </div>
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════
   12. TWO COLUMN PREMIUM — 35/65 elegant split
═══════════════════════════════════════════════════════════ */
export function TwoColumnTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const sidebarBg = alpha(color, 0.05);
  const H = (t: string, fb: string) => headingOf(get, t, fb);
  const sideDivider = { borderBottom: `1px solid rgba(0,0,0,0.06)` };

  const MainHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3.5 resume-section-header">
      <div className="h-0.5 w-5 rounded" style={{ background: color }} />
      <p
        className="text-[13.5px] font-bold uppercase tracking-[0.14em]"
        style={{ color }}
      >
        {label}
      </p>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );

  const sidebarBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (skills.length > 0) {
    sidebarBlocks.skills = (
      <div className="resume-export-block px-6 py-4.5" style={sideDivider}>
        <p
          className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3"
          style={{ color }}
        >
          {H("skills", "Skills")}
        </p>
        {renderSkills(skills, skillsStyle, color, false, "stacked")}
      </div>
    );
  }
  if (edu.length > 0) {
    sidebarBlocks.education = (
      <div className="px-6 py-4.5" style={sideDivider}>
        <div className="resume-export-block">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3"
            style={{ color }}
          >
            {H("education", "Education")}
          </p>
          <div>
            <p className="text-[12px] font-bold text-gray-900">
              {str(edu[0].school)}
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {str(edu[0].degree)}
              {edu[0].field ? `, ${str(edu[0].field)}` : ""}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {str(edu[0].startDate)}
              {edu[0].endDate ? ` – ${str(edu[0].endDate)}` : ""}
              {edu[0].gpa ? ` · ${renderGpa(edu[0].gpa, edu[0].gpaMode)}` : ""}
            </p>
          </div>
        </div>
        {edu.length > 1 && (
          <div className="space-y-3 mt-3">
            {edu.slice(1).map((e, i) => (
              <div key={i} className="resume-export-block">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.school)}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  {str(e.degree)}
                  {e.field ? `, ${str(e.field)}` : ""}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {str(e.startDate)}
                  {e.endDate ? ` – ${str(e.endDate)}` : ""}
                  {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (certs.length > 0) {
    sidebarBlocks.certifications = (
      <div className="px-6 py-4.5" style={sideDivider}>
        <div className="resume-export-block">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3.5"
            style={{ color }}
          >
            {H("certifications", "Certifications")}
          </p>
          <div>
            <CertLine
              c={certs[0]}
              className="text-[11px] text-gray-600"
              color={color}
            />
          </div>
        </div>
        {certs.length > 1 && (
          <div className="space-y-1 mt-1">
            {certs.slice(1).map((c, i) => (
              <div key={i} className="resume-export-block">
                <CertLine
                  c={c}
                  className="text-[11px] text-gray-600"
                  color={color}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const mainBlocks: Partial<Record<string, React.ReactNode>> = {};
  if (str(summary.text)) {
    mainBlocks.summary = (
      <div className="resume-export-block mb-6">
        <MainHead label={H("summary", "Profile")} />
        <div
          className="resume-text text-[11px] text-gray-600 leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
        />
      </div>
    );
  }
  if (exp.length > 0) {
    mainBlocks.experience = (
      <div className="mb-6">
        <MainHead label={H("experience", "Experience")} />
        <div className="relative border-l-2 border-transparent">
          <div
            className="absolute w-[2px]"
            style={{
              top: "8px",
              bottom: "-4px",
              left: "-1px",
              transform: "translateX(-50%)",
              background: alpha(color, 0.2),
              zIndex: 0,
            }}
          />
          <div className="space-y-5">
            {exp.map((e, i) => (
              <div key={i} className="resume-export-block relative pl-4">
                <div
                  className="absolute top-[6px] h-2 w-2 rounded-full"
                  style={{
                    left: "-1px",
                    transform: "translateX(-50%)",
                    background: color,
                  }}
                />
                <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
                  <div>
                    <p className="text-[12.5px] font-bold text-gray-900">
                      {str(e.title)}
                    </p>
                    <p
                      className="text-[11.5px] font-semibold mt-0.5"
                      style={{ color }}
                    >
                      {str(e.company)}
                      {e.location ? ` · ${str(e.location)}` : ""}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400 shrink-0 ml-3 mt-0.5 bg-gray-50 px-1.5 py-0.5 rounded">
                    {str(e.startDate)}
                    {e.endDate
                      ? ` – ${str(e.endDate)}`
                      : e.startDate
                        ? " – Present"
                        : ""}
                  </p>
                </div>
                {items<unknown>(e as SC, "bullets")
                  .filter((b) => {
                    const p = bulletParts(b);
                    return p.text || p.label || p.link;
                  })
                  .map((b, j) => (
                    <div key={j} className="flex gap-1.5 mt-1.5">
                      <span
                        className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0 text-[11px] text-gray-600 leading-[1.55]">
                        <BulletContent b={b} color={color} />
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (projects.length > 0) {
    mainBlocks.projects = (
      <div className="mb-6">
        <MainHead label={H("projects", "Projects")} />
        <div className="space-y-3">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[12.5px] font-bold text-gray-900">
                  {str(pr.name)}
                </p>
                <ProjectLink
                  url={pr.url}
                  label={pr.label}
                  color={color}
                  className="text-[10.5px]"
                />
              </div>
              <ProjectDetail
                pr={pr}
                color={color}
                marker={
                  <span
                    className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                }
                rowClassName="flex gap-1.5"
                textClassName="text-[11px] text-gray-600 leading-[1.55]"
                descClassName="resume-text text-[11px] text-gray-500 mt-1"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex"
      data-resume-two-col-root
      style={{ fontFamily: font, minHeight: "100%" }}
    >
      {/* Left 35% sidebar */}
      <div
        className="w-[280px] shrink-0 flex flex-col"
        data-resume-sidebar
        style={{ background: sidebarBg, minHeight: "100%" }}
      >
        {/* Avatar + name */}
        <div className="px-6 pt-7 pb-5" style={sideDivider}>
          <div className="mb-3.5">
            <Avatar p={p} bg={color} sizeClass="h-16 w-16 text-[22px]" />
          </div>
          <h1
            className="font-bold text-gray-900"
            style={{
              fontSize: getSidebarNameFontSize(str(p.name), 24),
              lineHeight: "1.2",
            }}
          >
            {str(p.name) || "Your Name"}
          </h1>
          {roleOf(p) && (
            <p
              className="text-[12px] mt-1.5 font-medium tracking-wide uppercase"
              style={{ color }}
            >
              {roleOf(p)}
            </p>
          )}
        </div>

        {/* Contact */}
        <div className="resume-export-block px-6 py-4.5" style={sideDivider}>
          <p
            className="text-[13px] font-bold uppercase tracking-[0.15em] mb-2.5"
            style={{ color }}
          >
            Contact
          </p>
          {contactValues(p, color).map((v, i) => (
            <p
              key={i}
              className="text-[11px] text-gray-600 mb-1 last:mb-0 break-all leading-relaxed"
            >
              {v}
            </p>
          ))}
        </div>

        {orderedBlocks(sections, sidebarBlocks, [
          "skills",
          "education",
          "certifications",
        ])}
      </div>

      {/* Right 65% main */}
      <div className="resume-template-columns-main flex-1 px-8 py-7">
        {orderedBlocks(sections, mainBlocks, [
          "summary",
          "experience",
          "projects",
        ])}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main ResumePreview — route to correct template
═══════════════════════════════════════════════════════════ */
/**
 * Ids with a dedicated component below. Anything else (including ids from a
 * newer server catalog this client hasn't shipped yet) renders the default
 * template rather than a blank page. Retired ids are mapped to a live id by
 * `resolveTemplateId` before this list is consulted.
 */
const KNOWN_TEMPLATE_IDS = [
  "silicon-valley",
  "faang",
  "nova",
  "executive-pro",
  "creative-pro",
  "vanguard",
  "ats-clean",
  "academic",
  "corporate-navy",
  "compact",
  "european",
  "two-column",
];

export const ResumePreview = memo(function ResumePreview({
  resume,
  accentColor,
  fontScale = 1,
  fontColor,
  backgroundColor,
  showWatermark = false,
  autoFit = true,
  /** `paginated` = A4 pages (builder/export). `continuous` = natural height for thumbnails so short resumes do not show a half-empty sheet. */
  layout = "paginated",
  /** Builder: revision counter instead of hashing full section JSON for pagination remeasure. */
  contentRevision = 0,
}: {
  resume: ResumeDetail;
  accentColor?: string;
  fontScale?: number;
  fontColor?: string;
  backgroundColor?: string;
  /** When true (Free plan), a subtle brand footer appears on every template and in PDF print export. */
  showWatermark?: boolean;
  autoFit?: boolean;
  layout?: "paginated" | "continuous";
  contentRevision?: number;
}) {
  // Saved resumes may still carry a retired id — resolve to its successor so
  // they keep rendering a real template instead of the generic fallback.
  const templateId = resolveTemplateId(resume.templateId) ?? "silicon-valley";
  const color =
    accentColor ??
    resolveAccentColor(resume.templateId, resume.accentColor) ??
    getDefaultAccentColor(templateId);
  const font = resume.fontFamily ?? getDefaultFontFamily(templateId);
  const fColor = fontColor ?? resume.fontColor ?? "#111827";
  const bColor = backgroundColor ?? resume.backgroundColor ?? "#ffffff";
  const fs = fontScale > 0 && Number.isFinite(fontScale) ? fontScale : 1;

  const sections = useMemo(() => {
    return (resume.sections ?? []).map((s) => {
      if (s.type === "skills") {
        const content = s.content as Record<string, unknown> | undefined;
        if (!content || !content.style) {
          return {
            ...s,
            content: {
              ...(content ?? {}),
              style: getDefaultSkillStyle(templateId),
            },
          };
        }
      }
      return s;
    });
  }, [resume.sections, templateId]);

  const props = { sections, color, font };
  const sidebarFill =
    templateId === "silicon-valley"
      ? { widthPx: 240, color: alpha(color, 0.05) }
      : templateId === "creative-pro"
        ? { widthPx: 220, color: alpha(color, 0.08) }
        : templateId === "two-column"
          ? { widthPx: 280, color: alpha(color, 0.05) }
          : templateId === "european"
            ? { widthPx: 230, color: alpha(color, 0.03) }
            : null;

  const measureKey = useMemo(() => {
    const sectionIds = (resume.sections ?? []).map((s) => s.id).join(",");
    return `${layout}|${templateId}|${sectionIds}|${contentRevision}|${fontScale}|${fColor}|${bColor}|${showWatermark ? 1 : 0}`;
  }, [
    resume.sections,
    templateId,
    contentRevision,
    fontScale,
    fColor,
    bColor,
    showWatermark,
    layout,
  ]);

  const templateInner = (
    <>
      {templateId === "silicon-valley" && <SiliconValleyTemplate {...props} />}
      {templateId === "faang" && <FaangTemplate {...props} />}
      {templateId === "nova" && <NovaTemplate {...props} />}
      {templateId === "executive-pro" && <ExecutiveProTemplate {...props} />}
      {templateId === "creative-pro" && <CreativeProTemplate {...props} />}
      {templateId === "vanguard" && <VanguardTemplate {...props} />}
      {templateId === "ats-clean" && (
        <AtsCleanTemplate sections={sections} color={color} font={font} />
      )}
      {templateId === "academic" && <AcademicTemplate {...props} />}
      {templateId === "corporate-navy" && <CorporateNavyTemplate {...props} />}
      {templateId === "compact" && <CompactTemplate {...props} />}
      {templateId === "european" && <EuropeanTemplate {...props} />}
      {templateId === "two-column" && <TwoColumnTemplate {...props} />}
      {!KNOWN_TEMPLATE_IDS.includes(templateId) && (
        <SiliconValleyTemplate {...props} />
      )}
    </>
  );

  const templateStack = (
    <div className="flex w-full flex-col [&>div]:w-full">{templateInner}</div>
  );

  return (
    <div
      className="resume-preview-document relative"
      style={{ fontFamily: font }}
      data-layout={layout}
      data-watermarked={showWatermark ? "" : undefined}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /*
             * Rich text (summary, bullets, project descriptions): override inline paste styles
             * (Word/Docs often set word-break / white-space on spans) so words stay whole.
             */
            .a4-page .resume-text,
            .a4-page .resume-text *,
            .resume-continuous-canvas .resume-text,
            .resume-continuous-canvas .resume-text * {
              word-break: normal !important;
              overflow-wrap: normal !important;
              word-wrap: normal !important;
              white-space: normal !important;
              hyphens: none !important;
              -webkit-hyphens: none !important;
              line-break: auto !important;
            }
            @supports (text-wrap: pretty) {
              .a4-page .resume-text,
              .resume-continuous-canvas .resume-text {
                text-wrap: pretty;
              }
            }
            /*
             * Links must NOT use overflow-wrap:anywhere — pasted prose is often wrapped in one <a>,
             * which would allow breaks after every character ("S" / "killed").
             * Same wrapping as body text; long bare URLs still wrap via overflow-wrap:break-word.
             */
            .a4-page .resume-text a,
            .resume-continuous-canvas .resume-text a {
              overflow-wrap: break-word !important;
              word-break: normal !important;
            }
            /*
             * Multi-page readability guardrails:
             * keep grouped blocks/two-column chunks from being split awkwardly.
             */
            .a4-page .resume-export-block,
            .a4-page .resume-export-grid > div,
            .resume-continuous-canvas .resume-export-block,
            .resume-continuous-canvas .resume-export-grid > div {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .a4-page .resume-section-header,
            .resume-continuous-canvas .resume-section-header {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
            /*
             * Two-column sidebars should visually fill their column height per page window.
             */
            .a4-page [data-resume-two-col-root],
            .resume-continuous-canvas [data-resume-two-col-root] {
              min-height: 100%;
              align-items: stretch;
            }
            .a4-page [data-resume-sidebar],
            .resume-continuous-canvas [data-resume-sidebar] {
              min-height: 100%;
              align-self: stretch;
            }
            ${RESUME_GALLERY_THUMB_CSS}
            /*
             * Paginated mode: the sidebarFill div in ResumePagedView paints the
             * sidebar color across inset-y-0 on each page (including topPad and
             * watermark areas). Remove the template's own sidebar background so
             * the two alpha layers don't compound into a darker shade — one
             * consistent color from top to bottom, continuously across all pages.
             */
            .a4-page [data-resume-sidebar] {
              background: transparent !important;
            }
            .resume-continuous-canvas { box-sizing: border-box; }
            ${RESUME_EXPORT_CSS}
          `,
        }}
      />
      {fColor && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .a4-page,
            .resume-continuous-canvas {
              /* Production-grade wrapping: keep words intact, only break long tokens (URLs/emails) when needed. */
              overflow-wrap: break-word;
              word-break: normal;
              word-wrap: break-word;
              hyphens: none;
            }

            .a4-page[data-font-color="${fColor}"] .text-gray-950,
            .a4-page[data-font-color="${fColor}"] .text-gray-900,
            .a4-page[data-font-color="${fColor}"] .text-gray-800,
            .a4-page[data-font-color="${fColor}"] .text-gray-700,
            .a4-page[data-font-color="${fColor}"] .text-black,
            .a4-page[data-font-color="${fColor}"] .text-slate-800,
            .a4-page[data-font-color="${fColor}"] .text-slate-900,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-950,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-900,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-800,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-700,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-black,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-slate-800,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-slate-900 { color: ${fColor}; }

            .a4-page[data-font-color="${fColor}"] .text-gray-600,
            .a4-page[data-font-color="${fColor}"] .text-gray-500,
            .a4-page[data-font-color="${fColor}"] .text-gray-400,
            .a4-page[data-font-color="${fColor}"] .text-slate-600,
            .a4-page[data-font-color="${fColor}"] .text-slate-500,
            .a4-page[data-font-color="${fColor}"] .text-slate-400,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-600,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-500,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-gray-400,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-slate-600,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-slate-500,
            .resume-continuous-canvas[data-font-color="${fColor}"] .text-slate-400 { color: ${alpha(fColor, 0.75)}; }

            .a4-page[data-font-color="${fColor}"] .bg-gray-100,
            .a4-page[data-font-color="${fColor}"] .bg-gray-200, 
            .a4-page[data-font-color="${fColor}"] .bg-gray-300,
            .a4-page[data-font-color="${fColor}"] .bg-gray-50, 
            .a4-page[data-font-color="${fColor}"] .bg-slate-100,
            .a4-page[data-font-color="${fColor}"] .bg-slate-200,
            .a4-page[data-font-color="${fColor}"] .bg-muted,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-gray-100,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-gray-200,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-gray-300,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-gray-50,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-slate-100,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-slate-200,
            .resume-continuous-canvas[data-font-color="${fColor}"] .bg-muted { background-color: ${alpha(fColor, 0.15)}; }

            .a4-page[data-font-color="${fColor}"] .border-gray-100,
            .a4-page[data-font-color="${fColor}"] .border-gray-200,
            .a4-page[data-font-color="${fColor}"] .border-gray-300,
            .a4-page[data-font-color="${fColor}"] .border-slate-200,
            .a4-page[data-font-color="${fColor}"] .border-slate-300,
            .a4-page[data-font-color="${fColor}"] .border-border,
            .resume-continuous-canvas[data-font-color="${fColor}"] .border-gray-100,
            .resume-continuous-canvas[data-font-color="${fColor}"] .border-gray-200,
            .resume-continuous-canvas[data-font-color="${fColor}"] .border-gray-300,
            .resume-continuous-canvas[data-font-color="${fColor}"] .border-slate-200,
            .resume-continuous-canvas[data-font-color="${fColor}"] .border-slate-300,
            .resume-continuous-canvas[data-font-color="${fColor}"] .border-border { border-color: ${alpha(fColor, 0.25)}; }

            .a4-page[data-font-color="${fColor}"] svg circle[stroke="#e5e7eb"],
            .a4-page[data-font-color="${fColor}"] svg circle[stroke="rgba(255,255,255,0.18)"],
            .resume-continuous-canvas[data-font-color="${fColor}"] svg circle[stroke="#e5e7eb"],
            .resume-continuous-canvas[data-font-color="${fColor}"] svg circle[stroke="rgba(255,255,255,0.18)"] { stroke: ${alpha(fColor, 0.15)}; }
            .a4-page[data-font-color="${fColor}"] svg text,
            .resume-continuous-canvas[data-font-color="${fColor}"] svg text { fill: ${fColor}; }
          `,
          }}
        />
      )}
      {layout === "continuous" ? (
        <div
          className="resume-continuous-canvas relative w-full overflow-hidden bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)]"
          style={{ width: 794, backgroundColor: bColor }}
          data-font-color={fColor || undefined}
        >
          {showWatermark ? (
            <div
              className="resume-page-watermark pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center"
              aria-hidden
            >
              <ResumeWatermark backgroundColor={bColor} />
            </div>
          ) : null}
          <div
            className="relative z-[1] box-border w-full"
            style={{
              zoom: fs,
              width: "100%",
              paddingBottom: showWatermark ? 28 : 0,
            }}
          >
            {templateStack}
          </div>
        </div>
      ) : (
        <ResumePagedView
          fontScale={fontScale}
          autoFit={autoFit}
          showWatermark={showWatermark}
          backgroundColor={bColor}
          dataFontColor={fColor}
          sidebarFill={sidebarFill}
          measureKey={measureKey}
        >
          {templateStack}
        </ResumePagedView>
      )}
    </div>
  );
});
