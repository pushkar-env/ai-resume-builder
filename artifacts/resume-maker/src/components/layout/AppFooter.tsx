import { Link } from "wouter";

const SUPPORT_EMAIL = "support@resumesensei.com";

/**
 * Minimal footer for app surfaces (dashboard, templates, contact).
 * Full marketing footer remains on the landing page (`SiteFooter`).
 */
export function AppFooter() {
  return (
    <footer className="mt-auto w-full border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-9">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 text-foreground transition-opacity hover:opacity-90"
          >
            <img
              src={`${import.meta.env.BASE_URL}bluemascot.svg`}
              alt=""
              className="h-9 w-9 object-contain sm:h-10 sm:w-10"
              aria-hidden
            />
            <span className="text-sm font-bold tracking-tight sm:text-base">ResumeSensei</span>
          </Link>

          <nav
            aria-label="Footer"
            className="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2.5 sm:justify-end sm:gap-x-6 sm:gap-y-2"
          >
            <Link
              href="/contact"
              className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground sm:text-left"
            >
              Contact us
            </Link>
            <Link
              href="/privacy"
              className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground sm:text-left"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-center text-sm leading-snug text-muted-foreground underline-offset-4 transition-colors hover:text-foreground sm:text-left"
            >
              Terms &amp; Conditions
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground [overflow-wrap:anywhere] sm:text-left"
            >
              {SUPPORT_EMAIL}
            </a>
          </nav>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground sm:text-left">
          © {new Date().getFullYear()} ResumeSensei. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
