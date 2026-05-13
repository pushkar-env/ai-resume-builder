/** Single source of truth for plan bullets — keep landing, billing, and pricing in sync. */
export const FREE_PLAN_FEATURES = [
  "1 resume",
  "3 templates",
  "PDF export",
  "Basic AI suggestions",
] as const;

export const PRO_PLAN_FEATURES = [
  "Unlimited resumes",
  "All 12 templates",
  "PDF, DOCX & JSON export",
  "Unlimited AI assistance",
  "ATS score tracking",
  "Priority support",
] as const;
