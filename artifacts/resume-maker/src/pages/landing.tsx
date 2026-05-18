import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  FileText,
  Zap,
  Shield,
  Check,
  LayoutTemplate,
  Monitor,
  Download,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { brandJsonLdCore, SEO } from "@/components/shared/SEO";
import { HOME_TITLE, SITE_NAME, SITE_URL } from "@/lib/brand";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "@/lib/plan-features";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TemplatesCarousel } from "@/components/landing/TemplatesCarousel";

const SEO_KEYWORDS =
  "resume builder, AI resume, ATS resume checker, ATS friendly resume, CV maker, professional resume templates, PDF resume, DOCX resume, job application resume, India resume builder";

const faqs = [
  {
    q: "What does “ATS-friendly” mean here?",
    a: "Applicant tracking systems parse your resume automatically. Resumesensei uses clean typography and structure, and Pro includes an ATS score in your dashboard so you can iterate before you submit.",
  },
  {
    q: "Will my PDF match the on-screen preview?",
    a: "Yes. PDF and Word are generated from the same layout you see while editing. On Free, a small Resumesensei footer appears at the bottom of the page; Pro removes it for a completely clean file.",
  },
  {
    q: "Do I need a card to try it?",
    a: "No. Create a free account to build one resume with core AI suggestions and PDF, DOCX, and JSON export. Upgrade to Pro when you want unlimited resumes, watermark-free exports, and full AI.",
  },
  {
    q: "How does Pro pricing work?",
    a: "Pro is billed in INR through our checkout: ₹99 per month or ₹999 per year. See the pricing page for the latest details.",
  },
] as const;

const LANDING_JSON_LD: Record<string, unknown>[] = [
  ...brandJsonLdCore(),
  {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "Online resume builder with AI writing assistance, applicant tracking system (ATS) score tracking on Pro, twelve templates, and PDF, DOCX, and JSON export on every plan.",
    offers: {
      "@type": "Offer",
      price: "99",
      priceCurrency: "INR",
      description: "Pro — monthly billing (yearly plan also available)",
      url: `${SITE_URL}/pricing`,
    },
    featureList: [
      "AI-assisted summaries and bullet points",
      "Twelve professional resume templates",
      "Live A4 preview aligned with export",
      "ATS score tracking on Pro (dashboard)",
      "PDF, DOCX, and JSON export on Free (PDF/Word include a subtle brand footer); Pro is watermark-free",
      "Unlimited resumes and full AI on Pro",
    ],
  },
  {
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  },
];

const capabilities = [
  {
    icon: Sparkles,
    title: "AI-assisted writing",
    description: "Refine summaries and experience bullets with context-aware suggestions.",
  },
  {
    icon: LayoutTemplate,
    title: "12 polished templates",
    description: "Distinct layouts for tech, business, creative roles, and ATS-first designs.",
  },
  {
    icon: Monitor,
    title: "Live A4 preview",
    description: "Edit alongside a faithful preview so layout matches what you export.",
  },
  {
    icon: Gauge,
    title: "ATS score tracking",
    description: "Pro shows how your resume reads to automated screeners so you can iterate before you apply.",
  },
  {
    icon: Download,
    title: "PDF, DOCX & JSON export",
    description: "Free and Pro both export from your live preview. Free adds a minimal footer on PDF and Word; Pro removes it.",
  },
  {
    icon: Zap,
    title: "Fast, focused editor",
    description: "Structured sections, rich text, and a workflow built for real job searches.",
  },
] as const;

