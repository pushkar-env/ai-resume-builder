import { motion, useReducedMotion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { SITE_NAME } from "@/lib/brand";

const testimonials = [
  {
    quote:
      "The live preview finally matched my PDF — no more surprise line breaks. I picked Silicon Valley and had a recruiter-ready resume the same evening.",
    name: "Priya Sharma",
    role: "Software Engineer",
    location: "Bengaluru",
  },
  {
    quote:
      "ATS score on Pro pointed out weak keywords before I applied. Felt like having a calm coach review my draft without the agency price tag.",
    name: "Marcus Chen",
    role: "Product Manager",
    location: "Singapore",
  },
  {
    quote:
      "Structured sections and AI bullet polish saved me hours. The templates look premium without feeling over-designed.",
    name: "Ananya Patel",
    role: "Marketing Lead",
    location: "Mumbai",
  },
] as const;

const fadeIn = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

export function LandingTestimonials() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="py-16 sm:py-20"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeIn}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Testimonials</p>
          <h2 id="testimonials-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Trusted by professionals sharpening their story
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Job seekers use {SITE_NAME} to ship clear, ATS-aware resumes — guided editing, not generic templates.
          </p>
        </motion.div>

        <ul className="mt-12 grid list-none gap-5 md:grid-cols-3">
          {testimonials.map((t, index) => (
            <motion.li
              key={t.name}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
            >
              <figure className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md">
                <div className="flex items-center gap-2" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
                  ))}
                </div>
                <Quote className="mt-4 h-5 w-5 text-primary/25" aria-hidden />
                <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-foreground/90">
                  <p>&ldquo;{t.quote}&rdquo;</p>
                </blockquote>
                <figcaption className="mt-5 border-t border-border/60 pt-4">
                  <cite className="not-italic">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.role} · {t.location}
                    </p>
                  </cite>
                </figcaption>
              </figure>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
