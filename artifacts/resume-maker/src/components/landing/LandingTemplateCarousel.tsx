import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useListTemplates } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateThumbnail } from "@/components/resume/TemplateThumbnail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { TEMPLATE_CATEGORY_COLORS, templateStyle } from "@/lib/template-catalog";
import { SITE_NAME } from "@/lib/brand";

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

function middleTemplateIndex(count: number) {
  if (count <= 0) return 0;
  return Math.floor(count / 2);
}

export function LandingTemplateCarousel() {
  const reduceMotion = useReducedMotion();
  const { data: templates, isLoading } = useListTemplates();
  const templateList = templates ?? [];
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncScrollState = useCallback((carouselApi?: CarouselApi) => {
    if (!carouselApi) return;
    setCanScrollPrev(carouselApi.canScrollPrev());
    setCanScrollNext(carouselApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!api) return;
    syncScrollState(api);
    const onChange = () => syncScrollState(api);
    api.on("select", onChange);
    api.on("reInit", onChange);
    return () => {
      api.off("select", onChange);
      api.off("reInit", onChange);
    };
  }, [api, syncScrollState]);

  useEffect(() => {
    if (!api || templateList.length === 0) return;
    const target = middleTemplateIndex(templateList.length);
    if (api.selectedScrollSnap() !== target) {
      api.scrollTo(target, false);
    }
    syncScrollState(api);
  }, [api, templateList.length, syncScrollState]);

  const startIndex = middleTemplateIndex(templateList.length);

  return (
    <section
      id="templates"
      className="relative overflow-hidden border-t border-border/60 bg-muted/15 py-16 sm:py-20"
      aria-labelledby="landing-templates-heading"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeIn}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Template gallery</p>
          <h2 id="landing-templates-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Twelve premium layouts, live on your page
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Scroll through every {SITE_NAME} template with real resume previews. Pick a layout when you sign up — Pro
            unlocks all twelve; Free includes three.
          </p>
        </motion.div>

        <motion.div className="relative mt-10 sm:mt-12">
          {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[380px] w-[min(100%,280px)] shrink-0 rounded-2xl" />
              ))}
            </div>
          ) : (
            <Carousel
              key={`landing-templates-${templateList.length}`}
              setApi={setApi}
              opts={{
                align: "center",
                loop: false,
                dragFree: true,
                containScroll: "trimSnaps",
                startIndex,
              }}
              className="relative w-full"
            >
              <CarouselContent className="-ml-3 sm:-ml-4 md:-ml-5">
                {templateList.map((template, index) => {
                  const cfg = templateStyle(template.id);
                  const catClass =
                    TEMPLATE_CATEGORY_COLORS[template.category ?? ""] ?? "bg-gray-100 text-gray-600";

                  return (
                    <CarouselItem
                      key={template.id}
                      className="basis-[82%] pl-3 sm:basis-[48%] sm:pl-4 md:basis-[36%] md:pl-5 lg:basis-[30%]"
                    >
                      <motion.article
                        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-20px" }}
                        transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.25), ease: "easeOut" }}
                        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm transition-[box-shadow,border-color] duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                      >
                        <div
                          className="relative overflow-hidden"
                          style={{ aspectRatio: "3/4", background: cfg.bg }}
                        >
                          <TemplateThumbnail
                            templateId={template.id}
                            accent={cfg.accent}
                            showWatermark
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/15 to-transparent" />
                          {template.isPremium && (
                            <div className="absolute top-2.5 right-2.5 z-10">
                              <Badge className="gap-1 border-0 bg-gradient-to-r from-violet-500 to-purple-600 text-[10px] text-white shadow-md">
                                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                                Pro
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold leading-tight text-foreground">{template.name}</h3>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${catClass}`}
                            >
                              {template.category}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                            {template.description}
                          </p>
                        </div>
                      </motion.article>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>

              {/* Vertically centred nav — sibling overlay, not tied to carousel footer */}
              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between px-0 sm:px-1 md:px-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="pointer-events-auto ml-1 h-10 w-10 shrink-0 rounded-full border-border/80 bg-background/95 shadow-md backdrop-blur-sm hover:bg-background disabled:opacity-40 sm:ml-0"
                  disabled={!canScrollPrev}
                  onClick={() => api?.scrollPrev()}
                  aria-label="Previous templates"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="pointer-events-auto mr-1 h-10 w-10 shrink-0 rounded-full border-border/80 bg-background/95 shadow-md backdrop-blur-sm hover:bg-background disabled:opacity-40 sm:mr-0"
                  disabled={!canScrollNext}
                  onClick={() => api?.scrollNext()}
                  aria-label="Next templates"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </Carousel>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground sm:hidden">
            Swipe to explore all templates
          </p>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={reduceMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-10 flex justify-center"
        >
          <Button size="lg" className="h-12 rounded-xl px-8 shadow-sm" asChild>
            <Link href="/sign-up" className="gap-2">
              Start with a template
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
