import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, FileText, Zap, Shield, Star, Check, User, AlignLeft, Briefcase, GraduationCap, Wrench, LayoutTemplate, PlusCircle, Smartphone, Tablet, Monitor, HelpCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SEO } from "@/components/shared/SEO";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Writing",
    description: "Generate professional summaries, improve bullet points, and get ATS optimization suggestions instantly.",
  },
  {
    icon: FileText,
    title: "12 Premium Templates",
    description: "From Modern to Executive — every template is crafted for impact and optimized for applicant tracking systems.",
  },
  {
    icon: Zap,
    title: "Live Preview",
    description: "See every change in real-time on a pixel-perfect A4 preview. What you see is exactly what you export.",
  },
  {
    icon: Shield,
    title: "ATS Score Tracking",
    description: "Know exactly how your resume performs against automated screening systems before you submit.",
  },
];

const templates = ["Modern", "Minimal", "Corporate", "Creative", "ATS Friendly", "Developer", "Executive", "Startup"];

const testimonials = [
  { name: "Sarah K.", role: "Software Engineer at Meta", quote: "Landed my dream job after using ResumeSensei. The ATS score feature was a game changer." },
  { name: "James T.", role: "Product Manager at Stripe", quote: "The AI bullet point improvements saved me hours. My resume went from good to exceptional." },
  { name: "Priya M.", role: "Data Scientist at Google", quote: "I had 3 interviews within a week of updating my resume with ResumeSensei. Highly recommend." },
  { name: "Aman R.", role: "Frontend Engineer", quote: "The live preview is insanely accurate — what I saw on mobile matched the PDF export perfectly." },
  { name: "Lucia G.", role: "MBA Candidate", quote: "Templates are clean and professional. I could tailor versions for consulting and tech in minutes." },
  { name: "Noah P.", role: "DevOps Engineer", quote: "Loved the multi-device workflow — edit on my phone, fine-tune on desktop, export anywhere." },
];

