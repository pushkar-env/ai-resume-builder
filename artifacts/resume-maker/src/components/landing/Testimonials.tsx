import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "Senior Software Engineer",
    content:
      "The AI suggestions were incredibly context-aware. I imported my old PDF resume and within 10 minutes I had a perfectly formatted, ATS-friendly version.",
  },
  {
    name: "David Chen",
    role: "Product Manager",
    content:
      "The 'Highly Customizable' templates are a game changer. I tweaked the exact colors and fonts to match my personal brand without breaking the layout.",
  },
  {
    name: "Emily Rodriguez",
    role: "Recent Graduate",
    content:
      "I was struggling with how to word my limited experience. The AI-powered writing turned my basic bullets into impactful achievements. Landed 3 interviews in a week!",
  },
  {
    name: "Michael Chang",
    role: "UX Designer",
    content:
      "As a designer, I'm picky about layouts. Resumesensei is the first builder where the live preview perfectly matches the exported PDF. Truly a premium feel.",
  },
  {
    name: "Aisha Patel",
    role: "Marketing Director",
    content:
      "The ATS score tracking is brilliant. It highlighted exactly which keywords I was missing for the role I wanted. Best investment for my career.",
  },
  {
    name: "James Wilson",
    role: "Data Scientist",
    content:
      "Importing my chaotic DOCX file worked flawlessly. The system mapped everything correctly and the new template made it look 10x more professional.",
  },
];

export function Testimonials() {
  return (
    <section
      className="py-20 sm:py-32 overflow-hidden bg-muted/10 border-t border-border/50 relative"
      aria-labelledby="testimonials-heading"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            id="testimonials-heading"
            className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl mb-4"
          >
            Loved by professionals
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            See how our AI-powered features and highly customizable templates
            have helped thousands land their dream roles.
          </motion.p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative flex flex-col justify-between rounded-2xl border border-border/60 bg-background/50 p-6 shadow-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md hover:bg-card"
            >
              <div>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-primary/80 text-primary/80"
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  "{t.content}"
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-4">
                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
