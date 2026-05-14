/** Single source of truth for plan bullets — keep landing, billing, and pricing in sync. */
export const FREE_PLAN_FEATURES = [
  "1 resume",
  "3 templates",
  "PDF, DOCX & JSON export (subtle footer on PDF & Word)",
  "Basic AI suggestions",
] as const;

export const PRO_PLAN_FEATURES = [
  "Unlimited resumes",
  "All 12 templates",
  "Unlimited AI assistance",
  "Watermark-free PDF & Word exports",
  "ATS score tracking",
  "Priority support",
] as const;
