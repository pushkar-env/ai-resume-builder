/**
 * Single source of truth for resume-template rendering config.
 *
 * Everything client-side that is keyed by template id derives from this array:
 * the accent/bg/font/skill-style maps in `template-config.ts`, the component
 * lookup + sidebar-fill in `ResumePreview.tsx`, and the auto-fit floor in
 * `ResumePagedView.tsx`. Adding a template = one entry here + one component
 * registration — no more parallel id lists to keep in sync.
 *
 * NOTE: the server gallery catalog (`api-server/src/routes/templates.ts`) lives
 * in a different package and stays its own list; ids must match what's here.
 */

export type SkillStyle = "bars" | "chips" | "radial" | "bullets" | "text";

export interface ResumeTemplateDef {
  id: string;
  /** Default accent color applied on create + used by the preview fallback. */
  accent: string;
  /** Gallery card background (thumbnail surface), not the page background. */
  bg: string;
  /** Default font-family stack. */
  font: string;
  /** Default skill-section render style. */
  skillStyle: SkillStyle;
  /** Full dark-page template (page bg + light text defaults). */
  dark?: boolean;
  /**
   * Lower bound for auto-fit font compression (default 0.82). Dense templates
   * may compress further so they pack onto fewer pages; spacious templates keep
   * the higher floor to stay readable.
   */
  autoFitFloor?: number;
  /** Two-column templates: continuous sidebar fill painted in paginated mode. */
  sidebar?: { widthPx: number; alpha: number };
  /** Advertised baseline ATS score (default 85). */
  atsScore?: number;
}

export const RESUME_TEMPLATES: ResumeTemplateDef[] = [
  // ─── Existing 12 (values preserved exactly) ───
  {
    id: "silicon-valley",
    accent: "#000000",
    bg: "#0f1117",
    font: "Merriweather, serif",
    skillStyle: "bullets",
    sidebar: { widthPx: 240, alpha: 0.05 },
  },
  { id: "faang", accent: "#000000", bg: "#f8fafc", font: "Manrope, sans-serif", skillStyle: "chips" },
  { id: "nova", accent: "#64748b", bg: "#f8fafc", font: "Poppins, sans-serif", skillStyle: "text" },
  { id: "executive-pro", accent: "#92400e", bg: "#fffbeb", font: "Merriweather, serif", skillStyle: "bars" },
  {
    id: "creative-pro",
    accent: "#0d9488",
    bg: "#f0fdfa",
    font: "Poppins, sans-serif",
    skillStyle: "chips",
    sidebar: { widthPx: 220, alpha: 0.08 },
  },
  { id: "midnight", accent: "#d4a853", bg: "#0d1117", font: "Manrope, sans-serif", skillStyle: "radial", dark: true },
  { id: "ats-clean", accent: "#1f2937", bg: "#f9fafb", font: "Merriweather, serif", skillStyle: "bullets" },
  { id: "academic", accent: "#1e40af", bg: "#eff6ff", font: "Merriweather, serif", skillStyle: "text" },
  { id: "corporate-navy", accent: "#1e3a5f", bg: "#f0f4f8", font: "Inter, sans-serif", skillStyle: "bars" },
  { id: "compact", accent: "#000000", bg: "#f8fafc", font: "Merriweather, serif", skillStyle: "bullets" },
  {
    id: "european",
    accent: "#000000",
    bg: "#f8fafc",
    font: "Inter, sans-serif",
    skillStyle: "radial",
    sidebar: { widthPx: 230, alpha: 0.03 },
  },
  {
    id: "two-column",
    accent: "#0d9488",
    bg: "#0f1117",
    font: "Manrope, sans-serif",
    skillStyle: "bullets",
    sidebar: { widthPx: 280, alpha: 0.05 },
  },

  // ─── New 6 ───
  // ATS-optimised, maximally parseable (free)
  { id: "crisp-ats", accent: "#1f2937", bg: "#ffffff", font: "Inter, sans-serif", skillStyle: "text", atsScore: 96 },
  // Compact single-page (free)
  { id: "onyx-compact", accent: "#111827", bg: "#ffffff", font: "Inter, sans-serif", skillStyle: "bullets", autoFitFloor: 0.76, atsScore: 90 },
  // Business / Executive (premium)
  { id: "boardroom", accent: "#334155", bg: "#ffffff", font: "Merriweather, serif", skillStyle: "bullets" },
  // Graphic / creative designer — two-column, bold accent sidebar (premium)
  {
    id: "studio",
    accent: "#7c3aed",
    bg: "#faf5ff",
    font: "Poppins, sans-serif",
    skillStyle: "chips",
    sidebar: { widthPx: 250, alpha: 0.1 },
  },
  // Modern versatile — two-column, neutral sidebar (premium)
  {
    id: "meridian",
    accent: "#2563eb",
    bg: "#ffffff",
    font: "Manrope, sans-serif",
    skillStyle: "bars",
    sidebar: { widthPx: 250, alpha: 0.05 },
  },
  // Info-dense, fits lots of content (premium)
  { id: "dossier", accent: "#475569", bg: "#ffffff", font: "Inter, sans-serif", skillStyle: "bullets", autoFitFloor: 0.76 },
];

/** Fast lookup by id. */
export const RESUME_TEMPLATE_BY_ID: Record<string, ResumeTemplateDef> =
  Object.fromEntries(RESUME_TEMPLATES.map((t) => [t.id, t]));

export const RESUME_TEMPLATE_IDS: string[] = RESUME_TEMPLATES.map((t) => t.id);

export const DEFAULT_AUTO_FIT_FLOOR = 0.82;

export function getTemplateDef(id: string | null | undefined): ResumeTemplateDef | undefined {
  if (!id) return undefined;
  return RESUME_TEMPLATE_BY_ID[id];
}

export function getAutoFitFloor(id: string | null | undefined): number {
  return getTemplateDef(id)?.autoFitFloor ?? DEFAULT_AUTO_FIT_FLOOR;
}

export function isDarkTemplate(id: string | null | undefined): boolean {
  return getTemplateDef(id)?.dark === true;
}
