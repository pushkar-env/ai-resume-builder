import type * as React from "react";
import { useMemo } from "react";
import type { ResumeDetail } from "@workspace/api-client-react";
import { sanitizeResumeRichHtml } from "@/lib/sanitize-resume-rich-html";
import { RESUME_EXPORT_CSS } from "@/lib/resume-export-styles";
import { RESUME_GALLERY_THUMB_CSS } from "@/lib/resume-gallery-thumb-styles";
import { ResumePagedView } from "@/components/resume/ResumePagedView";
import { ResumeWatermark } from "@/components/resume/ResumeWatermark";
import {
  getDefaultAccentColor,
  TEMPLATE_DEFAULT_SKILL_STYLES,
  getDefaultFontFamily,
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
            href={url}
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
): React.ReactElement | null {
  if (!skills || skills.length === 0) return null;
  const effective = style ?? "chips";

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
        <div
          className="resume-export-block px-5 py-5"
          style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
        >
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

        {/* Skills */}
        {skills.length > 0 && (
          <div
            className="resume-export-block px-5 py-5"
            style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
          >
            <p
              className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3.5"
              style={{ color }}
            >
              Skills
            </p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}

        {/* Education */}
        {edu.length > 0 && (
          <div
            className="px-5 py-5"
            style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
          >
            <div className="resume-export-block">
              <p
                className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3.5"
                style={{ color }}
              >
                Education
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
                  {edu[0].gpa
                    ? ` · ${renderGpa(edu[0].gpa, edu[0].gpaMode)}`
                    : ""}
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
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div className="px-5 py-5">
            <div className="resume-export-block">
              <p
                className="text-[13px] font-bold uppercase tracking-[0.12em] mb-3.5"
                style={{ color }}
              >
                Certifications
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
        )}
      </div>

      {/* Main */}
      <div className="resume-template-columns-main flex-1 px-8 py-7">
        {str(summary.text) && (
          <div className="resume-export-block mb-7">
            <div className="flex items-center gap-2 mb-2.5 resume-section-header">
              <p
                className="text-[14px] font-bold uppercase tracking-[0.13em]"
                style={{ color }}
              >
                About
              </p>
              <div
                className="flex-1 h-px"
                style={{ background: alpha(color, 0.25) }}
              />
            </div>
            <div
              className="resume-text text-[11px] text-gray-600 leading-[1.65]"
              dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
            />
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3.5 resume-section-header">
              <p
                className="text-[14px] font-bold uppercase tracking-[0.13em]"
                style={{ color }}
              >
                Experience
              </p>
              <div
                className="flex-1 h-px"
                style={{ background: alpha(color, 0.25) }}
              />
            </div>
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
        )}

        {projects.length > 0 && (
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3.5 resume-section-header">
              <p
                className="text-[14px] font-bold uppercase tracking-[0.13em]"
                style={{ color }}
              >
                Projects
              </p>
              <div
                className="flex-1 h-px"
                style={{ background: alpha(color, 0.25) }}
              />
            </div>
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
                  {str(pr.description) && (
                    <div
                      className="resume-text text-[11px] text-gray-600 mt-1"
                      dangerouslySetInnerHTML={{
                        __html: richHtml(pr.description),
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
          {str(summary.text) && (
            <div className="resume-export-block mb-6">
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className="h-4 w-[3px] rounded-full"
                  style={{ background: color }}
                />
                <p className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800">
                  Summary
                </p>
              </div>
              <div
                className="resume-text text-[11px] text-gray-600 leading-[1.65]"
                dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
              />
            </div>
          )}

          {exp.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-4 w-[3px] rounded-full"
                  style={{ background: color }}
                />
                <p className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800">
                  Experience
                </p>
              </div>
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
          )}

          {projects.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-4 w-[3px] rounded-full"
                  style={{ background: color }}
                />
                <p className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800">
                  Projects
                </p>
              </div>
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
                    {str(pr.description) && (
                      <div
                        className="resume-text text-[11px] text-gray-600 mt-1"
                        dangerouslySetInnerHTML={{
                          __html: richHtml(pr.description),
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {edu.length > 0 && (
            <div className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-4 w-[3px] rounded-full"
                  style={{ background: color }}
                />
                <p className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800">
                  Education
                </p>
              </div>
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
          )}
        </div>

        {/* Right skills column */}
        {(skills.length > 0 || certs.length > 0) && (
          <div className="w-[170px] shrink-0">
            {skills.length > 0 && (
              <div className="resume-export-block mb-6">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800 mb-3"
                  style={{ color }}
                >
                  Skills
                </p>
                {renderSkills(skills, skillsStyle, color, false)}
              </div>
            )}
            {certs.length > 0 && (
              <div>
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.14em] text-gray-800 mb-3"
                  style={{ color }}
                >
                  Certs
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
                            href={url}
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
            )}
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

      {str(summary.text) && (
        <div className="resume-export-block mb-6">
          <p
            className="text-[13.5px] font-bold uppercase tracking-[0.2em] mb-2 text-center"
            style={{ color }}
          >
            Profile
          </p>
          <div
            className="resume-text text-[11px] text-gray-500 leading-[1.7] text-center max-w-[480px] mx-auto"
            dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
          />
        </div>
      )}

      {exp.length > 0 && (
        <div className="mb-6">
          <p
            className="text-[13.5px] font-bold uppercase tracking-[0.2em] mb-3.5"
            style={{ color }}
          >
            Experience
          </p>
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
      )}

      <div className="grid grid-cols-2 gap-7 mb-6">
        {edu.length > 0 && (
          <div>
            <p
              className="text-[13.5px] font-bold uppercase tracking-[0.2em] mb-3.5"
              style={{ color }}
            >
              Education
            </p>
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
        )}
        {skills.length > 0 && (
          <div className="resume-export-block">
            <p
              className="text-[13.5px] font-bold uppercase tracking-[0.2em] mb-3.5"
              style={{ color }}
            >
              Expertise
            </p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className="mb-6">
          <p
            className="text-[13.5px] font-bold uppercase tracking-[0.2em] mb-3.5"
            style={{ color }}
          >
            Selected Projects
          </p>
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
                <div
                  className="resume-text text-[11px] text-gray-500 flex-1"
                  dangerouslySetInnerHTML={{ __html: richHtml(pr.description) }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {certs.length > 0 && (
        <div className="resume-export-block mb-6 last:mb-0">
          <p
            className="text-[13.5px] font-bold uppercase tracking-[0.2em] mb-3.5"
            style={{ color }}
          >
            Certifications
          </p>
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
      )}
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

      {str(summary.text) && (
        <div className="resume-export-block mb-6 text-center">
          <div
            className="resume-text text-[11px] text-gray-600 leading-[1.8] max-w-[480px] mx-auto"
            dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
          />
        </div>
      )}

      {exp.length > 0 && (
        <div className="mb-6">
          <div className="space-y-4">
            {exp.map((e, i) => (
              <div key={i} className="resume-export-block">
                {i === 0 && (
                  <div className="flex items-center gap-3 mb-3.5 resume-section-header">
                    <div className="flex-1 h-px bg-gray-200" />
                    <p
                      className="text-[13.5px] uppercase tracking-[0.18em] text-gray-400 shrink-0"
                      style={{ color }}
                    >
                      Professional Experience
                    </p>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
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
      )}

      <div className="grid grid-cols-2 gap-8 mt-4 mb-6">
        {edu.length > 0 && (
          <div className="space-y-3.5">
            {edu.map((e, i) => (
              <div key={i} className="resume-export-block">
                {i === 0 && (
                  <div className="flex items-center gap-3 mb-3 resume-section-header">
                    <div className="flex-1 h-px bg-gray-200" />
                    <p
                      className="text-[13.5px] uppercase tracking-[0.18em] text-gray-400 shrink-0"
                      style={{ color }}
                    >
                      Education
                    </p>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
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
        )}

        {(skills.length > 0 || certs.length > 0) && (
          <div>
            {skills.length > 0 && (
              <div className="resume-export-block">
                <div className="flex items-center gap-3 mb-3 resume-section-header">
                  <div className="flex-1 h-px bg-gray-200" />
                  <p
                    className="text-[13.5px] uppercase tracking-[0.18em] text-gray-400 shrink-0"
                    style={{ color }}
                  >
                    Core Competencies
                  </p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {renderSkills(skills, skillsStyle, color, false)}
              </div>
            )}
            {certs.length > 0 && (
              <div className="resume-export-block mt-4">
                <p
                  className="text-[11px] uppercase tracking-[0.15em] text-gray-400 mb-2 resume-section-header"
                  style={{ color }}
                >
                  Certifications
                </p>
                <div className="space-y-1">
                  {certs.map((c, i) => (
                    <div key={i}>
                      <CertLine
                        key={i}
                        c={c}
                        className="text-[11px] italic text-gray-600"
                        color={color}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className="mt-6">
          <div className="space-y-2">
            {projects.map((pr, i) => (
              <div key={i} className="resume-export-block">
                {i === 0 && (
                  <div className="flex items-center gap-3 mb-3 resume-section-header">
                    <div className="flex-1 h-px bg-gray-200" />
                    <p
                      className="text-[13.5px] uppercase tracking-[0.18em] text-gray-400 shrink-0"
                      style={{ color }}
                    >
                      Notable Projects
                    </p>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
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
                {str(pr.description) && (
                  <span className="resume-text text-[11px] text-gray-600 ml-2">
                    —{" "}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: richHtml(pr.description),
                      }}
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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

        {/* Skills */}
        {skills.length > 0 && (
          <div
            className="resume-export-block px-5 py-4"
            style={{ background: alpha(color, 0.02) }}
          >
            <p
              className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2.5"
              style={{ color }}
            >
              Skills
            </p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}

        {/* Education */}
        {edu.length > 0 && (
          <div className="resume-export-block px-5 py-4">
            <p
              className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2.5"
              style={{ color }}
            >
              Education
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
        )}

        {certs.length > 0 && (
          <div className="resume-export-block px-5 py-4">
            <p
              className="text-[13px] font-bold uppercase tracking-[0.14em] mb-2.5"
              style={{ color }}
            >
              Certifications
            </p>
            <div className="space-y-1">
              {certs.map((c, i) => (
                <div key={i} className="resume-export-block">
                  <CertLine
                    key={i}
                    c={c}
                    className="text-[11px] text-gray-600 mb-1 last:mb-0"
                    color={color}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="resume-template-columns-main flex-1 px-8 py-7">
        {str(summary.text) && (
          <div
            className="resume-export-block mb-6 p-4 rounded-xl"
            style={{ background: alpha(color, 0.06) }}
          >
            <p
              className="text-[13.5px] font-bold uppercase tracking-[0.15em] mb-2"
              style={{ color }}
            >
              About Me
            </p>
            <div
              className="resume-text text-[11px] text-gray-600 leading-[1.7]"
              dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
            />
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3.5">
              <div
                className="h-3.5 w-[3px] rounded-full"
                style={{ background: color }}
              />
              <p
                className="text-[13.5px] font-black uppercase tracking-[0.15em] text-gray-800"
                style={{ color }}
              >
                Experience
              </p>
            </div>
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
        )}

        {projects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <div
                className="h-3.5 w-[3px] rounded-full"
                style={{ background: color }}
              />
              <p
                className="text-[13.5px] font-black uppercase tracking-[0.15em] text-gray-800"
                style={{ color }}
              >
                Projects
              </p>
            </div>
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
                  {str(pr.description) && (
                    <div
                      className="resume-text text-[11px] text-gray-500 mt-1"
                      dangerouslySetInnerHTML={{
                        __html: richHtml(pr.description),
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   6. MIDNIGHT LUXE — Dark bg, gold accents, premium
═══════════════════════════════════════════════════════════ */
export function MidnightTemplate({ sections, color, font }: TP) {
  const get = getter(sections);
  const p = get("personal") ?? {};
  const summary = get("summary") ?? {};
  const exp = items<Item>(get("experience"));
  const edu = items<Item>(get("education"));
  const skills = items<Item>(get("skills"));
  const projects = items<Item>(get("projects"));
  const certs = items<Item>(get("certifications"));
  const skillsStyle = skillsStyleOf(sections);
  const gold = color;
  const card = alpha(color, 0.04);
  const border = alpha(color, 0.15);

  return (
    <div className="px-9 py-8" style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Header */}
      <div
        className="mb-7 pb-5"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[30px] font-black text-gray-900 tracking-tight leading-none">
              {str(p.name) || "Your Name"}
            </h1>
            {roleOf(p) && (
              <p
                className="text-[12px] font-semibold mt-2 tracking-[0.14em] uppercase"
                style={{ color: gold }}
              >
                {roleOf(p)}
              </p>
            )}
          </div>
          <Avatar
            p={p}
            bg={gold}
            textColor="#ffffff"
            sizeClass="h-12 w-12 text-lg"
          />
        </div>
        <div className="flex gap-5 mt-3.5 flex-wrap">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[10px] text-gray-600">
              {v}
            </span>
          ))}
        </div>
      </div>

      {str(summary.text) && (
        <div className="resume-export-block mb-6">
          <p
            className="text-[13.5px] font-bold uppercase tracking-[0.18em] mb-2"
            style={{ color: gold }}
          >
            Profile
          </p>
          <div
            className="resume-text text-[11px] text-gray-600 leading-[1.75]"
            dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
          />
        </div>
      )}

      {exp.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3.5">
            <p
              className="text-[13.5px] font-bold uppercase tracking-[0.18em] shrink-0"
              style={{ color: gold }}
            >
              Experience
            </p>
            <div className="flex-1 h-px" style={{ background: border }} />
          </div>
          <div className="space-y-4">
            {exp.map((e, i) => (
              <div
                key={i}
                className="resume-export-block rounded-lg p-3.5"
                style={{ background: card, border: `1px solid ${border}` }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[12px] font-bold text-gray-900">
                      {str(e.title)}
                    </p>
                    <p
                      className="text-[11.5px] font-medium mt-0.5"
                      style={{ color: gold }}
                    >
                      {str(e.company)}
                      {e.location ? ` · ${str(e.location)}` : ""}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-500 shrink-0 ml-3">
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
                        style={{ background: gold }}
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
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          {edu.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3.5">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.18em] shrink-0"
                  style={{ color: gold }}
                >
                  Education
                </p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              <div className="space-y-3">
                {edu.map((e, i) => (
                  <div
                    key={i}
                    className="resume-export-block rounded-lg p-3"
                    style={{ background: card, border: `1px solid ${border}` }}
                  >
                    <p className="text-[12px] font-semibold text-gray-900">
                      {str(e.school)}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {str(e.degree)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {str(e.startDate)}
                      {e.endDate ? ` – ${str(e.endDate)}` : ""}
                      {e.gpa ? ` · ${renderGpa(e.gpa, e.gpaMode)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {certs.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3.5">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.18em] shrink-0"
                  style={{ color: gold }}
                >
                  Certs
                </p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              <div className="space-y-1">
                {certs.map((c, i) => (
                  <div key={i} className="resume-export-block">
                    <CertLine
                      key={i}
                      c={c}
                      className="text-[11px] text-gray-600"
                      color={gold}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          {skills.length > 0 && (
            <div className="resume-export-block mb-6">
              <div className="flex items-center gap-3 mb-3.5">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.18em] shrink-0"
                  style={{ color: gold }}
                >
                  Skills
                </p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              {renderSkills(skills, skillsStyle, gold, false)}
            </div>
          )}
          {projects.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3.5">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.18em] shrink-0"
                  style={{ color: gold }}
                >
                  Projects
                </p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              <div className="space-y-3">
                {projects.map((pr, i) => (
                  <div key={i} className="resume-export-block">
                    <p className="text-[12px] font-semibold text-gray-900">
                      {str(pr.name)}
                    </p>
                    <ProjectLink
                      url={pr.url}
                      label={pr.label}
                      color={gold}
                      className="text-[10px]"
                    />
                    {str(pr.description) && (
                      <div
                        className="resume-text text-[11px] text-gray-600 mt-1"
                        dangerouslySetInnerHTML={{
                          __html: richHtml(pr.description),
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
    <div className="mt-6 resume-section-header">
      <p
        className="text-[13.5px] font-black uppercase tracking-wide"
        style={{ color }}
      >
        {label}
      </p>
      <div className="h-px mt-1 mb-3" style={{ background: color }} />
    </div>
  );

  return (
    <div className="px-8 py-7" style={{ fontFamily: font }}>
      <div className="text-center mb-4">
        <h1 className="text-[32px] font-black text-gray-950">
          {str(p.name) || "Your Name"}
        </h1>
        <p className="text-[10px] text-gray-700 mt-1">
          {contactValues(p, color).map((v, i) => (
            <span key={i}>
              {i > 0 && "  |  "}
              {v}
            </span>
          ))}
        </p>
      </div>
      {str(summary.text) && (
        <div className="resume-export-block">
          <SH label="Professional Summary" />
          <div
            className="resume-text text-[11px] text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
          />
        </div>
      )}
      {exp.length > 0 && (
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              {i === 0 && <SH label="Work Experience" />}
              <div className="flex justify-between items-baseline mb-0.5">
                <p className="text-[12px] font-bold text-gray-900">
                  {str(e.title)}, {str(e.company)}
                  {e.location ? `, ${str(e.location)}` : ""}
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
      )}
      {edu.length > 0 && (
        <div className="space-y-2">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              {i === 0 && <SH label="Education" />}
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
      )}
      {skills.length > 0 && (
        <div className="resume-export-block">
          <SH label="Skills" />
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
      )}
      {projects.length > 0 && (
        <div className="space-y-3">
          {projects.map((pr, i) => (
            <div
              key={i}
              className="resume-export-block text-[11px] text-gray-700"
            >
              {i === 0 && <SH label="Projects" />}
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
              {str(pr.description) && (
                <div
                  className="resume-text text-[11px] text-gray-700 mt-0.5 [&_p]:m-0"
                  dangerouslySetInnerHTML={{ __html: richHtml(pr.description) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {certs.length > 0 && (
        <div className="space-y-1.5">
          {certs.map((c, i) => (
            <div key={i} className="resume-export-block">
              {i === 0 && <SH label="Certifications" />}
              <CertLine
                key={i}
                c={c}
                className="text-[11px] text-gray-700"
                color={color}
              />
            </div>
          ))}
        </div>
      )}
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

  const SH = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mt-6 first:mt-0 mb-3 resume-section-header">
      <h2
        className="text-[13.5px] font-bold uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {label}
      </h2>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );

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

      {str(summary.text) && (
        <div className="resume-export-block">
          <SH label="Research Interests / Summary" />
          <div
            className="resume-text text-[11px] text-gray-700 leading-[1.7]"
            dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
          />
        </div>
      )}

      {edu.length > 0 && (
        <div className="space-y-3">
          {edu.map((e, i) => (
            <div key={i} className="resume-export-block">
              {i === 0 && <SH label="Education" />}
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
      )}

      {exp.length > 0 && (
        <div className="space-y-4">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              {i === 0 && <SH label="Academic & Professional Experience" />}
              <div className="flex justify-between items-baseline mb-0.5">
                <div>
                  <p className="text-[12px] font-bold text-gray-900">
                    {str(e.title)}
                  </p>
                  <p className="text-[11px] italic text-gray-600 mt-0.5">
                    {str(e.company)}
                    {e.location ? `, ${str(e.location)}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-gray-500 shrink-0 ml-3">
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
                    className="flex gap-1.5 text-[11px] text-gray-700 ml-3 mt-1 first:mt-0.5"
                  >
                    <span className="shrink-0">•</span>
                    <div className="flex-1 min-w-0">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="space-y-3.5">
          {projects.map((pr, i) => (
            <div key={i} className="resume-export-block">
              {i === 0 && <SH label="Publications & Research Projects" />}
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
              {str(pr.description) && (
                <div
                  className="resume-text text-[11px] text-gray-600 mt-0.5"
                  dangerouslySetInnerHTML={{ __html: richHtml(pr.description) }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="resume-export-grid grid grid-cols-2 gap-6 mt-2">
        {skills.length > 0 && (
          <div className="resume-export-block">
            <SH label="Skills & Methods" />
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
        )}
        {certs.length > 0 && (
          <div className="resume-export-block">
            <SH label="Certifications" />
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
        )}
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

      <div className="px-8 py-6">
        {str(summary.text) && (
          <div
            className="resume-export-block mb-6 pb-5"
            style={{ borderBottom: `1px solid ${alpha(navy, 0.12)}` }}
          >
            <p
              className="text-[13.5px] font-bold uppercase tracking-[0.16em] mb-2"
              style={{ color: navy }}
            >
              Professional Summary
            </p>
            <div
              className="resume-text text-[11px] text-gray-600 leading-[1.7]"
              dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
            />
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-6">
            <p
              className="text-[13.5px] font-bold uppercase tracking-[0.16em] mb-3.5"
              style={{ color: navy }}
            >
              Work Experience
            </p>
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
        )}

        <div className="resume-export-grid grid grid-cols-2 gap-6">
          <div>
            {edu.length > 0 && (
              <div className="mb-4">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.16em] mb-3"
                  style={{ color: navy }}
                >
                  Education
                </p>
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
            )}
            {certs.length > 0 && (
              <div>
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.16em] mb-3"
                  style={{ color: navy }}
                >
                  Certifications
                </p>
                <div className="space-y-1">
                  {certs.map((c, i) => (
                    <div key={i} className="resume-export-block">
                      <CertLine
                        key={i}
                        c={c}
                        className="text-[11px] text-gray-600"
                        color={navy}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            {skills.length > 0 && (
              <div className="resume-export-block mb-4">
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.16em] mb-3"
                  style={{ color: navy }}
                >
                  Core Skills
                </p>
                {renderSkills(skills, skillsStyle, navy, false)}
              </div>
            )}
            {projects.length > 0 && (
              <div>
                <p
                  className="text-[13.5px] font-bold uppercase tracking-[0.16em] mb-3"
                  style={{ color: navy }}
                >
                  Key Projects
                </p>
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
                      {str(pr.description) && (
                        <div
                          className="resume-text text-[11px] text-gray-500 mt-1"
                          dangerouslySetInnerHTML={{
                            __html: richHtml(pr.description),
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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

  const renderedSections: React.ReactNode[] = [];

  if (str(summary.text)) {
    renderedSections.push(
      <div
        className="resume-export-block resume-text text-[11px] text-gray-600 leading-[1.6]"
        dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
      />,
    );
  }

  if (skills.length > 0) {
    const style = skillsStyleOf(sections);
    if (style && style !== "text") {
      renderedSections.push(
        <div className="resume-export-block">
          <p
            className="text-[12.5px] font-bold uppercase tracking-wide mb-2"
            style={{ color }}
          >
            Skills
          </p>
          {renderSkills(skills, style, color, false)}
        </div>,
      );
    } else {
      renderedSections.push(
        <div className="resume-export-block">
          <span
            className="text-[12.5px] font-bold uppercase tracking-wide mr-2"
            style={{ color }}
          >
            Skills:
          </span>
          <span className="text-[11px] text-gray-700">
            {skills
              .map((s) => str(s.name))
              .filter(Boolean)
              .join("  ·  ")}
          </span>
        </div>,
      );
    }
  }

  if (exp.length > 0) {
    renderedSections.push(
      <div>
        <p
          className="text-[12.5px] font-bold uppercase tracking-[0.14em] mb-2"
          style={{ color }}
        >
          Experience
        </p>
        <div className="space-y-3.5">
          {exp.map((e, i) => (
            <div key={i} className="resume-export-block">
              <div className="flex justify-between items-baseline">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <p className="text-[12px] font-bold text-gray-900">
                    {str(e.title)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    @ {str(e.company)}
                    {e.location ? `, ${str(e.location)}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0 ml-2">
                  {str(e.startDate)}
                  {e.endDate
                    ? ` – ${str(e.endDate)}`
                    : e.startDate
                      ? " – Now"
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
                    className="flex gap-1.5 text-[11px] text-gray-600 leading-[1.5] ml-1.5 mt-1"
                  >
                    <span className="shrink-0 font-bold">·</span>
                    <div className="flex-1 min-w-0">
                      <BulletContent b={b} color={color} />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (projects.length > 0) {
    renderedSections.push(
      <div>
        <p
          className="text-[12.5px] font-bold uppercase tracking-[0.14em] mb-2"
          style={{ color }}
        >
          Projects
        </p>
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
              {str(pr.description) && (
                <div
                  className="resume-text text-[11px] text-gray-500 mt-0.5"
                  dangerouslySetInnerHTML={{ __html: richHtml(pr.description) }}
                />
              )}
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (edu.length > 0) {
    renderedSections.push(
      <div>
        <p
          className="text-[12.5px] font-bold uppercase tracking-[0.14em] mb-2"
          style={{ color }}
        >
          Education
        </p>
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
      </div>,
    );
  }

  if (certs.length > 0) {
    renderedSections.push(
      <div>
        <p
          className="text-[12.5px] font-bold uppercase tracking-[0.14em] mb-2"
          style={{ color }}
        >
          Certifications
        </p>
        <div className="space-y-1">
          {certs.map((c, i) => (
            <div key={i} className="resume-export-block mb-1 last:mb-0">
              <CertLine
                key={i}
                c={c}
                className="text-[11px] text-gray-600"
                color={color}
              />
            </div>
          ))}
        </div>
      </div>,
    );
  }

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

  const SH = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3 mt-4 first:mt-0 resume-section-header">
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
          className="w-[230px] shrink-0 px-5 py-5"
          data-resume-sidebar
          style={{
            background: alpha(color, 0.03),
            borderRight: `1px solid ${alpha(color, 0.1)}`,
          }}
        >
          {skills.length > 0 && (
            <div className="resume-export-block mb-4">
              <SH label="Skills" />
              {renderSkills(skills, skillsStyle, color, false)}
            </div>
          )}

          {edu.length > 0 && (
            <div className="mb-4">
              <div className="resume-export-block">
                <SH label="Education" />
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
                    {edu[0].gpa
                      ? ` · ${renderGpa(edu[0].gpa, edu[0].gpaMode)}`
                      : ""}
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
          )}

          {certs.length > 0 && (
            <div className="mb-4">
              <div className="resume-export-block">
                <SH label="Certifications" />
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
          )}
        </div>

        {/* Right */}
        <div className="flex-1 min-w-0 px-7 py-5">
          {str(summary.text) && (
            <div className="resume-export-block mb-6">
              <SH label="Profile" />
              <div
                className="resume-text text-[11px] text-gray-600 leading-[1.7]"
                dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
              />
            </div>
          )}

          {exp.length > 0 && (
            <div className="mb-6">
              <SH label="Work Experience" />
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
                    <p
                      className="text-[11.5px] font-semibold"
                      style={{ color }}
                    >
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
          )}

          {projects.length > 0 && (
            <div>
              <SH label="Projects" />
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
                    {str(pr.description) && (
                      <div
                        className="resume-text text-[11px] text-gray-600 mt-1"
                        dangerouslySetInnerHTML={{
                          __html: richHtml(pr.description),
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
        <div
          className="px-6 pt-7 pb-5"
          style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
        >
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
        <div
          className="resume-export-block px-6 py-4.5"
          style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
        >
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

        {/* Skills */}
        {skills.length > 0 && (
          <div
            className="resume-export-block px-6 py-4.5"
            style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
          >
            <p
              className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3"
              style={{ color }}
            >
              Skills
            </p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}

        {/* Education */}
        {edu.length > 0 && (
          <div
            className="px-6 py-4.5"
            style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}
          >
            <div className="resume-export-block">
              <p
                className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3"
                style={{ color }}
              >
                Education
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
                  {edu[0].gpa
                    ? ` · ${renderGpa(edu[0].gpa, edu[0].gpaMode)}`
                    : ""}
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
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div className="px-6 py-4.5">
            <div className="resume-export-block">
              <p
                className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3.5"
                style={{ color }}
              >
                Certifications
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
        )}
      </div>

      {/* Right 65% main */}
      <div className="resume-template-columns-main flex-1 px-8 py-7">
        {str(summary.text) && (
          <div className="resume-export-block mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-0.5 w-5 rounded"
                style={{ background: color }}
              />
              <p
                className="text-[13.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color }}
              >
                Profile
              </p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div
              className="resume-text text-[11px] text-gray-600 leading-[1.7]"
              dangerouslySetInnerHTML={{ __html: richHtml(summary.text) }}
            />
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4 resume-section-header">
              <div
                className="h-0.5 w-5 rounded"
                style={{ background: color }}
              />
              <p
                className="text-[13.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color }}
              >
                Experience
              </p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
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
        )}

        {projects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3.5 resume-section-header">
              <div
                className="h-0.5 w-5 rounded"
                style={{ background: color }}
              />
              <p
                className="text-[13.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color }}
              >
                Projects
              </p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
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
                  {str(pr.description) && (
                    <div
                      className="resume-text text-[11px] text-gray-500 mt-1"
                      dangerouslySetInnerHTML={{
                        __html: richHtml(pr.description),
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main ResumePreview — route to correct template
═══════════════════════════════════════════════════════════ */
export function ResumePreview({
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
  const templateId = resume.templateId ?? "silicon-valley";
  const color =
    accentColor ?? resume.accentColor ?? getDefaultAccentColor(templateId);
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
              style: TEMPLATE_DEFAULT_SKILL_STYLES[templateId] ?? "chips",
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
      {templateId === "midnight" && <MidnightTemplate {...props} />}
      {templateId === "ats-clean" && (
        <AtsCleanTemplate sections={sections} color={color} font={font} />
      )}
      {templateId === "academic" && <AcademicTemplate {...props} />}
      {templateId === "corporate-navy" && <CorporateNavyTemplate {...props} />}
      {templateId === "compact" && <CompactTemplate {...props} />}
      {templateId === "european" && <EuropeanTemplate {...props} />}
      {templateId === "two-column" && <TwoColumnTemplate {...props} />}
      {![
        "silicon-valley",
        "faang",
        "nova",
        "executive-pro",
        "creative-pro",
        "midnight",
        "ats-clean",
        "academic",
        "corporate-navy",
        "compact",
        "european",
        "two-column",
      ].includes(templateId) && <SiliconValleyTemplate {...props} />}
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
}
