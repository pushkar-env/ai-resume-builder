export const TEMPLATE_CONFIG: Record<string, { accent: string; bg: string }> = {
  "silicon-valley": { accent: "#000000", bg: "#0f1117" },
  faang: { accent: "#000000", bg: "#f8fafc" },
  nova: { accent: "#64748b", bg: "#f8fafc" },
  "executive-pro": { accent: "#92400e", bg: "#fffbeb" },
  "creative-pro": { accent: "#0d9488", bg: "#f0fdfa" },
  midnight: { accent: "#d4a853", bg: "#0d1117" },
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
  midnight: "radial",
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
  midnight: "Manrope, sans-serif",
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
  return TEMPLATE_CONFIG[templateId]?.accent ?? "#000000";
}

export function getDefaultSkillStyle(
  templateId: string | null | undefined,
): string {
  if (!templateId) return "chips";
  return TEMPLATE_DEFAULT_SKILL_STYLES[templateId] ?? "chips";
}

export function getDefaultFontFamily(
  templateId: string | null | undefined,
): string {
  if (!templateId) return "Inter, sans-serif";
  return TEMPLATE_DEFAULT_FONTS[templateId] ?? "Inter, sans-serif";
}

export const TEMPLATE_DEFAULT_ATS_SCORES: Record<string, number> = {
  "silicon-valley": 85,
  faang: 85,
  nova: 85,
  "executive-pro": 85,
  "creative-pro": 85,
  midnight: 85,
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
