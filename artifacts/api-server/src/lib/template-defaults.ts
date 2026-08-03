/**
 * Server-side per-template defaults applied when a resume is created without an
 * explicit accent color / font.
 *
 * Ids must match the gallery catalog in `routes/templates.ts` and the client
 * renderer in `resume-maker/src/lib/template-config.ts` — keep the three in sync
 * when a template is added, retired, or renamed.
 */

/** Retired ids → their replacement, mirroring the client's alias map. */
const LEGACY_TEMPLATE_ALIASES: Record<string, string> = {
  midnight: "vanguard",
};

const TEMPLATE_ACCENT_COLORS: Record<string, string> = {
  "silicon-valley": "#000000",
  faang: "#000000",
  nova: "#64748b",
  "executive-pro": "#92400e",
  "creative-pro": "#0d9488",
  vanguard: "#7b2d3b",
  "ats-clean": "#1f2937",
  academic: "#1e40af",
  "corporate-navy": "#1e3a5f",
  compact: "#000000",
  european: "#000000",
  "two-column": "#0d9488",
};

const TEMPLATE_FONTS: Record<string, string> = {
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

export const DEFAULT_ACCENT_COLOR = "#000000";
export const DEFAULT_FONT_FAMILY = "Inter, sans-serif";
export const DEFAULT_FONT_COLOR = "#111827";
export const DEFAULT_BACKGROUND_COLOR = "#ffffff";

/** Map a stored/incoming template id to the id that is actually rendered today. */
export function resolveTemplateId(templateId: string): string {
  return LEGACY_TEMPLATE_ALIASES[templateId] ?? templateId;
}

export function defaultAccentColor(templateId: string): string {
  return (
    TEMPLATE_ACCENT_COLORS[resolveTemplateId(templateId)] ??
    DEFAULT_ACCENT_COLOR
  );
}

export function defaultFontFamily(templateId: string): string {
  return TEMPLATE_FONTS[resolveTemplateId(templateId)] ?? DEFAULT_FONT_FAMILY;
}
