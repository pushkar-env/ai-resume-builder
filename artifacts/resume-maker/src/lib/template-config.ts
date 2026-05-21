export const TEMPLATE_CONFIG: Record<string, { accent: string; bg: string }> = {
  "silicon-valley": { accent: "#6366f1", bg: "#0f1117" },
  "faang":          { accent: "#0ea5e9", bg: "#f0f9ff" },
  "nova":           { accent: "#64748b", bg: "#f8fafc" },
  "executive-pro":  { accent: "#92400e", bg: "#fffbeb" },
  "creative-pro":   { accent: "#ec4899", bg: "#fdf2f8" },
  "midnight":       { accent: "#d4a853", bg: "#0d1117" },
  "ats-clean":      { accent: "#1f2937", bg: "#f9fafb" },
  "academic":       { accent: "#1e40af", bg: "#eff6ff" },
  "corporate-navy": { accent: "#1e3a5f", bg: "#f0f4f8" },
  "compact":        { accent: "#059669", bg: "#f0fdf4" },
  "european":       { accent: "#7c3aed", bg: "#f5f3ff" },
  "two-column":     { accent: "#e11d48", bg: "#0f1117" },
};

export function getDefaultAccentColor(templateId: string | null | undefined): string {
  if (!templateId) return "#7c3aed";
  return TEMPLATE_CONFIG[templateId]?.accent ?? "#7c3aed";
}
