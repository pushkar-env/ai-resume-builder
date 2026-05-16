/** Canonical brand strings for UI, metadata, and structured data. */
export const SITE_NAME = "Resumesensei";
export const SITE_URL = "https://resumesensei.com";
export const SITE_TAGLINE = "AI Resume Builder & ATS Resume Checker";
export const HOME_TITLE = `${SITE_NAME} | ${SITE_TAGLINE}`;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
export const BRAND_LOGO_PNG = `${SITE_URL}/android-chrome-192x192.png`;

/** Page title suffix, e.g. `pageTitle("Dashboard")` → `Dashboard | Resumesensei`. */
export function pageTitle(page: string): string {
  if (page.includes("|")) return page;
  return `${page} | ${SITE_NAME}`;
}
