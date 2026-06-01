import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Navbar, LandingNavbar } from "./Navbar";
import { SEO } from "@/components/shared/SEO";

function scrollDocumentToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

type LegalPageShellProps = {
  title: string;
  description: string;
  canonicalUrl: string;
  heading: string;
  lastUpdated: string;
  icon: ReactNode;
  children: ReactNode;
};

export function LegalPageShell({
  title,
  description,
  canonicalUrl,
  heading,
  lastUpdated,
  icon,
  children,
}: LegalPageShellProps) {
  const { user, isLoaded } = useUser();
  const [location] = useLocation();
  const TopNav = !isLoaded || !user ? LandingNavbar : Navbar;

  useLayoutEffect(() => {
    scrollDocumentToTop();
    const id = window.requestAnimationFrame(() => {
      scrollDocumentToTop();
    });
    const t = window.setTimeout(scrollDocumentToTop, 0);
    const t2 = window.setTimeout(scrollDocumentToTop, 150);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [location]);

  return (
    <div className="min-h-screen min-w-0 w-full max-w-[100vw] bg-background flex flex-col overflow-x-clip">
      <SEO
        title={title}
        description={description}
        canonicalUrl={canonicalUrl}
      />
      <TopNav />

      <div className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 mb-4 text-primary">
            {icon}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-balance px-1 break-words">
            {heading}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full min-w-0 max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline break-words [overflow-wrap:anywhere]">
          {children}
        </article>
      </main>
    </div>
  );
}
