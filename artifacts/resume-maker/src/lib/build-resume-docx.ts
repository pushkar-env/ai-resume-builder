import type { ResumeDetail, ResumeSection } from "@workspace/api-client-react";
import { snapFontScale } from "@/lib/resume-font-scale";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";

type SC = Record<string, unknown>;
type Item = Record<string, unknown>;

const BULLET_REF = "resume-export-bullets";
/** Word OOXML text must not contain certain control characters. */
const XML_TEXT_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const MAX_RUN_CHARS = 32_000;

function str(v: unknown): string {
  return (v as string) ?? "";
}

/** Strips characters illegal in WordprocessingML runs and caps extreme length. */
function sanitizeWordText(input: string): string {
  let s = input
    .replace(XML_TEXT_CONTROL, "")
    .replace(/\u00ad/g, "");
  if (s.length > MAX_RUN_CHARS) s = `${s.slice(0, MAX_RUN_CHARS)}…`;
  return s;
}

function hexToWordColor(hex: string): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 6) return h.toUpperCase();
  if (h.length === 3) return [...h].map((c) => c + c).join("").toUpperCase();
  return "4472C4";
}

function sortedSections(sections: ResumeDetail["sections"]): ResumeSection[] {
  return [...(sections ?? [])]
    .filter((s) => s.isVisible !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

function contentByType(ordered: ResumeSection[], type: string): SC | undefined {
  const sec = ordered.find((s) => s.type === type);
  return sec?.content as SC | undefined;
}

function skillsStyleFromOrdered(ordered: ResumeSection[]): string | undefined {
  const sec = ordered.find((s) => s.type === "skills");
  return ((sec?.content as SC | undefined)?.style as string | undefined);
}

function items<T = Item>(sc: SC | undefined, key = "items"): T[] {
  return ((sc?.[key] ?? []) as T[]);
}

function roleOf(p: SC): string {
  return ((p.jobTitle as string) || (p.title as string) || "").trim();
}

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

function htmlToPlainParagraphs(html: string, runSize: number, font: string): Paragraph[] {
  const raw = html.trim();
  if (!raw) return [];
  const normalized = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
  let text = "";
  if (typeof DOMParser !== "undefined") {
    try {
      const parsed = new DOMParser().parseFromString(`<div>${normalized}</div>`, "text/html");
      const docErr = parsed.querySelector("parsererror");
      text = docErr ? normalized.replace(/<[^>]+>/g, " ") : (parsed.body.textContent ?? "");
    } catch {
      text = normalized.replace(/<[^>]+>/g, " ");
    }
  } else {
    text = normalized.replace(/<[^>]+>/g, " ");
  }
  const lines = text
    .split(/\n+/)
    .map((l) => sanitizeWordText(l.replace(/\s+/g, " ").trim()))
    .filter(Boolean);
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: line, size: runSize, font })],
      }),
  );
}

function htmlToPlainText(html: string): string {
  if (!html.trim()) return "";
  const normalized = html.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ");
  let plain = "";
  if (typeof DOMParser !== "undefined") {
    try {
      const parsed = new DOMParser().parseFromString(`<div>${normalized}</div>`, "text/html");
      const docErr = parsed.querySelector("parsererror");
      plain = docErr ? normalized.replace(/<[^>]+>/g, " ") : (parsed.body.textContent ?? "");
    } catch {
      plain = normalized.replace(/<[^>]+>/g, " ");
    }
  } else {
    plain = normalized.replace(/<[^>]+>/g, " ");
  }
  return sanitizeWordText(plain.replace(/\s+/g, " ").trim());
}

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

/** Returns http(s) URL or null (blocks javascript:, data:, etc.). */
function safeExternalHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function linkParagraph(opts: {
  display: string;
  rawUrl: string;
  font: string;
  spacingAfter: number;
  indentInches?: number;
  textSize?: number;
}): Paragraph {
  const { display, rawUrl, font, spacingAfter, indentInches, textSize = 20 } = opts;
  const safe = safeExternalHref(rawUrl);
  const indent = indentInches !== undefined ? { left: convertInchesToTwip(indentInches) } : undefined;
  const label = sanitizeWordText(display || safe || rawUrl);
  if (safe) {
    return new Paragraph({
      spacing: { after: spacingAfter },
      indent,
      children: [
        new ExternalHyperlink({
          children: [new TextRun({ text: label || safe, style: "Hyperlink", size: textSize, font })],
          link: safe,
        }),
      ],
    });
  }
  return new Paragraph({
    spacing: { after: spacingAfter },
    indent,
    children: [new TextRun({ text: label || sanitizeWordText(rawUrl), size: textSize, font })],
  });
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
  const legacy: Social[] = [];
  if (str(p.github).trim()) legacy.push({ label: "GitHub", url: str(p.github).trim() });
  if (str(p.linkedin).trim()) legacy.push({ label: "LinkedIn", url: str(p.linkedin).trim() });
  if (str(p.twitter).trim()) legacy.push({ label: "Twitter", url: str(p.twitter).trim() });
  return legacy;
}

