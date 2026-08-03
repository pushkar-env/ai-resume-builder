/**
 * Retired template ids → their replacement.
 *
 * Resumes persist `templateId`, so removing a template would leave saved rows
 * pointing at an id nothing renders (they'd silently fall back to the default
 * template). Aliasing keeps those resumes on a deliberate successor design.
 */
export const LEGACY_TEMPLATE_ALIASES: Record<string, string> = {
  // "Midnight Luxe" (dark page + gold) replaced by the Vanguard Elite premium ATS layout.
  midnight: "vanguard",
};

/** Map a stored template id to the id that is actually rendered today. */
export function resolveTemplateId<T extends string | null | undefined>(
  templateId: T,
): T | string {
  if (!templateId) return templateId;
  return LEGACY_TEMPLATE_ALIASES[templateId] ?? templateId;
}

/**
 * Accent color a retired template shipped with, so a resume still carrying it can
 * be recognised as "never customised" rather than a deliberate choice.
 */
const RETIRED_TEMPLATE_DEFAULT_ACCENTS: Record<string, string> = {
  // Midnight's gold was drawn on a near-black page; on the successor's white page
  // it lands around 1.9:1 against the background, well under WCAG AA.
  midnight: "#d4a853",
};

/**
 * Accent to render for a stored resume. Resumes created from a retired template
 * kept that template's default accent, which was tuned for a design that no
 * longer exists — swap it for the successor's default. An accent the user
 * actually picked (anything other than the retired default) is left untouched.
 */
export function resolveAccentColor(
  templateId: string | null | undefined,
  accentColor: string | null | undefined,
): string | null | undefined {
  if (!templateId || !accentColor) return accentColor;
  const retiredDefault = RETIRED_TEMPLATE_DEFAULT_ACCENTS[templateId];
  if (!retiredDefault) return accentColor;
  return accentColor.toLowerCase() === retiredDefault.toLowerCase()
    ? getDefaultAccentColor(templateId)
    : accentColor;
}

export const TEMPLATE_CONFIG: Record<string, { accent: string; bg: string }> = {
  "silicon-valley": { accent: "#000000", bg: "#0f1117" },
  faang: { accent: "#000000", bg: "#f8fafc" },
  nova: { accent: "#64748b", bg: "#f8fafc" },
  "executive-pro": { accent: "#92400e", bg: "#fffbeb" },
  "creative-pro": { accent: "#0d9488", bg: "#f0fdfa" },
  vanguard: { accent: "#7b2d3b", bg: "#ffffff" },
  "ats-clean": { accent: "#1f2937", bg: "#f9fafb" },
  academic: { accent: "#1e40af", bg: "#eff6ff" },
  "corporate-navy": { accent: "#1e3a5f", bg: "#f0f4f8" },
  compact: { accent: "#000000", bg: "#f8fafc" },
  european: { accent: "#000000", bg: "#f8fafc" },
  "two-column": { accent: "#0d9488", bg: "#0f1117" },
};

export const TEMPLATE_DEFAULT_SKILL_STYLES: Record<string, string> = {
  "silicon-valley": "bullets",
  faang: "chips",
  nova: "text",
  "executive-pro": "bars",
  "creative-pro": "chips",
  vanguard: "grouped",
  "ats-clean": "bullets",
  academic: "text",
  "corporate-navy": "bars",
  compact: "bullets",
  european: "radial",
  "two-column": "bullets",
};

export const TEMPLATE_DEFAULT_FONTS: Record<string, string> = {
  "silicon-valley": "Merriweather, serif",
  faang: "Manrope, sans-serif",
  nova: "Poppins, sans-serif",
  "executive-pro": "Merriweather, serif",
  "creative-pro": "Poppins, sans-serif",
  vanguard: "Manrope, sans-serif",
  "ats-clean": "Merriweather, serif",
  academic: "Merriweather, serif",
  "corporate-navy": "Inter, sans-serif",
  compact: "Merriweather, serif",
  european: "Inter, sans-serif",
  "two-column": "Manrope, sans-serif",
};

export function getDefaultAccentColor(
  templateId: string | null | undefined,
): string {
  if (!templateId) return "#000000";
  return TEMPLATE_CONFIG[resolveTemplateId(templateId)]?.accent ?? "#000000";
}

export function getDefaultSkillStyle(
  templateId: string | null | undefined,
): string {
  if (!templateId) return "chips";
  return (
    TEMPLATE_DEFAULT_SKILL_STYLES[resolveTemplateId(templateId)] ?? "chips"
  );
}

export function getDefaultFontFamily(
  templateId: string | null | undefined,
): string {
  if (!templateId) return "Inter, sans-serif";
  return (
    TEMPLATE_DEFAULT_FONTS[resolveTemplateId(templateId)] ?? "Inter, sans-serif"
  );
}

export const TEMPLATE_DEFAULT_ATS_SCORES: Record<string, number> = {
  "silicon-valley": 85,
  faang: 85,
  nova: 85,
  "executive-pro": 85,
  "creative-pro": 85,
  vanguard: 85,
  "ats-clean": 85,
  academic: 85,
  "corporate-navy": 85,
  compact: 85,
  european: 85,
  "two-column": 85,
};

export function getDefaultAtsScore(
  templateId: string | null | undefined,
): number {
  return 85;
}
