import { Link } from "wouter";
import {
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Mail,
  Shield,
  Zap,
  Smartphone,
} from "lucide-react";

const SUPPORT_EMAIL = "support@resumesensei.com";

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-auto w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-8 lg:gap-10">
          <div className="text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-2 font-semibold text-foreground">
              <img
                src={`${import.meta.env.BASE_URL}bluemascot.svg`}
                alt="ResumeSensei mascot"
                className="h-10 w-10 object-contain shrink-0"
              />
              <span className="text-base font-bold tracking-tight">ResumeSensei</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto sm:mx-0">
              An AI resume coach with ATS insights, modern templates, and exports that match your live preview.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <a
                className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                href="#"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                href="#"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                href="#"
                aria-label="YouTube"
              >
                <Youtube className="h-4 w-4" />
              </a>
              <a
                className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                href="#"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors inline-block">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="hover:text-foreground transition-colors inline-block">
                  Get started
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-foreground transition-colors inline-block">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/templates" className="hover:text-foreground transition-colors inline-block">
                  Templates
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors inline-block">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors inline-block">
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold">Resources</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="inline-flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <Shield className="h-4 w-4 shrink-0" /> ATS-friendly templates
                </span>
              </li>
              <li>
                <span className="inline-flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <Zap className="h-4 w-4 shrink-0" /> Live preview export
                </span>
              </li>
              <li>
                <span className="inline-flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <Smartphone className="h-4 w-4 shrink-0" /> Mobile-first editor
                </span>
              </li>
            </ul>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center justify-center sm:justify-start gap-2 hover:text-foreground transition-colors break-all"
                >
                  <Mail className="h-4 w-4 shrink-0" /> {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors inline-block">
                  Contact us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="max-w-prose px-1 leading-relaxed">
            © {new Date().getFullYear()} ResumeSensei. All rights reserved.
          </p>
          <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:w-auto sm:max-w-none sm:justify-end">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
