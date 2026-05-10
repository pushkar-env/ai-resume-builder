import type * as React from "react";
import type { ResumeDetail } from "@workspace/api-client-react";

/* ─── Types ─── */
type SC = Record<string, unknown>;
type Item = Record<string, unknown>;
interface TP { sections: ResumeDetail["sections"]; color: string; font: string }

/* ─── Data helpers ─── */
function sorted(sections: ResumeDetail["sections"]) {
  return [...(sections ?? [])]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .filter(s => s.isVisible !== false);
}
function getter(s: ResumeDetail["sections"]) {
  const arr = sorted(s);
  return (type: string) => arr.find(x => x.type === type)?.content as SC | undefined;
}
function items<T = Item>(sc: SC | undefined, key = "items"): T[] {
  return ((sc?.[key] ?? []) as T[]);
}
function str(v: unknown): string { return (v as string) ?? ""; }
/** Coerce a skill level to a 0–100 number. Handles legacy string values like "intermediate". */
function skillPct(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(100, Math.max(0, v));
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    const map: Record<string, number> = { beginner: 35, intermediate: 65, advanced: 85, expert: 95 };
    return map[v.toLowerCase()] ?? 75;
  }
  return 75;
}
function alpha(hex: string, a: number) {
  const v = Math.round(a * 255).toString(16).padStart(2, "0");
  return hex.startsWith("#") ? hex + v : hex;
}

