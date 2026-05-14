import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { AppFooter } from "@/components/layout/AppFooter";
import { SEO } from "@/components/shared/SEO";
import { Mail, MapPin, MessageSquare, Clock, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const initialForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
  company: "",
};

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [form, setForm] = useState(initialForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.company.trim() !== "") return;

    setIsSubmitting(true);
    const apiUrl = import.meta.env.VITE_API_URL || "/api";

    try {
      const res = await fetch(`${apiUrl}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          company: form.company,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        toast({
          title: "Could not send message",
          description: data.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      setForm(initialForm);
      toast({
        title: "Message sent successfully!",
        description: "We'll get back to you as soon as possible.",
      });

      window.setTimeout(() => setIsSuccess(false), 3000);
    } catch {
      toast({
        title: "Network error",
        description: "Check your connection and try again, or email support@resumesensei.com.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="min-h-screen min-w-0 w-full max-w-[100vw] bg-background flex flex-col overflow-x-clip">
      <SEO
        title="Contact Us | ResumeSensei"
        description="Have questions? Contact ResumeSensei for support, billing inquiries, or general feedback."
        canonicalUrl="https://resumesensei.com/contact"
      />
      <Navbar />

      <div className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 mb-4">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 text-balance px-1">
            Get in touch
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg text-pretty px-1 break-words">
            Have questions about ResumeSensei or need support? We're here to help you land your dream job.
          </p>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid w-full min-w-0 grid-cols-1 lg:grid-cols-5 gap-8 sm:gap-10 lg:gap-8 items-start">
          {/* Contact Form */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="lg:col-span-3 min-w-0 w-full max-w-full bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-sm"
          >
            <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="relative space-y-5 min-w-0" noValidate>
              {/* Honeypot — leave empty (bots often fill hidden fields) */}
              <div className="pointer-events-none absolute left-0 top-0 -z-10 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
                <label htmlFor="contact-company">Company</label>
                <input
                  id="contact-company"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </div>

              <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="min-w-0 space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Full Name
                  </label>
                  <Input
                    id="name"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Your Name"
                    className="h-11 min-w-0 max-w-full"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="yourname@example.com"
                    className="h-11 min-w-0 max-w-full"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium">
                  Subject
                </label>
                <Input
                  id="subject"
                  name="subject"
                  required
                  placeholder="How can we help?"
                  className="h-11 min-w-0 max-w-full"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  placeholder="Please describe your issue or question in detail..."
                  className="min-h-[150px] min-w-0 max-w-full resize-y"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className={`w-full sm:w-auto h-12 px-8 transition-all ${isSuccess ? "bg-green-600 hover:bg-green-700" : ""}`}
                disabled={isSubmitting || isSuccess}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending...
                  </span>
                ) : isSuccess ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Sent Successfully
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Message
                  </span>
                )}
              </Button>
            </form>
          </motion.div>

          {/* Contact Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2 min-w-0 w-full max-w-full space-y-6"
          >
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 sm:p-6 min-w-0">
              <h3 className="font-semibold text-lg mb-4 text-foreground">Contact Information</h3>
              <div className="space-y-6">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">Email Support</p>
                    <a
                      href="mailto:support@resumesensei.com"
                      className="text-muted-foreground text-sm hover:text-primary transition-colors mt-1 block break-words [overflow-wrap:anywhere]"
                    >
                      support@resumesensei.com
                    </a>
                  </div>
                </div>

                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">Office Location</p>
                    <p className="text-muted-foreground text-sm mt-1 break-words">
                      123 Innovation Drive
                      <br />
                      San Francisco, CA 94105
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">Working Hours</p>
                    <p className="text-muted-foreground text-sm mt-1 break-words">
                      Monday - Friday
                      <br />
                      9:00 AM - 6:00 PM (PST)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 border border-border rounded-2xl p-5 sm:p-6 min-w-0">
              <h3 className="font-semibold text-sm mb-2 text-foreground">Looking for enterprise solutions?</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                We offer custom ATS integrations and team billing for recruitment agencies and large organizations.
              </p>
              <Button variant="outline" className="w-full">
                Contact Sales
              </Button>
            </div>
          </motion.div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