const faqs = [
  {
    q: "Is ResumeSensei responsive on mobile and tablets?",
    a: "Yes. The editor and preview are designed to work smoothly on phones, tablets, and desktops — including pinch-to-zoom in the preview on mobile.",
  },
  {
    q: "Will my resume look the same when exported?",
    a: "The export uses the same rendered preview DOM and styles, so the PDF/print output matches what you see on screen.",
  },
  {
    q: "Is it ATS-friendly?",
    a: "Templates are built to be clean, readable, and compatible with applicant tracking systems. You can also check your ATS score in the dashboard.",
  },
  {
    q: "Do I need a credit card to try it?",
    a: "No. You can start on the free plan with no credit card required.",
  },
  {
    q: "Can I create multiple resumes?",
    a: "Pro users can create unlimited resumes. The free plan includes 1 resume so you can try the full workflow end-to-end.",
  },
] as const;

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for getting started",
    features: ["1 resume", "3 templates", "PDF export", "Basic AI suggestions"],
    cta: "Get started free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    description: "For serious job seekers",
    features: ["Unlimited resumes", "All 12 templates", "PDF, DOCX & JSON export", "Unlimited AI assistance", "ATS score tracking", "Priority support"],
    cta: "Start Pro trial",
    highlighted: true,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="ResumeSensei | Resumes that get interviews"
        description="Build a professional, ATS-ready resume in minutes with AI guidance, modern templates, and a real-time preview that matches your export."
        canonicalUrl="https://resumesensei.com/"
      />
      <LandingNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
              <Sparkles className="h-3 w-3" />
              AI-powered resume builder
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Resumes that get you<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-500">the interview</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Meet <span className="font-semibold text-foreground">ResumeSensei</span> — your AI resume coach. Build a professional, ATS-ready resume in minutes with modern templates and a real-time preview. Used by professionals at top companies.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild className="gap-2 h-11 px-6">
                <Link href="/sign-up">
                  Build your resume free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-11 px-6">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-4 text-xs text-muted-foreground">
              No credit card required. Free forever.
            </motion.p>
          </motion.div>
        </div>

        {/* Mock preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mx-auto mt-16 max-w-5xl px-4"
        >
          <div className="rounded-2xl border border-white/20 bg-white/40 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-border/50">
            <div className="flex items-center gap-1.5 mb-3 pl-1">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex flex-col md:grid md:grid-cols-5 md:gap-3 rounded-lg overflow-hidden border border-border bg-background min-h-[360px]">
              <div className="md:col-span-2 p-4 border-b md:border-b-0 md:border-r border-border bg-slate-50/50 flex flex-col">
                {/* Logo / Header area */}
                <div className="flex items-center gap-2 mb-6 px-1">
                  <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
                    <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700">Resume Editor</span>
                </div>
                
                {/* Navigation Items */}
                <div className="flex-1 space-y-1">
                  {[
                    { name: "Personal Info", icon: User, active: false },
                    { name: "Summary", icon: AlignLeft, active: true },
                    { name: "Experience", icon: Briefcase, active: false },
                    { name: "Education", icon: GraduationCap, active: false },
                    { name: "Skills", icon: Wrench, active: false },
                  ].map((item) => (
                    <div 
                      key={item.name} 
                      className={`flex items-center gap-2.5 py-2 px-2.5 rounded-md text-xs cursor-pointer transition-colors ${
                        item.active 
                          ? "bg-white shadow-sm border border-slate-200 text-primary font-medium" 
                          : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-700"
                      }`}
                    >
                      <item.icon className={`h-3.5 w-3.5 ${item.active ? "text-primary" : "text-slate-400"}`} />
                      {item.name}
                    </div>
                  ))}
                  
                  <div className="flex items-center gap-2.5 py-2 px-2.5 rounded-md text-xs text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 cursor-pointer mt-2 border border-dashed border-slate-300">
                    <PlusCircle className="h-3.5 w-3.5 text-slate-400" />
                    Add Section
                  </div>
                </div>

                {/* AI Suggestion Box */}
                <div className="mt-auto pt-4">
                  <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-3 shadow-sm relative overflow-hidden">
                    <div className="absolute -top-2 -right-2 p-1 opacity-10">
                      <Sparkles className="h-12 w-12 text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5 mb-2 relative z-10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-primary">AI Suggestion</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed relative z-10 mb-2.5">
                      Consider quantifying achievements in your <strong>TechFlow</strong> role to boost ATS scoring.
                    </p>
                    <div className="flex gap-2 relative z-10">
                      <button className="flex-1 bg-primary text-primary-foreground text-[9px] font-medium py-1.5 rounded shadow-sm hover:bg-primary/90 transition-colors">
                        Auto-Rewrite
                      </button>
                      <button className="px-2 bg-white text-slate-500 border border-slate-200 text-[9px] font-medium rounded hover:bg-slate-50 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-3 p-6 bg-white relative">
                {/* Resume Header */}
                <div className="mb-4">
                  <h3 className="text-lg font-serif text-slate-900 font-bold">Sarah Jenkins</h3>
                  <p className="text-[10px] text-slate-500 mt-1">Product Manager • New York, NY • sarah.j@example.com</p>
                </div>
                
                <div className="h-px w-full bg-slate-200 mb-4" />
                
                {/* Professional Summary */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-2">Professional Summary</h4>
                  <div className="relative p-2.5 rounded-md border border-primary/30 bg-primary/5">
                    <div className="absolute -top-2 -right-2 h-4 w-4 bg-primary rounded-full flex items-center justify-center shadow-sm">
                      <Sparkles className="h-2.5 w-2.5 text-white" />
                    </div>
                    <p className="text-[10px] text-slate-700 leading-relaxed">
                      Strategic Product Manager with 6+ years of experience in B2B SaaS. <span className="bg-primary/20 text-primary font-medium px-1 rounded-sm">Led cross-functional teams to launch 3 major products, increasing ARR by $2.4M</span> and improving customer retention by 15%.
                    </p>
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-2">Experience</h4>
                  <div className="mb-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <h5 className="text-[10px] font-semibold text-slate-900">Senior Product Manager, TechFlow</h5>
                      <span className="text-[9px] text-slate-500">2021 - Present</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1.5 text-[10px] text-slate-700">
                      <li>Spearheaded the development of the AI analytics dashboard, achieving a 40% adoption rate in Q1.</li>
                      <li>
                        Conducted 50+ user interviews to identify core friction points, <span className="border-b border-primary/40 border-dashed text-primary font-medium">reducing onboarding time by 30%</span>.
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight">
              Everything you need to land the job
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Powerful features that make building a standout resume fast, easy, and effective.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="group rounded-xl border border-border bg-background p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Works everywhere */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <Monitor className="h-3.5 w-3.5" />
                Built for every screen
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">Edit on any device. Export anywhere.</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed max-w-xl">
                ResumeSensei is responsive by default — optimized layouts for mobile, tablets, and desktops.
                Your content stays readable, your preview stays accurate, and exports stay consistent.
              </p>

              <div className="mt-6 grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Smartphone, title: "Mobile", desc: "Bottom tabs, pinch-to-zoom preview" },
                  { icon: Tablet, title: "Tablet", desc: "Comfortable split panes and scrolling" },
                  { icon: Monitor, title: "Desktop", desc: "Full editor + live A4 preview" },
                ].map((x) => (
                  <div key={x.title} className="rounded-xl border border-border bg-background p-4">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <x.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-semibold text-sm">{x.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{x.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-gradient-to-b from-muted/30 to-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">What you get</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "Real-time live preview",
                  "Word-safe wrapping and clean typography",
                  "Undo/redo rich text editing",
                  "ATS score tracking",
                  "PDF and DOC export",
                  "12 modern templates",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 rounded-xl border border-border bg-background p-4">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{t}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button asChild className="gap-2">
                  <Link href="/sign-up">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight">12 professional templates</motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-muted-foreground">Every template is ATS-tested and recruiter-approved.</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="flex flex-wrap justify-center gap-2">
            {templates.map((t) => (
              <motion.span key={t} variants={fadeUp} className="px-4 py-2 rounded-full border border-border bg-background text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer">
                {t}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight">Trusted by professionals</motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Fast to use, clean exports, and built to work on every screen.
            </motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="rounded-xl border border-border bg-background p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQs
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Questions, answered</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know before you start.
            </p>
          </div>

          <div className="grid gap-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-background px-5 py-4">
                <summary className="list-none cursor-pointer flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <HelpCircle className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-semibold text-sm">{f.q}</p>
                  </div>
                  <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed pl-10">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight">Simple, transparent pricing</motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-muted-foreground">Start free, upgrade when you're ready.</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                className={`rounded-2xl border p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${plan.highlighted ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background"}`}
              >
                {plan.highlighted && (
                  <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mb-3">Most popular</span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                  <Link href="/sign-up">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight text-white">
              Ready to land your next role?
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-primary-foreground/80">
              Join thousands of professionals already using ResumeSensei to get hired faster.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8">
              <Button size="lg" variant="secondary" asChild className="gap-2">
                <Link href="/sign-up">
                  Create your free resume
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <motion.div variants={fadeUp} className="mt-6">
              <Button size="lg" variant="secondary" asChild className="gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/15">
                <Link href="/contact">
                  Contact us
                  <Mail className="h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-3 text-xs text-white/70">
                Prefer email? Reach us at <a className="underline underline-offset-4 hover:text-white" href="mailto:support@resumesensei.com">support@resumesensei.com</a>.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