/* ─── Skill progress bar ─── */
function SkillBar({ name, level, color }: { name: string; level?: unknown; color: string }) {
  const pct = skillPct(level);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[8.5px] text-gray-700 font-medium">{name}</span>
        <span className="text-[7px] text-gray-400">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
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
  if (str(p.github).trim()) legacy.push({ label: "GitHub", url: str(p.github).trim() });
  if (str(p.linkedin).trim()) legacy.push({ label: "LinkedIn", url: str(p.linkedin).trim() });
  if (str(p.twitter).trim()) legacy.push({ label: "Twitter", url: str(p.twitter).trim() });
  return legacy;
}
function ensureProto(u: string): string {
  if (!u) return u;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
function contactValues(p: SC, color?: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const v of [p.email, p.phone, p.location]) {
    if (v && String(v).trim().length > 0) out.push(str(v));
  }
  socialsList(p).forEach((s, i) => {
    out.push(
      s.url ? (
        <a key={`s-${i}-${s.label}`} href={ensureProto(s.url)}
           target="_blank" rel="noreferrer noopener"
           className="font-semibold underline underline-offset-2"
           style={color ? { color } : undefined}>{s.label}</a>
      ) : (
        <span key={`s-${i}-${s.label}`} className="font-semibold"
              style={color ? { color } : undefined}>{s.label}</span>
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
  p, sizeClass = "h-14 w-14 text-xl", bg, textColor = "#fff",
}: { p: SC; sizeClass?: string; bg: string; textColor?: string }) {
  const photo = (p.photo as string) ?? "";
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center font-black shrink-0`}
      style={{ background: bg, color: textColor }}
    >
      {photo
        ? <img src={photo} alt="" className="h-full w-full object-cover" />
        : initialsFor((p.name as string) ?? "")}
    </div>
  );
}

/* ─── Bullet helpers (text + optional work-sample link/label) ─── */
function bulletParts(b: unknown): { text: string; label: string; link: string } {
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
    <>
      {text}
      {link ? (
        <>{" "}<a href={ensureProto(link)} target="_blank" rel="noreferrer noopener"
              className="underline underline-offset-2 font-semibold"
              style={{ color }}>{label || "view sample"}</a></>
      ) : label ? (
        <span className="ml-1 font-semibold" style={{ color }}> — {label}</span>
      ) : null}
    </>
  );
}

/* ─── Certification line with optional credential link ─── */
function CertLine({
  c, className = "", color, dark = false,
}: { c: Item; className?: string; color?: string; dark?: boolean }) {
  const url = (str(c.credentialUrl) || str(c.url)).trim();
  return (
    <p className={className}>
      {str(c.name)}{c.issuer ? ` — ${str(c.issuer)}` : ""}{c.date ? ` (${str(c.date)})` : ""}
      {url && (
        <>
          {" · "}
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:opacity-80"
            style={{ color: color ?? (dark ? "#fff" : undefined) }}
          >verify</a>
        </>
      )}
    </p>
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
          const pct = skillPct(s.level);
          return (
            <div key={i}>
              <div className="flex justify-between mb-0.5">
                <span className={`text-[8px] font-medium ${dark ? "text-white" : "text-gray-700"}`}>{str(s.name)}</span>
                <span className={`text-[7px] ${dark ? "text-white/60" : "text-gray-400"}`}>{pct}%</span>
              </div>
              <div className={`h-1 rounded-full ${dark ? "bg-white/20" : "bg-gray-100"}`}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (effective === "radial") {
    const C = 2 * Math.PI * 14;
    return (
      <div className="grid grid-cols-3 gap-x-1 gap-y-2">
        {skills.map((s, i) => {
          const lvl = skillPct(s.level);
          const offset = C - (lvl / 100) * C;
          return (
            <div key={i} className="flex flex-col items-center">
              <svg width="34" height="34" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke={dark ? "rgba(255,255,255,0.18)" : "#e5e7eb"} strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 18 18)" />
                <text x="18" y="20.5" textAnchor="middle" fontSize="7.5" fontWeight={700} fill={color}>{lvl}</text>
              </svg>
              <span className={`text-[7px] mt-0.5 text-center leading-tight ${dark ? "text-white/85" : "text-gray-700"}`}>{str(s.name)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (effective === "text") {
    return (
      <p className={`text-[8.5px] leading-[1.7] ${dark ? "text-white/75" : "text-gray-600"}`}>
        {skills.map(s => str(s.name)).filter(Boolean).join("  ·  ")}
      </p>
    );
  }

  // chips (default)
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s, i) => (
        <span key={i} className="text-[8px] px-2 py-0.5 rounded font-semibold"
          style={{ background: dark ? alpha(color, 0.3) : alpha(color, 0.12), color: color }}>
          {str(s.name)}
        </span>
      ))}
    </div>
  );
}
function skillsStyleOf(sections: ResumeDetail["sections"]): string | undefined {
  const sec = (sections ?? []).find((s) => s.type === "skills");
  return ((sec?.content as SC | undefined)?.style as string | undefined);
}

/* ─── Timeline dot — sits centered on the parent's left border (Silicon Valley uses pl-4) ─── */
function TimelineDot({ color }: { color: string }) {
  return (
    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: color }} />
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
    <div className="flex h-full" style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Sidebar */}
      <div className="w-[240px] shrink-0 flex flex-col" style={{ background: sidebar, minHeight: "100%" }}>
        {/* Name block */}
        <div className="p-6 pb-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.08)` }}>
          <div className="mb-3">
            <Avatar p={p} bg={color} />
          </div>
          <h1 className="text-[15px] font-bold text-gray-900 leading-tight tracking-tight">{str(p.name) || "Your Name"}</h1>
          {roleOf(p) && <p className="text-[10px] mt-0.5 font-medium" style={{ color }}>{roleOf(p)}</p>}
        </div>

        {/* Contact */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
          <p className="text-[7px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color }}>Contact</p>
          {contactValues(p, color).map((v, i) => (
            <p key={i} className="text-[8.5px] text-gray-600 mb-0.5 leading-relaxed break-all">{v}</p>
          ))}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color }}>Skills</p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}

        {/* Education */}
        {edu.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color }}>Education</p>
            {edu.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-[9px] font-semibold text-gray-900">{str(e.school)}</p>
                <p className="text-[8px] text-gray-600">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                <p className="text-[7.5px] text-gray-400 mt-0.5">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[7px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color }}>Certifications</p>
            {certs.map((c, i) => (
              <CertLine key={i} c={c} className="text-[8px] text-gray-600 mb-0.5" color={color} />
            ))}
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 px-7 py-6 overflow-hidden">
        {str(summary.text) && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[8px] font-bold uppercase tracking-[0.13em]" style={{ color }}>About</p>
              <div className="flex-1 h-px" style={{ background: alpha(color, 0.25) }} />
            </div>
            <p className="text-[9.5px] text-gray-600 leading-[1.65]">{str(summary.text)}</p>
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.13em]" style={{ color }}>Experience</p>
              <div className="flex-1 h-px" style={{ background: alpha(color, 0.25) }} />
            </div>
            <div className="pl-4 border-l-2 border-gray-100 space-y-4">
              {exp.map((e, i) => (
                <div key={i} className="relative">
                  <TimelineDot color={color} />
                  <div className="flex justify-between items-start mb-0.5">
                    <div>
                      <p className="text-[10.5px] font-bold text-gray-900">{str(e.title)}</p>
                      <p className="text-[9px] font-medium text-gray-500">{str(e.company)}{e.location ? ` · ${str(e.location)}` : ""}</p>
                    </div>
                    <p className="text-[8px] text-gray-400 shrink-0 ml-3 mt-0.5">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                  </div>
                  {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                    <div key={j} className="flex gap-1.5 mt-1">
                      <span className="mt-[5px] h-1 w-1 rounded-full shrink-0" style={{ background: color }} />
                      <p className="text-[8.5px] text-gray-600 leading-[1.55]"><BulletContent b={b} color={color} /></p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.13em]" style={{ color }}>Projects</p>
              <div className="flex-1 h-px" style={{ background: alpha(color, 0.25) }} />
            </div>
            <div className="space-y-2.5">
              {projects.map((pr, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: alpha(color, 0.05), border: `1px solid ${alpha(color, 0.12)}` }}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9.5px] font-bold text-gray-900">{str(pr.name)}</p>
                    {str(pr.url) && <span className="text-[7.5px]" style={{ color }}>{str(pr.url)}</span>}
                  </div>
                  {str(pr.description) && <p className="text-[8.5px] text-gray-600 mt-0.5">{str(pr.description)}</p>}
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
      <div className="mb-5">
        <h1 className="text-[24px] font-black text-gray-950 tracking-tight leading-none">{str(p.name) || "Your Name"}</h1>
        {roleOf(p) && <p className="text-[11px] font-semibold mt-1" style={{ color }}>{roleOf(p)}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[8.5px] text-gray-500">{v}</span>
          ))}
        </div>
        <div className="mt-3 h-0.5 rounded-full" style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />
      </div>

      <div className="flex gap-7">
        {/* Main column */}
        <div className="flex-1 min-w-0">
          {str(summary.text) && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-4 w-[3px] rounded-full" style={{ background: color }} />
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-800">Summary</p>
              </div>
              <p className="text-[9px] text-gray-600 leading-[1.7]">{str(summary.text)}</p>
            </div>
          )}

          {exp.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-4 w-[3px] rounded-full" style={{ background: color }} />
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-800">Experience</p>
              </div>
              <div className="space-y-3.5">
                {exp.map((e, i) => (
                  <div key={i} className="pl-3" style={{ borderLeft: `2px solid ${alpha(color, 0.2)}` }}>
                    <div className="flex justify-between items-baseline">
                      <p className="text-[10.5px] font-bold text-gray-900">{str(e.title)}</p>
                      <p className="text-[7.5px] text-gray-400 shrink-0 ml-2">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                    </div>
                    <p className="text-[9px] font-semibold" style={{ color }}>{str(e.company)}{e.location ? ` · ${str(e.location)}` : ""}</p>
                    {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                      <div key={j} className="flex gap-1.5 mt-1">
                        <span className="text-[8px] text-gray-400 shrink-0">▸</span>
                        <p className="text-[8.5px] text-gray-600 leading-[1.55]"><BulletContent b={b} color={color} /></p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {projects.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-4 w-[3px] rounded-full" style={{ background: color }} />
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-800">Projects</p>
              </div>
              <div className="space-y-2">
                {projects.map((pr, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[9.5px] font-bold text-gray-900">{str(pr.name)}</p>
                      {str(pr.url) && <span className="text-[7.5px]" style={{ color }}>{str(pr.url)}</span>}
                    </div>
                    {str(pr.description) && <p className="text-[8.5px] text-gray-600">{str(pr.description)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {edu.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-[3px] rounded-full" style={{ background: color }} />
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-800">Education</p>
              </div>
              {edu.map((e, i) => (
                <div key={i} className="flex justify-between items-start mb-1.5">
                  <div>
                    <p className="text-[9.5px] font-bold text-gray-900">{str(e.school)}</p>
                    <p className="text-[8.5px] text-gray-500">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                  </div>
                  <p className="text-[7.5px] text-gray-400 shrink-0 ml-2">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right skills column */}
        {(skills.length > 0 || certs.length > 0) && (
          <div className="w-[145px] shrink-0">
            {skills.length > 0 && (
              <div className="mb-4">
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-800 mb-2.5" style={{ color }}>Skills</p>
                {renderSkills(skills, skillsStyle, color, false)}
              </div>
            )}
            {certs.length > 0 && (
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-800 mb-2" style={{ color }}>Certs</p>
                {certs.map((c, i) => {
                  const url = (str(c.credentialUrl) || str(c.url)).trim();
                  return (
                    <div key={i} className="mb-1.5 p-1.5 rounded" style={{ background: alpha(color, 0.06) }}>
                      <p className="text-[8px] font-semibold text-gray-800">{str(c.name)}</p>
                      {str(c.issuer) && <p className="text-[7px] text-gray-500">{str(c.issuer)}</p>}
                      {url && <a href={url} target="_blank" rel="noreferrer noopener" className="text-[7px] underline" style={{ color }}>verify</a>}
                    </div>
                  );
                })}
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
    <div className="px-14 py-12" style={{ fontFamily: font }}>
      {/* Header — centered, minimal */}
      <div className="text-center mb-8">
        <h1 className="text-[26px] font-extralight tracking-[0.18em] text-gray-900 uppercase leading-tight">{str(p.name) || "Your Name"}</h1>
        {roleOf(p) && <p className="text-[9px] mt-1.5 font-medium uppercase tracking-[0.2em]" style={{ color }}>{roleOf(p)}</p>}
        <div className="flex justify-center items-center gap-4 mt-3">
          {contactValues(p, color).map((v, i, arr) => (
            <span key={i} className="flex items-center gap-4">
              <span className="text-[8.5px] text-gray-400 tracking-wide">{v}</span>
              {i < arr.length - 1 && <span className="text-gray-200 text-xs">·</span>}
            </span>
          ))}
        </div>
        <div className="flex justify-center mt-5">
          <div className="h-px w-20" style={{ background: color }} />
        </div>
      </div>

      {str(summary.text) && (
        <div className="mb-7">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] mb-2 text-center" style={{ color }}>Profile</p>
          <p className="text-[9.5px] text-gray-500 leading-[1.8] text-center max-w-[420px] mx-auto">{str(summary.text)}</p>
        </div>
      )}

      {exp.length > 0 && (
        <div className="mb-7">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color }}>Experience</p>
          <div className="space-y-4">
            {exp.map((e, i) => (
              <div key={i} className="flex gap-6">
                <div className="w-[90px] shrink-0 text-right">
                  <p className="text-[8px] text-gray-300 leading-relaxed">{str(e.startDate)}</p>
                  <p className="text-[8px] text-gray-300">{str(e.endDate) || (e.startDate ? "Present" : "")}</p>
                </div>
                <div className="flex-1 border-l border-gray-100 pl-5">
                  <p className="text-[10.5px] font-semibold text-gray-800">{str(e.title)}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{str(e.company)}{e.location ? `, ${str(e.location)}` : ""}</p>
                  {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                    <p key={j} className="text-[8.5px] text-gray-500 leading-[1.6] mt-1"><BulletContent b={b} color={color} /></p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        {edu.length > 0 && (
          <div>
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color }}>Education</p>
            {edu.map((e, i) => (
              <div key={i} className="mb-2.5">
                <p className="text-[9.5px] font-semibold text-gray-800">{str(e.school)}</p>
                <p className="text-[8.5px] text-gray-400">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                <p className="text-[8px] text-gray-300 mt-0.5">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
              </div>
            ))}
          </div>
        )}
        {skills.length > 0 && (
          <div>
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color }}>Expertise</p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className="mt-7">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color }}>Selected Projects</p>
          <div className="space-y-2">
            {projects.map((pr, i) => (
              <div key={i} className="flex gap-4">
                <p className="text-[9.5px] font-semibold text-gray-700 w-[130px] shrink-0">{str(pr.name)}</p>
                <p className="text-[8.5px] text-gray-400 flex-1">{str(pr.description)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {certs.length > 0 && (
        <div className="mt-7">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color }}>Certifications</p>
          <div className="flex flex-wrap gap-3">
            {certs.map((c, i) => (
              <CertLine key={i} c={c} className="text-[8.5px] text-gray-500" color={color} />
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
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px" style={{ background: alpha(color, 0.2) }} />
      <div className="h-1 w-1 rounded-full" style={{ background: alpha(color, 0.4) }} />
      <div className="flex-1 h-px" style={{ background: alpha(color, 0.2) }} />
    </div>
  );

  return (
    <div className="px-12 py-10" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Header */}
      <div className="text-center mb-1">
        <h1 className="text-[22px] tracking-[0.06em] text-gray-900" style={{ fontWeight: 400 }}>
          {str(p.name) || "Your Name"}
        </h1>
        {roleOf(p) && (
          <p className="text-[9.5px] font-medium tracking-[0.15em] uppercase mt-1" style={{ color }}>{roleOf(p)}</p>
        )}
        <div className="flex justify-center gap-5 mt-2">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[8.5px] text-gray-500 italic">{v}</span>
          ))}
        </div>
      </div>

      {rule}

      {str(summary.text) && (
        <div className="mb-4 text-center">
          <p className="text-[9px] text-gray-600 leading-[1.8] italic max-w-[440px] mx-auto">{str(summary.text)}</p>
        </div>
      )}

      {exp.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="flex-1 h-px bg-gray-200" />
            <p className="text-[8px] uppercase tracking-[0.18em] text-gray-400" style={{ color }}>Professional Experience</p>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="space-y-3.5">
            {exp.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-[10.5px] font-bold text-gray-900">{str(e.title)}</span>
                    <span className="text-[9px] text-gray-500 ml-2">·</span>
                    <span className="text-[9px] text-gray-600 ml-2 italic">{str(e.company)}</span>
                  </div>
                  <p className="text-[8px] text-gray-400 shrink-0 ml-3">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                </div>
                {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                  <div key={j} className="flex gap-2 mt-1">
                    <span className="text-[8px] shrink-0 mt-0.5" style={{ color }}>—</span>
                    <p className="text-[8.5px] text-gray-600 leading-[1.6]"><BulletContent b={b} color={color} /></p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 mt-2">
        {edu.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px bg-gray-200" />
              <p className="text-[8px] uppercase tracking-[0.18em] text-gray-400" style={{ color }}>Education</p>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {edu.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-[9.5px] font-bold text-gray-900">{str(e.school)}</p>
                <p className="text-[8.5px] italic text-gray-600">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                <p className="text-[7.5px] text-gray-400">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {(skills.length > 0 || certs.length > 0) && (
          <div>
            {skills.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <p className="text-[8px] uppercase tracking-[0.18em] text-gray-400" style={{ color }}>Core Competencies</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {renderSkills(skills, skillsStyle, color, false)}
              </>
            )}
            {certs.length > 0 && (
              <div className="mt-3">
                <p className="text-[7.5px] uppercase tracking-[0.15em] text-gray-400 mb-1" style={{ color }}>Certifications</p>
                {certs.map((c, i) => (
                  <CertLine key={i} c={c} className="text-[8px] italic text-gray-600" color={color} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-px bg-gray-200" />
            <p className="text-[8px] uppercase tracking-[0.18em] text-gray-400" style={{ color }}>Notable Projects</p>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {projects.map((pr, i) => (
            <div key={i} className="mb-1.5">
              <span className="text-[9.5px] font-bold text-gray-900">{str(pr.name)}</span>
              {str(pr.description) && <span className="text-[8.5px] italic text-gray-600 ml-2">— {str(pr.description)}</span>}
            </div>
          ))}
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
    <div className="flex" style={{ fontFamily: font, minHeight: "100%" }}>
      <div className="w-[195px] shrink-0 flex flex-col" style={{ background: alpha(color, 0.08), minHeight: "100%", borderRight: `1px solid ${alpha(color, 0.15)}` }}>
        {/* Avatar + name */}
        <div className="p-5 pb-4">
          <div className="mb-3">
            <Avatar p={p} bg={color} sizeClass="h-16 w-16 text-[22px]" />
          </div>
          <h1 className="text-[13px] font-black text-gray-900 leading-tight tracking-tight">{str(p.name) || "Your Name"}</h1>
          {roleOf(p) && <p className="text-[8.5px] font-semibold mt-1 uppercase tracking-wide" style={{ color }}>{roleOf(p)}</p>}
        </div>

        {/* Contact */}
        <div className="px-5 py-3" style={{ background: alpha(color, 0.04) }}>
          <p className="text-[7px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color }}>Contact</p>
          {contactValues(p, color).map((v, i) => (
            <p key={i} className="text-[8px] text-gray-600 break-all leading-relaxed">{v}</p>
          ))}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="px-5 py-3" style={{ background: alpha(color, 0.02) }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color }}>Skills</p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}

        {/* Education */}
        {edu.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-[7px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color }}>Education</p>
            {edu.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-[8.5px] font-bold text-gray-900">{str(e.school)}</p>
                <p className="text-[7.5px] text-gray-600">{str(e.degree)}</p>
                <p className="text-[7px] text-gray-400">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {certs.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-[7px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color }}>Certifications</p>
            {certs.map((c, i) => (
              <CertLine key={i} c={c} className="text-[8px] text-gray-600 mb-0.5" color={color} />
            ))}
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 px-6 py-6 overflow-hidden">
        {str(summary.text) && (
          <div className="mb-5 p-3.5 rounded-xl" style={{ background: alpha(color, 0.06) }}>
            <p className="text-[7.5px] font-bold uppercase tracking-[0.15em] mb-1.5" style={{ color }}>About Me</p>
            <p className="text-[9px] text-gray-600 leading-[1.7]">{str(summary.text)}</p>
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-3.5 w-[3px] rounded-full" style={{ background: color }} />
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-800" style={{ color }}>Experience</p>
            </div>
            <div className="space-y-3">
              {exp.map((e, i) => (
                <div key={i} className="rounded-xl p-3" style={{ border: `1px solid ${alpha(color, 0.15)}` }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-gray-900">{str(e.title)}</p>
                      <p className="text-[8.5px] font-semibold mt-0.5" style={{ color }}>{str(e.company)}</p>
                    </div>
                    <span className="text-[7.5px] text-white px-2 py-0.5 rounded-full shrink-0" style={{ background: color }}>
                      {str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Now" : ""}
                    </span>
                  </div>
                  {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                    <div key={j} className="flex gap-1.5 mt-1">
                      <span className="mt-[4px] h-1 w-1 rounded-full shrink-0" style={{ background: color }} />
                      <p className="text-[8.5px] text-gray-600 leading-[1.5]"><BulletContent b={b} color={color} /></p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-3.5 w-[3px] rounded-full" style={{ background: color }} />
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-800" style={{ color }}>Projects</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {projects.map((pr, i) => (
                <div key={i} className="rounded-xl p-2.5" style={{ background: alpha(color, 0.06) }}>
                  <p className="text-[9px] font-bold text-gray-900">{str(pr.name)}</p>
                  {str(pr.description) && <p className="text-[8px] text-gray-500 mt-0.5">{str(pr.description)}</p>}
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
  const gold = color === "#7c3aed" ? "#d4a853" : color;
  const card = alpha(color, 0.04);
  const border = alpha(color, 0.15);

  return (
    <div className="px-9 py-8" style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Header */}
      <div className="mb-6 pb-5" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-black text-gray-900 tracking-tight leading-none">{str(p.name) || "Your Name"}</h1>
            {roleOf(p) && <p className="text-[9.5px] font-semibold mt-1.5 tracking-[0.14em] uppercase" style={{ color: gold }}>{roleOf(p)}</p>}
          </div>
          <Avatar p={p} bg={gold} textColor="#ffffff" sizeClass="h-12 w-12 text-lg" />
        </div>
        <div className="flex gap-5 mt-3 flex-wrap">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[8px] text-gray-600">{v}</span>
          ))}
        </div>
      </div>

      {str(summary.text) && (
        <div className="mb-5">
          <p className="text-[7.5px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: gold }}>Profile</p>
          <p className="text-[9px] text-gray-600 leading-[1.75]">{str(summary.text)}</p>
        </div>
      )}

      {exp.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[7.5px] font-bold uppercase tracking-[0.18em] shrink-0" style={{ color: gold }}>Experience</p>
            <div className="flex-1 h-px" style={{ background: border }} />
          </div>
          <div className="space-y-3">
            {exp.map((e, i) => (
              <div key={i} className="rounded-lg p-3.5" style={{ background: card, border: `1px solid ${border}` }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10.5px] font-bold text-gray-900">{str(e.title)}</p>
                    <p className="text-[8.5px] font-medium mt-0.5" style={{ color: gold }}>{str(e.company)}{e.location ? ` · ${str(e.location)}` : ""}</p>
                  </div>
                  <p className="text-[7.5px] text-gray-500 shrink-0 ml-3">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                </div>
                {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                  <div key={j} className="flex gap-1.5 mt-1.5">
                    <span className="mt-[4px] h-1 w-1 rounded-full shrink-0" style={{ background: gold }} />
                    <p className="text-[8.5px] text-gray-600 leading-[1.5]"><BulletContent b={b} color={color} /></p>
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
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.18em] shrink-0" style={{ color: gold }}>Education</p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              {edu.map((e, i) => (
                <div key={i} className="rounded-lg p-2.5 mb-2" style={{ background: card, border: `1px solid ${border}` }}>
                  <p className="text-[9px] font-semibold text-gray-900">{str(e.school)}</p>
                  <p className="text-[8px] text-gray-600">{str(e.degree)}</p>
                  <p className="text-[7.5px] text-gray-500 mt-0.5">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
                </div>
              ))}
            </div>
          )}
          {certs.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.18em] shrink-0" style={{ color: gold }}>Certs</p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              {certs.map((c, i) => (
                <CertLine key={i} c={c} className="text-[8.5px] text-gray-600 mb-0.5" color={gold} />
              ))}
            </div>
          )}
        </div>
        <div>
          {skills.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.18em] shrink-0" style={{ color: gold }}>Skills</p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              {renderSkills(skills, skillsStyle, gold, false)}
            </div>
          )}
          {projects.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.18em] shrink-0" style={{ color: gold }}>Projects</p>
                <div className="flex-1 h-px" style={{ background: border }} />
              </div>
              {projects.map((pr, i) => (
                <div key={i} className="mb-1.5">
                  <p className="text-[9px] font-semibold text-gray-900">{str(pr.name)}</p>
                  {str(pr.description) && <p className="text-[8px] text-gray-600">{str(pr.description)}</p>}
                </div>
              ))}
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
    <div className="mt-4 first:mt-0">
      <p className="text-[9px] font-black uppercase tracking-wide" style={{ color }}>{label}</p>
      <div className="h-px mt-0.5 mb-2" style={{ background: color }} />
    </div>
  );

  return (
    <div className="px-8 py-7" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div className="text-center mb-3">
        <h1 className="text-[17px] font-black text-gray-950">{str(p.name) || "Your Name"}</h1>
        <p className="text-[8.5px] text-gray-700 mt-0.5">
          {contactValues(p, color).map((v, i) => (
            <span key={i}>{i > 0 && "  |  "}{v}</span>
          ))}
        </p>

      </div>
      {str(summary.text) && (<><SH label="Professional Summary" /><p className="text-[9px] text-gray-700 leading-relaxed">{str(summary.text)}</p></>)}
      {exp.length > 0 && (
        <><SH label="Work Experience" />
          {exp.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between">
                <p className="text-[9.5px] font-bold text-gray-900">{str(e.title)}, {str(e.company)}{e.location ? `, ${str(e.location)}` : ""}</p>
                <p className="text-[8.5px] text-gray-700 shrink-0 ml-2">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
              </div>
              {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                <p key={j} className="text-[8.5px] text-gray-700 leading-relaxed ml-3">• <BulletContent b={b} color={color} /></p>
              ))}
            </div>
          ))}
        </>
      )}
      {edu.length > 0 && (
        <><SH label="Education" />
          {edu.map((e, i) => (
            <div key={i} className="flex justify-between mb-1.5">
              <p className="text-[9px] font-bold text-gray-900">{str(e.school)} — {str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
              <p className="text-[8.5px] text-gray-700 shrink-0 ml-2">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
            </div>
          ))}
        </>
      )}
      {skills.length > 0 && (
        <><SH label="Skills" />
          {(() => {
            const style = skillsStyleOf(sections);
            return style && style !== "text"
              ? renderSkills(skills, style, "#000000", false)
              : <p className="text-[8.5px] text-gray-700">{skills.map(s => str(s.name)).filter(Boolean).join(" | ")}</p>;
          })()}
        </>
      )}
      {projects.length > 0 && (
        <><SH label="Projects" />
          {projects.map((pr, i) => (
            <p key={i} className="text-[8.5px] text-gray-700 mb-0.5"><strong>{str(pr.name)}</strong>{str(pr.description) ? ` — ${str(pr.description)}` : ""}</p>
          ))}
        </>
      )}
      {certs.length > 0 && (
        <><SH label="Certifications" />
          {certs.map((c, i) => (
            <CertLine key={i} c={c} className="text-[8.5px] text-gray-700 mb-0.5" />
          ))}
        </>
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
    <div className="flex items-center gap-2 mt-4 first:mt-0 mb-2">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color }}>{label}</h2>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );

  return (
    <div className="px-10 py-8" style={{ fontFamily: "Georgia, serif" }}>
      <div className="text-center mb-4 pb-3" style={{ borderBottom: `2px solid ${color}` }}>
        <h1 className="text-[20px] font-bold text-gray-900 tracking-wide">{str(p.name) || "Your Name"}</h1>
        {roleOf(p) && <p className="text-[10px] text-gray-600 italic mt-0.5">{roleOf(p)}</p>}
        <div className="flex justify-center gap-4 mt-2 flex-wrap">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[8px] text-gray-500">{v}</span>
          ))}
        </div>
      </div>

      {str(summary.text) && (
        <><SH label="Research Interests / Summary" />
          <p className="text-[9px] text-gray-700 leading-[1.7] italic">{str(summary.text)}</p>
        </>
      )}

      {edu.length > 0 && (
        <><SH label="Education" />
          {edu.map((e, i) => (
            <div key={i} className="flex justify-between mb-2">
              <div>
                <p className="text-[10px] font-bold text-gray-900">{str(e.degree)}{e.field ? ` in ${str(e.field)}` : ""}</p>
                <p className="text-[9px] italic text-gray-600">{str(e.school)}</p>
                {str(e.gpa) && <p className="text-[8px] text-gray-500">GPA: {str(e.gpa)}</p>}
              </div>
              <p className="text-[8.5px] text-gray-500 shrink-0 ml-3">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
            </div>
          ))}
        </>
      )}

      {exp.length > 0 && (
        <><SH label="Academic & Professional Experience" />
          {exp.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-900">{str(e.title)}</p>
                  <p className="text-[9px] italic text-gray-600">{str(e.company)}{e.location ? `, ${str(e.location)}` : ""}</p>
                </div>
                <p className="text-[8.5px] text-gray-500 shrink-0 ml-3">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
              </div>
              {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                <p key={j} className="text-[8.5px] text-gray-700 ml-3 mt-0.5">• <BulletContent b={b} color={color} /></p>
              ))}
            </div>
          ))}
        </>
      )}

      {projects.length > 0 && (
        <><SH label="Publications & Research Projects" />
          {projects.map((pr, i) => (
            <div key={i} className="mb-2">
              <p className="text-[9px] font-bold text-gray-900">{str(pr.name)}</p>
              {str(pr.description) && <p className="text-[8.5px] italic text-gray-600">{str(pr.description)}</p>}
            </div>
          ))}
        </>
      )}

      <div className="grid grid-cols-2 gap-6 mt-2">
        {skills.length > 0 && (
          <div>
            <SH label="Skills & Methods" />
            {(() => {
              const style = skillsStyleOf(sections);
              return style && style !== "text"
                ? renderSkills(skills, style, color, false)
                : <p className="text-[8.5px] text-gray-700 leading-[1.7]">{skills.map(s => str(s.name)).filter(Boolean).join(", ")}</p>;
            })()}
          </div>
        )}
        {certs.length > 0 && (
          <div>
            <SH label="Certifications" />
            {certs.map((c, i) => (
              <CertLine key={i} c={c} className="text-[8.5px] text-gray-700 mb-0.5" color={color} />
            ))}
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
  const navy = color === "#7c3aed" ? "#1e3a5f" : color;

  return (
    <div style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: navy }}>
        <h1 className="text-[20px] font-black text-white tracking-tight">{str(p.name) || "Your Name"}</h1>
        {roleOf(p) && <p className="text-[9.5px] font-semibold text-white/70 mt-0.5 tracking-wide">{roleOf(p)}</p>}
        <div className="flex gap-5 mt-3 flex-wrap">
          {contactValues(p, color).map((v, i) => (
            <span key={i} className="text-[8px] text-white/60">{v}</span>
          ))}
        </div>
      </div>

      {/* Accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(to right, ${navy}, ${alpha(navy, 0.3)})` }} />

      <div className="px-8 py-5">
        {str(summary.text) && (
          <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${alpha(navy, 0.12)}` }}>
            <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: navy }}>Professional Summary</p>
            <p className="text-[9px] text-gray-600 leading-[1.7]">{str(summary.text)}</p>
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-4">
            <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] mb-2.5" style={{ color: navy }}>Work Experience</p>
            <div className="space-y-3">
              {exp.map((e, i) => (
                <div key={i} className="pl-3" style={{ borderLeft: `3px solid ${alpha(navy, 0.2)}` }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10.5px] font-bold text-gray-900">{str(e.title)}</p>
                      <p className="text-[9px] font-semibold" style={{ color: navy }}>{str(e.company)}{e.location ? ` — ${str(e.location)}` : ""}</p>
                    </div>
                    <p className="text-[8px] text-gray-400 shrink-0 ml-3 mt-0.5 font-medium">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                  </div>
                  {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                    <div key={j} className="flex gap-1.5 mt-1">
                      <span className="text-[7.5px] shrink-0 mt-0.5 font-bold" style={{ color: navy }}>›</span>
                      <p className="text-[8.5px] text-gray-600 leading-[1.55]"><BulletContent b={b} color={color} /></p>
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
              <div className="mb-3">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: navy }}>Education</p>
                {edu.map((e, i) => (
                  <div key={i} className="mb-2 p-2 rounded" style={{ background: alpha(navy, 0.04) }}>
                    <p className="text-[9.5px] font-bold text-gray-900">{str(e.school)}</p>
                    <p className="text-[8.5px] text-gray-600">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                    <p className="text-[7.5px] text-gray-400">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
            {certs.length > 0 && (
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: navy }}>Certifications</p>
                {certs.map((c, i) => (
                  <CertLine key={i} c={c} className="text-[8.5px] text-gray-600 mb-0.5" color={navy} />
                ))}
              </div>
            )}
          </div>
          <div>
            {skills.length > 0 && (
              <div className="mb-3">
                <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: navy }}>Core Skills</p>
                {renderSkills(skills, skillsStyle, navy, false)}
              </div>
            )}
            {projects.length > 0 && (
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: navy }}>Key Projects</p>
                {projects.map((pr, i) => (
                  <div key={i} className="mb-1">
                    <p className="text-[9px] font-bold text-gray-900">{str(pr.name)}</p>
                    {str(pr.description) && <p className="text-[8px] text-gray-500">{str(pr.description)}</p>}
                  </div>
                ))}
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

  return (
    <div className="px-7 py-5" style={{ fontFamily: font }}>
      <div className="flex items-start justify-between mb-2 pb-2" style={{ borderBottom: `2px solid ${color}` }}>
        <div>
          <h1 className="text-[16px] font-black text-gray-950 leading-none">{str(p.name) || "Your Name"}</h1>
          {roleOf(p) && <p className="text-[9px] font-semibold mt-0.5" style={{ color }}>{roleOf(p)}</p>}
        </div>
        <div className="text-right">
          {contactValues(p, color).map((v, i) => (
            <p key={i} className="text-[8px] text-gray-500">{v}</p>
          ))}
        </div>
      </div>

      {str(summary.text) && (
        <p className="text-[8.5px] text-gray-600 leading-[1.6] mb-2">{str(summary.text)}</p>
      )}

      {skills.length > 0 && (() => {
        const style = skillsStyleOf(sections);
        if (style && style !== "text") {
          return (
            <div className="mb-2 pb-2" style={{ borderBottom: `1px solid ${alpha(color, 0.15)}` }}>
              <p className="text-[7.5px] font-bold uppercase tracking-wide mb-1" style={{ color }}>Skills</p>
              {renderSkills(skills, style, color, false)}
            </div>
          );
        }
        return (
          <div className="mb-2 pb-2" style={{ borderBottom: `1px solid ${alpha(color, 0.15)}` }}>
            <span className="text-[7.5px] font-bold uppercase tracking-wide mr-2" style={{ color }}>Skills:</span>
            <span className="text-[8.5px] text-gray-700">{skills.map(s => str(s.name)).filter(Boolean).join("  ·  ")}</span>
          </div>
        );
      })()}

      {exp.length > 0 && (
        <div className="mb-2">
          <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color }}>Experience</p>
          <div className="space-y-2">
            {exp.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-[9.5px] font-bold text-gray-900">{str(e.title)}</p>
                    <p className="text-[8.5px] text-gray-500">@ {str(e.company)}{e.location ? `, ${str(e.location)}` : ""}</p>
                  </div>
                  <p className="text-[7.5px] text-gray-400 shrink-0 ml-2">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Now" : ""}</p>
                </div>
                {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).slice(0, 2).map((b, j) => (
                  <p key={j} className="text-[8px] text-gray-600 leading-[1.5] ml-1">· <BulletContent b={b} color={color} /></p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {edu.length > 0 && (
          <div>
            <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color }}>Education</p>
            {edu.map((e, i) => (
              <div key={i} className="mb-1">
                <p className="text-[9px] font-bold text-gray-900">{str(e.school)}</p>
                <p className="text-[8px] text-gray-500">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                <p className="text-[7.5px] text-gray-400">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
              </div>
            ))}
          </div>
        )}
        <div>
          {projects.length > 0 && (
            <div className="mb-2">
              <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color }}>Projects</p>
              {projects.map((pr, i) => (
                <div key={i} className="mb-0.5">
                  <p className="text-[8.5px] font-semibold text-gray-800">{str(pr.name)}</p>
                  {str(pr.description) && <p className="text-[7.5px] text-gray-500">{str(pr.description)}</p>}
                </div>
              ))}
            </div>
          )}
          {certs.length > 0 && (
            <div>
              <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color }}>Certifications</p>
              {certs.map((c, i) => <CertLine key={i} c={c} className="text-[8px] text-gray-600 mb-0.5" color={color} />)}
            </div>
          )}
        </div>
      </div>
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
    <div className="flex items-center gap-2 mb-2 mt-3 first:mt-0">
      <div className="h-3 w-[3px] rounded-full" style={{ background: color }} />
      <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color }}>{label}</p>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );

  return (
    <div className="flex flex-col" style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Header with photo */}
      <div className="px-8 py-5 flex gap-5 items-center" style={{ background: alpha(color, 0.06), borderBottom: `2px solid ${color}` }}>
        {/* Photo (or initials placeholder) */}
        <div className="h-[72px] w-[60px] shrink-0 rounded overflow-hidden flex items-center justify-center text-[22px] font-black" style={{ background: alpha(color, 0.2), border: `2px solid ${alpha(color, 0.3)}` }}>
          {photo
            ? <img src={photo} alt="" className="h-full w-full object-cover" />
            : <span style={{ color }}>{initialsFor((p.name as string) ?? "")}</span>}
        </div>
        <div className="flex-1">
          <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{str(p.name) || "Your Name"}</h1>
          {roleOf(p) && <p className="text-[9.5px] font-semibold mt-0.5" style={{ color }}>{roleOf(p)}</p>}
        </div>
        <div className="text-right">
          {contactValues(p, color).map((v, i) => (
            <p key={i} className="text-[8.5px] text-gray-500">{v}</p>
          ))}
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left */}
        <div className="w-[210px] shrink-0 px-5 py-4" style={{ background: alpha(color, 0.03), borderRight: `1px solid ${alpha(color, 0.1)}` }}>
          {skills.length > 0 && (
            <>
              <SH label="Skills" />
              {renderSkills(skills, skillsStyle, color, false)}
            </>
          )}

          {edu.length > 0 && (
            <>
              <SH label="Education" />
              {edu.map((e, i) => (
                <div key={i} className="mb-2">
                  <p className="text-[9px] font-semibold text-gray-800">{str(e.school)}</p>
                  <p className="text-[8px] text-gray-500">{str(e.degree)}</p>
                  <p className="text-[7.5px] text-gray-400">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
                </div>
              ))}
            </>
          )}

          {certs.length > 0 && (
            <>
              <SH label="Certifications" />
              {certs.map((c, i) => <CertLine key={i} c={c} className="text-[8px] text-gray-600 mb-0.5" color={color} />)}
            </>
          )}
        </div>

        {/* Right */}
        <div className="flex-1 px-6 py-4">
          {str(summary.text) && (
            <>
              <SH label="Profile" />
              <p className="text-[9px] text-gray-600 leading-[1.7]">{str(summary.text)}</p>
            </>
          )}

          {exp.length > 0 && (
            <>
              <SH label="Work Experience" />
              <div className="space-y-3">
                {exp.map((e, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <p className="text-[10px] font-bold text-gray-900">{str(e.title)}</p>
                      <p className="text-[8px] text-gray-400 shrink-0 ml-2">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                    </div>
                    <p className="text-[8.5px] font-semibold" style={{ color }}>{str(e.company)}{e.location ? `, ${str(e.location)}` : ""}</p>
                    {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                      <div key={j} className="flex gap-1.5 mt-1">
                        <span className="mt-[4px] h-1 w-1 rounded-full shrink-0" style={{ background: color }} />
                        <p className="text-[8.5px] text-gray-600 leading-[1.5]"><BulletContent b={b} color={color} /></p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {projects.length > 0 && (
            <>
              <SH label="Projects" />
              {projects.map((pr, i) => (
                <div key={i} className="mb-1.5">
                  <p className="text-[9.5px] font-bold text-gray-900">{str(pr.name)}</p>
                  {str(pr.description) && <p className="text-[8.5px] text-gray-600">{str(pr.description)}</p>}
                </div>
              ))}
            </>
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
    <div className="flex" style={{ fontFamily: font, minHeight: "100%" }}>
      {/* Left 35% sidebar */}
      <div className="w-[270px] shrink-0 flex flex-col" style={{ background: sidebarBg, minHeight: "100%" }}>
        {/* Avatar + name */}
        <div className="px-6 pt-7 pb-5" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
          <div className="mb-3">
            <Avatar p={p} bg={color} sizeClass="h-16 w-16 text-[22px]" />
          </div>
          <h1 className="text-[14px] font-bold text-gray-900 leading-tight">{str(p.name) || "Your Name"}</h1>
          {roleOf(p) && <p className="text-[8.5px] mt-1 font-medium tracking-wide uppercase" style={{ color }}>{roleOf(p)}</p>}
        </div>

        {/* Contact */}
        <div className="px-6 py-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
          <p className="text-[7px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color }}>Contact</p>
          {contactValues(p, color).map((v, i) => (
            <p key={i} className="text-[8px] text-gray-600 mb-0.5 break-all leading-relaxed">{v}</p>
          ))}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="px-6 py-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.15em] mb-2.5" style={{ color }}>Skills</p>
            {renderSkills(skills, skillsStyle, color, false)}
          </div>
        )}

        {/* Education */}
        {edu.length > 0 && (
          <div className="px-6 py-4" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.15em] mb-2.5" style={{ color }}>Education</p>
            {edu.map((e, i) => (
              <div key={i} className="mb-2.5">
                <p className="text-[9px] font-bold text-gray-900">{str(e.school)}</p>
                <p className="text-[8px] text-gray-600">{str(e.degree)}{e.field ? `, ${str(e.field)}` : ""}</p>
                <p className="text-[7.5px] text-gray-500 mt-0.5">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div className="px-6 py-4">
            <p className="text-[7px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color }}>Certifications</p>
            {certs.map((c, i) => (
              <CertLine key={i} c={c} className="text-[8px] text-gray-600 mb-0.5" color={color} />
            ))}
          </div>
        )}
      </div>

      {/* Right 65% main */}
      <div className="flex-1 px-7 py-7 overflow-hidden">
        {str(summary.text) && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-0.5 w-5 rounded" style={{ background: color }} />
              <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Profile</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <p className="text-[9.5px] text-gray-600 leading-[1.7]">{str(summary.text)}</p>
          </div>
        )}

        {exp.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-0.5 w-5 rounded" style={{ background: color }} />
              <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Experience</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-4">
              {exp.map((e, i) => (
                <div key={i} className="relative pl-4" style={{ borderLeft: `2px solid ${alpha(color, 0.2)}` }}>
                  <div className="absolute -left-[5px] top-[5px] h-2 w-2 rounded-full" style={{ background: color }} />
                  <div className="flex justify-between items-start mb-0.5">
                    <div>
                      <p className="text-[10.5px] font-bold text-gray-900">{str(e.title)}</p>
                      <p className="text-[9px] font-semibold" style={{ color }}>{str(e.company)}{e.location ? ` · ${str(e.location)}` : ""}</p>
                    </div>
                    <p className="text-[7.5px] text-gray-400 shrink-0 ml-3 mt-0.5 bg-gray-50 px-1.5 py-0.5 rounded">{str(e.startDate)}{e.endDate ? ` – ${str(e.endDate)}` : e.startDate ? " – Present" : ""}</p>
                  </div>
                  {items<unknown>(e as SC, "bullets").filter((b) => { const p = bulletParts(b); return p.text || p.label || p.link; }).map((b, j) => (
                    <div key={j} className="flex gap-1.5 mt-1">
                      <span className="mt-[5px] h-1 w-1 rounded-full shrink-0" style={{ background: color }} />
                      <p className="text-[8.5px] text-gray-600 leading-[1.55]"><BulletContent b={b} color={color} /></p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-0.5 w-5 rounded" style={{ background: color }} />
              <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Projects</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {projects.map((pr, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: alpha(color, 0.06), border: `1px solid ${alpha(color, 0.12)}` }}>
                  <p className="text-[9px] font-bold text-gray-900">{str(pr.name)}</p>
                  {str(pr.description) && <p className="text-[8px] text-gray-500 mt-0.5">{str(pr.description)}</p>}
                  {str(pr.url) && <p className="text-[7.5px] mt-0.5" style={{ color }}>{str(pr.url)}</p>}
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
export function ResumePreview({ resume, accentColor, fontScale = 1, fontColor, backgroundColor }: { resume: ResumeDetail; accentColor?: string; fontScale?: number; fontColor?: string; backgroundColor?: string }) {
  const color = accentColor ?? resume.accentColor ?? "#7c3aed";
  const font = resume.fontFamily ?? "Inter, sans-serif";
  const fColor = fontColor ?? resume.fontColor ?? "#111827";
  const bColor = backgroundColor ?? resume.backgroundColor ?? "#ffffff";
  const templateId = resume.templateId ?? "silicon-valley";
  const props = { sections: resume.sections, color, font };

  return (
    <div className="a4-page overflow-hidden relative" style={{ fontFamily: font, backgroundColor: bColor }}>
      {fColor && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .a4-page .text-gray-950, .a4-page .text-gray-900,
            .a4-page .text-gray-800, .a4-page .text-gray-700,
            .a4-page .text-black, .a4-page .text-slate-800,
            .a4-page .text-slate-900 { color: ${fColor}; }

            .a4-page .text-gray-600, .a4-page .text-gray-500,
            .a4-page .text-gray-400, .a4-page .text-slate-600,
            .a4-page .text-slate-500, .a4-page .text-slate-400 { color: ${alpha(fColor, 0.75)}; }

            .a4-page .bg-gray-100, .a4-page .bg-gray-200, 
            .a4-page .bg-gray-300, .a4-page .bg-gray-50, 
            .a4-page .bg-slate-100, .a4-page .bg-slate-200,
            .a4-page .bg-muted { background-color: ${alpha(fColor, 0.15)}; }

            .a4-page .border-gray-100, .a4-page .border-gray-200,
            .a4-page .border-gray-300, .a4-page .border-slate-200,
            .a4-page .border-slate-300, .a4-page .border-border { border-color: ${alpha(fColor, 0.25)}; }

            .a4-page svg circle[stroke="#e5e7eb"], .a4-page svg circle[stroke="rgba(255,255,255,0.18)"] { stroke: ${alpha(fColor, 0.15)}; }
            .a4-page svg text { fill: ${fColor}; }
          `
        }} />
      )}
      <div 
        className="flex flex-col [&>div]:flex-1 [&>div]:w-full"
        style={{ zoom: fontScale, width: "100%", minHeight: `${1123 / fontScale}px` }}
      >
        {templateId === "silicon-valley" && <SiliconValleyTemplate {...props} />}
        {templateId === "faang" && <FaangTemplate {...props} />}
        {templateId === "nova" && <NovaTemplate {...props} />}
        {templateId === "executive-pro" && <ExecutiveProTemplate {...props} />}
        {templateId === "creative-pro" && <CreativeProTemplate {...props} />}
        {templateId === "midnight" && <MidnightTemplate {...props} />}
        {templateId === "ats-clean" && <AtsCleanTemplate sections={resume.sections} color={color} font={font} />}
        {templateId === "academic" && <AcademicTemplate {...props} />}
        {templateId === "corporate-navy" && <CorporateNavyTemplate {...props} />}
        {templateId === "compact" && <CompactTemplate {...props} />}
        {templateId === "european" && <EuropeanTemplate {...props} />}
        {templateId === "two-column" && <TwoColumnTemplate {...props} />}
        {!["silicon-valley","faang","nova","executive-pro","creative-pro","midnight","ats-clean","academic","corporate-navy","compact","european","two-column"].includes(templateId) && (
          <SiliconValleyTemplate {...props} />
        )}
      </div>
    </div>
  );
}