const pillars = [
  {
    icon: FileText,
    title: "Structured content",
    body: "Personal details, summary, roles, education, and skills — organized so recruiters scan quickly.",
  },
  {
    icon: Shield,
    title: "ATS-aware design",
    body: "Templates avoid noisy layouts that confuse parsers; Pro adds an ATS score in your dashboard for extra confidence.",
  },
  {
    icon: Monitor,
    title: "Responsive workspace",
    body: "Use Resumesensei on desktop or mobile — edit when you have time, export when you are ready.",
  },
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-clip bg-background text-foreground">
      <SEO
        title={HOME_TITLE}
        description="Build an ATS-friendly resume with AI writing help, 12 templates, and a live A4 preview. Free includes PDF, DOCX, and JSON export with a subtle footer on documents; Pro removes the watermark and unlocks unlimited resumes and full AI."
        canonicalUrl={`${SITE_URL}/`}
        keywords={SEO_KEYWORDS}
        jsonLd={LANDING_JSON_LD}
      />
      <LandingNavbar />

      <main id="main-content">
        {/* Hero */}
        <section className="relative pt-24 pb-16 sm:pt-28 sm:pb-20" aria-labelledby="hero-heading">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[420px] w-[min(100%,720px)] -translate-x-1/2 rounded-[100%] bg-primary/[0.06] blur-3xl" />
          </div>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              AI resume builder
            </motion.p>
            <motion.h1
              id="hero-heading"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.05 }}
              className="text-4xl font-black tracking-tight text-balance sm:text-5xl sm:leading-[1.08]"
            >
              Resumes that read clear, rank well, and{" "}
              <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                ship fast
              </span>
            </motion.h1>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              <span className="font-bold text-foreground">Resumesensei</span> combines structured editing, AI suggestions, ATS score feedback, and exports that match your
              live preview — without clutter.
            </motion.p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.15 }}
              className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
            >
              <Button size="lg" className="h-12 rounded-xl px-8 text-base shadow-sm" asChild>
                <Link href="/sign-up" className="gap-2">
                  Start free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-xl px-8 text-base" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </motion.div>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.2 }}
              className="mt-4 text-xs text-muted-foreground"
            >
              No credit card to start · Free includes PDF, DOCX & JSON (footer on documents); Pro is clean
            </motion.p>
          </div>
        </section>

        {/* Product strip */}
        <section className="border-y border-border/70 bg-muted/15 py-12 sm:py-14" aria-labelledby="product-strip-heading">
          <h2 id="product-strip-heading" className="sr-only">
            Product highlights
          </h2>
          <div className="mx-auto grid max-w-5xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
            {[
              { label: "Editor", sub: "Sections, rich text, undo-friendly" },
              { label: "Preview", sub: "A4 layout you can trust" },
              { label: "Export", sub: "Preview-accurate PDF & Word — Pro is watermark-free" },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-2xl border border-border/80 bg-background/80 px-5 py-6 text-center shadow-sm backdrop-blur-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{cell.label}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{cell.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-16 sm:py-20" aria-labelledby="features-heading">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 id="features-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Everything you need, nothing you don&apos;t
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                A single workspace for drafting, scoring, and exporting — tuned for serious job seekers.
              </p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <li
                  key={item.title}
                  className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-colors hover:border-border"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pillars */}
        <section className="border-t border-border/60 bg-muted/20 py-16 sm:py-20" aria-labelledby="pillars-heading">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 id="pillars-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Built for real applications
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pillars.map((p) => (
                <div key={p.title} className="rounded-2xl border border-border/60 bg-background p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/40">
                    <p.icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-sm font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="py-16 sm:py-24 overflow-hidden" aria-labelledby="templates-heading">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10 text-center">
            <h2 id="templates-heading" className="text-3xl font-black tracking-tight sm:text-4xl mb-4">
              Premium Templates
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground">
              Browse our collection of beautifully designed templates. Pro unlocks every template; Free includes three.
            </p>
          </div>
          <div className="mx-auto max-w-7xl">
            <TemplatesCarousel />
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border/60 py-16 sm:py-20" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 id="faq-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Common questions
            </h2>
            <Accordion type="single" collapsible className="mt-8 w-full rounded-2xl border border-border/80 px-1 sm:px-2">
              {faqs.map((item) => (
                <AccordionItem key={item.q} value={item.q} className="border-border px-3 sm:px-4">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-border/60 bg-muted/15 py-16 sm:py-20" aria-labelledby="pricing-heading">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <h2 id="pricing-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Simple pricing
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
                Start free. Move to Pro when you want unlimited resumes, every template, and full AI.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-border bg-background p-6 sm:p-8">
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try the full workflow</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tight">₹0</span>
                  <span className="text-sm text-muted-foreground">/ forever</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {FREE_PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full rounded-xl" variant="outline" asChild>
                  <Link href="/sign-up">Create free account</Link>
                </Button>
              </div>
              <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-primary/[0.04] p-6 sm:p-8">
                <span className="absolute left-6 top-0 inline-block -translate-y-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Pro
                </span>
                <h3 className="text-lg font-semibold pt-2">Everything unlocked</h3>
                <p className="mt-1 text-sm text-muted-foreground">For active job searches</p>
                <p className="mt-6 text-sm text-muted-foreground">From</p>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-black tracking-tight">₹99</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                  <span className="w-full text-xs text-muted-foreground sm:inline sm:w-auto sm:pl-2">or ₹999 / year</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {PRO_PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full rounded-xl" asChild>
                  <Link href="/pricing">View pricing & upgrade</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-border/60 bg-zinc-950 py-16 text-zinc-50 sm:py-20" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 id="cta-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready when you are
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
              Create an account in seconds. Build your first resume on the free plan, then upgrade if you need more.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="h-12 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100" asChild>
                <Link href="/sign-up" className="gap-2">
                  Get started
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-zinc-600 bg-transparent text-zinc-50 hover:bg-zinc-900 hover:text-zinc-50"
                asChild
              >
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
            <p className="mt-8 text-xs text-zinc-500">
              <Link href="/contact" className="underline-offset-4 hover:text-zinc-300 hover:underline">
                Contact
              </Link>
              <span className="mx-2 text-zinc-600">·</span>
              <Link href="/privacy" className="underline-offset-4 hover:text-zinc-300 hover:underline">
                Privacy
              </Link>
              <span className="mx-2 text-zinc-600">·</span>
              <Link href="/terms" className="underline-offset-4 hover:text-zinc-300 hover:underline">
                Terms
              </Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
