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
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { brandJsonLdCore, SEO } from "@/components/shared/SEO";
import { HOME_TITLE, SITE_NAME, SITE_URL } from "@/lib/brand";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "@/lib/plan-features";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TemplatesCarousel } from "@/components/landing/TemplatesCarousel";
import { Testimonials } from "@/components/landing/Testimonials";

const SEO_KEYWORDS =
  "resume builder, AI resume, ATS resume checker, ATS friendly resume, CV maker, professional resume templates, PDF resume, DOCX resume, job application resume, India resume builder, import resume, highly customizable templates, AI powered resume";

const faqs = [
  {
    q: "What does “ATS-friendly” mean here?",
    a: "Applicant tracking systems parse resumes automatically. Resumesensei templates are specifically designed to be easily parsed, and Pro includes a built-in AI ATS Auditor to grade and optimize your content for specific job descriptions.",
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
      "Online resume & cover letter builder with AI writing help, AI-powered ATS Auditor & score tracker on Pro, twelve templates, and PDF & Word export on every plan.",
    offers: {
      "@type": "Offer",
      price: "99",
      priceCurrency: "INR",
      description: "Pro — monthly billing (yearly plan also available)",
      url: `${SITE_URL}/pricing`,
    },
    featureList: [
      "AI-powered resume & cover letter generation",
      "Import existing PDF or DOCX resumes",
      "Highly customizable templates with matching cover letters",
      "Live A4 preview aligned with PDF/Word export",
      "AI-powered ATS Auditor & Score Tracker on Pro",
      "Watermark-free PDF & Word export on Pro",
      "Unlimited resumes & cover letters on Pro",
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
    icon: Upload,
    title: "Import existing resume",
    description:
      "Upload your old PDF or DOCX and let our parser structure it into your new layout instantly.",
  },
  {
    icon: Sparkles,
    title: "AI Resume & Cover Letters",
    description:
      "Refine resume bullets or generate customized cover letters tailored to specific jobs in one click.",
  },
  {
    icon: LayoutTemplate,
    title: "Highly customizable templates",
    description:
      "Distinct, premium layouts with customizable fonts, spacing, and colors to match your brand.",
  },
  {
    icon: Monitor,
    title: "Live A4 preview",
    description:
      "Edit alongside a faithful preview so layout exactly matches what you export.",
  },
  {
    icon: Gauge,
    title: "AI ATS Auditor & Scraper",
    description:
      "Pro scans resumes & cover letters against job descriptions, scrapes details from links, and scores compatibility.",
  },
  {
    icon: Download,
    title: "PDF & Word export",
    description:
      "Free and Pro both export from your live preview. Free adds a minimal footer; Pro removes it.",
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
    body: "Templates avoid layouts that confuse parsers. Scan and optimize your content against job descriptions with the built-in AI ATS Auditor.",
  },
  {
    icon: Monitor,
    title: "Responsive workspace",
    body: "Use Resumesensei on desktop or mobile — edit when you have time, export when you are ready.",
  },
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-clip bg-background text-foreground">
      <SEO
        title={HOME_TITLE}
        description="Build an ATS-friendly resume & cover letter with AI writing help, premium templates, and live preview. Free includes PDF & Word exports; Pro removes watermarks and unlocks unlimited documents, job scraping, and AI ATS auditing."
        canonicalUrl={`${SITE_URL}/`}
        keywords={SEO_KEYWORDS}
        jsonLd={LANDING_JSON_LD}
      />
      <LandingNavbar />

      <main id="main-content">
        {/* Hero */}
        <section
          className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            <div className="absolute top-[-10%] left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]" />
            <div className="absolute top-[20%] left-[20%] h-[300px] w-[300px] rounded-full bg-indigo-500/10 blur-[80px]" />
            <div className="absolute top-[30%] right-[20%] h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[100px]" />
          </div>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium tracking-wide text-primary shadow-sm backdrop-blur-sm"
            >
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              AI-powered Resume & Cover Letter Builder
            </motion.p>
            <motion.h1
              id="hero-heading"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.05 }}
              className="text-4xl font-black tracking-tight text-balance sm:text-5xl sm:leading-[1.08]"
            >
              Resumes & Cover Letters that read clear, rank well, and{" "}
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
              <span className="font-extrabold text-foreground">
                Resume<span className="text-primary font-black">sensei</span>
              </span>{" "}
              combines structured editing, AI cover letter generation, AI ATS auditing & scoring,
              and exports that match your live preview — without clutter.
            </motion.p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.15 }}
              className="mt-9 flex flex-col items-center justify-center sm:flex-row"
            >
              <Button
                size="lg"
                className="h-12 rounded-xl px-8 text-base shadow-sm w-full sm:w-auto"
                asChild
              >
                <Link href="/sign-up" className="gap-2">
                  Start free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </motion.div>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.2 }}
              className="mt-4 text-xs text-muted-foreground"
            >
              No credit card to start · Free includes PDF, DOCX & JSON
            </motion.p>
          </div>
        </section>

        {/* Product strip */}
        <section
          className="border-y border-border/70 bg-muted/15 py-12 sm:py-14"
          aria-labelledby="product-strip-heading"
        >
          <h2 id="product-strip-heading" className="sr-only">
            Product highlights
          </h2>
          <div className="mx-auto grid max-w-5xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
            {[
              { label: "Editor", sub: "Sections, rich text, undo-friendly" },
              { label: "Preview", sub: "A4 layout you can trust" },
              {
                label: "Export",
                sub: "Preview-accurate PDF & Word — Pro is watermark-free",
              },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-2xl border border-border/80 bg-background/80 px-5 py-6 text-center shadow-sm backdrop-blur-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {cell.label}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {cell.sub}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-16 sm:py-20" aria-labelledby="features-heading">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2
                id="features-heading"
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Everything you need, nothing you don&apos;t
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                A single workspace for drafting, scoring, and exporting — tuned
                for serious job seekers.
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
                  <h3 className="text-sm font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* AI Resume Editor Feature Showcase */}
        <section className="border-t border-border/60 bg-gradient-to-b from-transparent via-primary/[0.01] to-transparent py-16 sm:py-24" aria-labelledby="resume-editor-heading">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Copy on the Left (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  <Monitor className="h-3 w-3" />
                  Visual Workspace
                </div>
                <h2 id="resume-editor-heading" className="text-3xl font-black tracking-tight sm:text-4xl text-slate-900 dark:text-white">
                  Craft standard-setting Resumes in real-time
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Our intuitive split-screen builder shows your A4 page layout alongside your edits. No guess-work with margins, page overflows, or formatting. What you see is exactly what you export.
                </p>
                <ul className="space-y-4">
                  {[
                    { title: "Live A4 Preview", desc: "Always know exactly where your pages break. No unexpected extra blank pages on export." },
                    { title: "AI Bullet Optimizer", desc: "Turn raw drafts into high-impact, results-driven professional bullet points instantly." },
                    { title: "Visual Style Controller", desc: "Customize fonts, colors, and margins in real-time with responsive design integrity." },
                  ].map((feat, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{feat.title}</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mockup on the Right (lg:col-span-7) */}
              <div className="lg:col-span-7 relative w-full min-w-0">
                {/* Background glow effects */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-500/10 to-primary/10 blur-2xl rounded-3xl" />
                
                {/* Interactive Mock Workspace */}
                <div className="rounded-2xl border border-border/80 bg-card sm:bg-background/80 p-4 sm:p-5 shadow-xl sm:shadow-2xl sm:backdrop-blur-sm space-y-4 text-slate-900 dark:text-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between border-b pb-3 border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-400" />
                      <span className="h-3 w-3 rounded-full bg-yellow-400" />
                      <span className="h-3 w-3 rounded-full bg-green-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px] sm:max-w-none">resumesensei.com/builder/workspace</span>
                    <div className="w-12 shrink-0 sm:w-12" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Mock Editor Inputs */}
                    <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-slate-800 dark:text-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Editor Assistance</p>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Raw Bullet Note</label>
                        <div className="text-[9px] border border-border bg-background p-1.5 rounded text-muted-foreground min-h-[45px] leading-tight italic">
                          "worked on cloud APIs and speeded up database query speed"
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Action Verb Level</label>
                        <div className="text-[10px] border border-border bg-background px-2 py-1 rounded flex items-center justify-between text-foreground font-medium">
                          <span>Strong & Results-Oriented</span>
                          <span className="text-[8px] text-muted-foreground">▼</span>
                        </div>
                      </div>
                      <div className="w-full text-center py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded shadow-sm hover:bg-primary/95 cursor-default">
                        Polish with AI
                      </div>
                      <div className="space-y-1.5 pt-1.5 border-t border-border/40">
                        <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">Optimized Suggestion:</p>
                        <p className="text-[8px] leading-tight text-slate-600 dark:text-slate-300 font-medium bg-emerald-500/5 p-1.5 rounded border border-emerald-500/20">
                          "Architected scalable cloud APIs and optimized database queries, reducing latency by 35% and improving data throughput."
                        </p>
                      </div>
                    </div>

                    {/* Mock Document Preview */}
                    <div className="relative p-4 rounded-xl bg-background border border-border/80 shadow-inner flex flex-col justify-between min-h-[220px]">
                      {/* Floating Indicator */}
                      <div className="absolute top-2 right-2 bg-indigo-500 text-white font-bold text-[8px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <Monitor className="h-2 w-2" />
                        Page 1 of 1
                      </div>
                      
                      <div className="space-y-3 text-[8px] leading-relaxed text-foreground/80">
                        <div className="space-y-0.5 text-center border-b pb-2 border-border/40">
                          <p className="font-extrabold text-slate-900 dark:text-slate-100 text-[10px] tracking-wide">JOHN DOE</p>
                          <div className="text-[6px] text-muted-foreground font-medium flex flex-wrap justify-center gap-x-1 gap-y-0.5 max-w-full">
                            <span>john.doe@example.com</span>
                            <span>·</span>
                            <span>+91 98765 43210</span>
                            <span>·</span>
                            <span>github.com/johndoe</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-extrabold text-[8px] tracking-wider text-slate-900 dark:text-slate-100 border-b border-slate-900/10 pb-0.5">EXPERIENCE</p>
                          <div className="space-y-1">
                            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                              <span>Senior Software Engineer</span>
                              <span className="text-[7px] font-medium text-muted-foreground">Stripe · Remote</span>
                            </div>
                            <p className="text-[7px] text-muted-foreground italic -mt-1">June 2023 – Present</p>
                            <ul className="list-disc pl-2 space-y-1 text-slate-600 dark:text-slate-300 text-[6.5px]">
                              <li>
                                <span className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold px-0.5 rounded">Architected scalable cloud APIs</span> and optimized database queries, reducing latency by 35%.
                              </li>
                              <li>Collaborated with product designers to implement responsive, pixel-perfect user interfaces across multiple web apps.</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2 border-border/40 mt-3">
                        <span className="text-[8px] text-muted-foreground font-medium">Live A4 Layout Engine</span>
                        <span className="text-[8px] font-bold text-primary flex items-center gap-1">
                          Preview Match <ArrowRight className="h-2 w-2" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Cover Letters Feature Showcase */}
        <section className="border-t border-border/60 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent py-16 sm:py-24" aria-labelledby="cover-letter-heading">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-3 w-3" />
                  New Feature
                </div>
                <h2 id="cover-letter-heading" className="text-3xl font-black tracking-tight sm:text-4xl text-slate-900 dark:text-white">
                  Tailor your Cover Letters with AI
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Stop writing job applications from scratch. Resumesensei generates highly tailored, high-converting cover letters matching your resume details and target job description in seconds.
                </p>
                <ul className="space-y-4">
                  {[
                    { title: "Job URL Scraper", desc: "Paste any job posting link to instantly extract the role details and requirements." },
                    { title: "Custom Tones & Experience", desc: "Adapt the writing style—from Professional & Polished to Tech Startup—to match the target company." },
                    { title: "Built-in AI ATS Auditing", desc: "Analyze how well your cover letter matches the job requirements and optimize the keyword density." },
                  ].map((feat, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{feat.title}</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-7 relative w-full min-w-0">
                {/* Background glow effects */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/10 to-indigo-500/10 blur-2xl rounded-3xl" />
                
                {/* Interactive Mock Workspace */}
                <div className="rounded-2xl border border-border/80 bg-card sm:bg-background/80 p-4 sm:p-5 shadow-xl sm:shadow-2xl sm:backdrop-blur-sm space-y-4 text-slate-900 dark:text-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between border-b pb-3 border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-400" />
                      <span className="h-3 w-3 rounded-full bg-yellow-400" />
                      <span className="h-3 w-3 rounded-full bg-green-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px] sm:max-w-none">resumesensei.com/cover-letter-builder</span>
                    <div className="w-12 shrink-0 sm:w-12" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Mock Inputs */}
                    <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-slate-800 dark:text-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Generator Options</p>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Job URL / Details</label>
                        <div className="flex gap-1">
                          <div className="text-[10px] flex-1 border border-border bg-background px-2 py-1 rounded truncate text-muted-foreground min-w-0">linkedin.com/jobs/...</div>
                          <span className="text-[9px] bg-primary text-primary-foreground px-2 py-1 rounded font-bold cursor-default shrink-0">Scraped</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Writing Tone</label>
                        <div className="text-[10px] border border-border bg-background px-2 py-1 rounded flex items-center justify-between text-foreground font-medium">
                          <span>Confident & Assertive</span>
                          <span className="text-[8px] text-muted-foreground">▼</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Custom Instructions</label>
                        <div className="text-[9px] border border-border bg-background p-1.5 rounded text-muted-foreground min-h-[45px] italic leading-tight">
                          "Emphasize my cloud architecture projects and mention I can start immediately..."
                        </div>
                      </div>
                      <div className="w-full text-center py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded shadow-sm hover:bg-primary/95 cursor-default">
                        Tailor with AI
                      </div>
                    </div>

                    {/* Mock Output Preview */}
                    <div className="relative p-4 rounded-xl bg-background border border-border/80 shadow-inner flex flex-col justify-between min-h-[220px]">
                      {/* ATS Score badge floating */}
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 animate-pulse">
                        <Sparkles className="h-2.5 w-2.5" />
                        ATS: 96%
                      </div>
                      
                      <div className="space-y-2 text-[8px] leading-relaxed text-foreground/80">
                        <div className="space-y-0.5 border-b pb-1.5 border-border/40">
                          <p className="font-bold text-slate-900 dark:text-slate-100">John Doe</p>
                          <div className="text-[6px] text-muted-foreground font-medium flex flex-wrap gap-x-1 gap-y-0.5 max-w-full">
                            <span>john.doe@example.com</span>
                            <span>·</span>
                            <span>+91 98765 43210</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-[7px] text-slate-900 dark:text-slate-100">Dear Hiring Manager at Stripe,</p>
                          <p className="indent-2">
                            I am writing to express my strong interest in the <span className="bg-indigo-50 dark:bg-indigo-950 font-semibold text-primary px-0.5 rounded">Senior Software Engineer</span> position. With over five years of experience building secure APIs and scaling cloud-native systems, I am excited to contribute to Stripe's payment infrastructure...
                          </p>
                          <p className="indent-2">
                            In my previous role, I led the migration of a legacy billing system to a serverless architecture, which <span className="bg-indigo-50 dark:bg-indigo-950 font-semibold text-primary px-0.5 rounded">improved processing efficiency by 40%</span>. I look forward to bringing this expertise...
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2 border-border/40 mt-3">
                        <span className="text-[8px] text-muted-foreground font-medium">Watermark-free export</span>
                        <span className="text-[8px] font-bold text-primary flex items-center gap-1">
                          PDF & Word <ArrowRight className="h-2 w-2" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section
          className="border-t border-border/60 bg-muted/20 py-16 sm:py-20"
          aria-labelledby="pillars-heading"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2
              id="pillars-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Built for real applications
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pillars.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-border/60 bg-background p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/40">
                    <p.icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-sm font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Templates */}
        <section
          className="py-16 sm:py-24 overflow-hidden"
          aria-labelledby="templates-heading"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10 text-center">
            <h2
              id="templates-heading"
              className="text-3xl font-black tracking-tight sm:text-4xl mb-4"
            >
              Premium Templates
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground">
              Browse our collection of beautifully designed templates. Start
              with our free essential designs, or upgrade to Pro to unlock the
              entire premium library.
            </p>
          </div>
          <div className="mx-auto max-w-7xl">
            <TemplatesCarousel />
          </div>
        </section>

        {/* Testimonials */}
        <Testimonials />

        {/* FAQ */}
        <section
          className="border-t border-border/60 py-16 sm:py-20"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2
              id="faq-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Common questions
            </h2>
            <Accordion
              type="single"
              collapsible
              className="mt-8 w-full rounded-2xl border border-border/80 px-1 sm:px-2"
            >
              {faqs.map((item) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="border-border px-3 sm:px-4"
                >
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
        <section
          className="border-t border-border/60 bg-muted/15 py-16 sm:py-20"
          aria-labelledby="pricing-heading"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <h2
                id="pricing-heading"
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Simple pricing
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
                Start free. Move to Pro to unlock unlimited resumes, every template,
                the AI ATS Auditor, premium colors & fonts, and full AI.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-border bg-background p-6 sm:p-8">
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try the full workflow
                </p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tight">₹0</span>
                  <span className="text-sm text-muted-foreground">
                    / forever
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {FREE_PLAN_FEATURES.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2 text-sm text-muted-foreground"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full rounded-xl"
                  variant="outline"
                  asChild
                >
                  <Link href="/sign-up">Create free account</Link>
                </Button>
              </div>
              <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-primary/[0.04] p-6 sm:p-8">
                <span className="absolute left-6 top-0 inline-block -translate-y-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Pro
                </span>
                <h3 className="text-lg font-semibold pt-2">
                  Everything unlocked
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  For active job searches
                </p>
                <p className="mt-6 text-sm text-muted-foreground">From</p>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-black tracking-tight">
                    ₹99
                  </span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                  <span className="w-full text-xs text-muted-foreground sm:inline sm:w-auto sm:pl-2">
                    or ₹999 / year
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {PRO_PLAN_FEATURES.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2 text-sm text-muted-foreground"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
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
        <section
          className="border-t border-border/60 bg-zinc-950 py-16 text-zinc-50 sm:py-20"
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2
              id="cta-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Ready when you are
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
              Create an account in seconds. Build your first resume on the free
              plan, then upgrade if you need more.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-12 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100"
                asChild
              >
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
              <Link
                href="/contact"
                className="underline-offset-4 hover:text-zinc-300 hover:underline"
              >
                Contact
              </Link>
              <span className="mx-2 text-zinc-600">·</span>
              <Link
                href="/privacy"
                className="underline-offset-4 hover:text-zinc-300 hover:underline"
              >
                Privacy
              </Link>
              <span className="mx-2 text-zinc-600">·</span>
              <Link
                href="/terms"
                className="underline-offset-4 hover:text-zinc-300 hover:underline"
              >
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