function wordPrimaryFont(fontStack: string): string {
  const first = fontStack.split(",")[0]?.replace(/['"]/g, "").trim() || "Calibri";
  const lower = first.toLowerCase();
  if (lower.includes("mono")) return "Consolas";
  if (
    lower.includes("serif") ||
    lower.includes("georgia") ||
    lower.includes("merriweather") ||
    lower.includes("garamond") ||
    lower.includes("lora") ||
    lower.includes("playfair")
  ) {
    return "Georgia";
  }
  return "Calibri";
}

function sectionHeading(text: string, accent: string, font: string, fs: (n: number) => number): Paragraph {
  const color = hexToWordColor(accent);
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { color: "CCCCCC", style: BorderStyle.SINGLE, size: 6, space: 1 },
    },
    children: [new TextRun({ text: sanitizeWordText(text), bold: true, size: fs(24), color, font, allCaps: true })],
  });
}

/**
 * Builds a real .docx (OOXML) from resume JSON. Word cannot reliably render Tailwind/HTML exports;
 * this path uses structured paragraphs so layouts stay stable across Word versions and desktop/mobile browsers.
 */
export async function buildResumeDocxBlob(
  resume: ResumeDetail,
  options?: { includeWatermark?: boolean; fontScale?: number },
): Promise<Blob> {
  const includeWatermark = options?.includeWatermark === true;
  const fontScale = snapFontScale(options?.fontScale ?? 1);
  const fs = (halfPoints: number) =>
    Math.min(96, Math.max(14, Math.round(halfPoints * fontScale)));
  const accent = resume.accentColor ?? "#4472C4";
  const accentHex = hexToWordColor(accent);
  const font = wordPrimaryFont(resume.fontFamily ?? "Calibri");
  const ordered = sortedSections(resume.sections);

  const personal = contentByType(ordered, "personal") ?? {};
  const summary = contentByType(ordered, "summary") ?? {};
  const experience = items<Item>(contentByType(ordered, "experience"));
  const education = items<Item>(contentByType(ordered, "education"));
  const skills = items<Item>(contentByType(ordered, "skills"));
  const projects = items<Item>(contentByType(ordered, "projects"));
  const certs = items<Item>(contentByType(ordered, "certifications"));

  const body: Paragraph[] = [];

  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: sanitizeWordText(str(personal.name) || "Resume"), bold: true, size: fs(52), font })],
    }),
  );

  const role = roleOf(personal);
  if (role) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({ text: sanitizeWordText(role), size: fs(28), color: accentHex, font })],
      }),
    );
  }

  const contactParts: string[] = [];
  if (str(personal.email).trim()) contactParts.push(sanitizeWordText(str(personal.email).trim()));
  if (str(personal.phone).trim()) contactParts.push(sanitizeWordText(str(personal.phone).trim()));
  if (str(personal.location).trim()) contactParts.push(sanitizeWordText(str(personal.location).trim()));
  for (const s of socialsList(personal)) {
    const bit = s.url ? `${s.label}: ${s.url}` : s.label;
    contactParts.push(sanitizeWordText(bit));
  }
  if (contactParts.length > 0) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: contactParts.join("  |  "), size: fs(20), font })],
      }),
    );
  }

  if (str(summary.text).trim()) {
    body.push(sectionHeading("Professional summary", accent, font, fs));
    body.push(...htmlToPlainParagraphs(str(summary.text), fs(22), font));
  }

  if (experience.length > 0) {
    body.push(sectionHeading("Experience", accent, font, fs));
    for (const e of experience) {
      const dates = `${str(e.startDate)}${e.endDate ? ` – ${str(e.endDate)}` : str(e.startDate) ? " – Present" : ""}`;
      body.push(
        new Paragraph({
          spacing: { before: 200, after: 40 },
          children: [new TextRun({ text: sanitizeWordText(str(e.title)), bold: true, size: fs(24), font })],
        }),
      );
      const companyLine = `${str(e.company)}${e.location ? ` · ${str(e.location)}` : ""}`;
      const companyAndDates = dates ? `${companyLine}  (${dates})` : companyLine;
      body.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: sanitizeWordText(companyAndDates), size: fs(22), font })],
        }),
      );

      for (const b of items<unknown>(e as SC, "bullets")) {
        const { text, label, link } = bulletParts(b);
        if (!text && !label && !link) continue;
        const main = htmlToPlainText(text || label || "");
        if (main) {
          body.push(
            new Paragraph({
              numbering: { reference: BULLET_REF, level: 0 },
              spacing: { after: 40 },
              children: [new TextRun({ text: main, size: fs(22), font })],
            }),
          );
        }
        if (link) {
          body.push(
            linkParagraph({
              display: label || link,
              rawUrl: link,
              font,
              spacingAfter: 60,
              indentInches: 0.35,
              textSize: fs(20),
            }),
          );
        } else if (label && !link && text) {
          body.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.35) },
              spacing: { after: 60 },
              children: [
                new TextRun({ text: sanitizeWordText(`— ${label}`), italics: true, size: fs(20), color: accentHex, font }),
              ],
            }),
          );
        }
      }
    }
  }

  if (education.length > 0) {
    body.push(sectionHeading("Education", accent, font, fs));
    for (const e of education) {
      body.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [new TextRun({ text: sanitizeWordText(str(e.school)), bold: true, size: fs(24), font })],
        }),
      );
      const parts = [str(e.degree), str(e.field)].filter(Boolean);
      if (parts.length > 0) {
        body.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: sanitizeWordText(parts.join(", ")), size: fs(22), font })],
          }),
        );
      }
      const dates = `${str(e.startDate)}${e.endDate ? ` – ${str(e.endDate)}` : ""}`.trim();
      if (dates) {
        body.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: sanitizeWordText(dates), size: fs(20), color: "666666", font })],
          }),
        );
      }
      if (str(e.gpa)) {
        body.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: sanitizeWordText(`GPA: ${str(e.gpa)}`), size: fs(20), font })],
          }),
        );
      }
    }
  }

  if (skills.length > 0) {
    const style = skillsStyleFromOrdered(ordered) ?? "chips";
    const hasNamedSkill = skills.some((s) => str(s.name).trim());
    if (hasNamedSkill) {
      body.push(sectionHeading("Skills", accent, font, fs));
      if (style === "text" || (style !== "bars" && style !== "radial")) {
        const line = sanitizeWordText(skills.map((s) => str(s.name)).filter(Boolean).join(", "));
        if (line) body.push(new Paragraph({ children: [new TextRun({ text: line, size: fs(22), font })] }));
      } else {
        for (const s of skills) {
          const nm = str(s.name).trim();
          if (!nm) continue;
          const pct = skillPct(s.level);
          body.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: sanitizeWordText(`${nm} — ${pct}%`), size: fs(22), font })],
            }),
          );
        }
      }
    }
  }

  if (projects.length > 0) {
    body.push(sectionHeading("Projects", accent, font, fs));
    for (const pr of projects) {
      body.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [new TextRun({ text: sanitizeWordText(str(pr.name)), bold: true, size: fs(24), font })],
        }),
      );
      const url = str(pr.url).trim();
      if (url) {
        body.push(
          linkParagraph({
            display: url,
            rawUrl: url,
            font,
            spacingAfter: 60,
            textSize: fs(20),
          }),
        );
      }
      body.push(...htmlToPlainParagraphs(str(pr.description), fs(22), font));
    }
  }

  if (certs.length > 0) {
    body.push(sectionHeading("Certifications", accent, font, fs));
    for (const c of certs) {
      let line = str(c.name);
      if (str(c.issuer)) line += ` — ${str(c.issuer)}`;
      if (c.date) line += ` (${str(c.date)})`;
      body.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: sanitizeWordText(line), size: fs(22), font })],
        }),
      );
      const credUrl = (str(c.credentialUrl) || str(c.url)).trim();
      if (credUrl) {
        body.push(
          linkParagraph({
            display: "Credential link",
            rawUrl: credUrl,
            font,
            spacingAfter: 80,
            textSize: fs(20),
          }),
        );
      }
    }
  }

  if (includeWatermark) {
    const site = "https://resumesensei.com/";
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({ text: "Created at ", size: fs(16), color: "94A3B8", font }),
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: "resumesensei.com",
                style: "Hyperlink",
                size: fs(16),
                font,
              }),
            ],
            link: site,
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: "AI Resume Builder",
    title: sanitizeWordText(resume.title || "Resume").slice(0, 255),
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.65),
              right: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.65),
              left: convertInchesToTwip(0.7),
            },
          },
        },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
