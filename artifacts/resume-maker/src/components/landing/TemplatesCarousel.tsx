import { useListTemplates } from "@workspace/api-client-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { TemplateThumbnail } from "@/components/resume/TemplateThumbnail";
import { Skeleton } from "@/components/ui/skeleton";

import { TEMPLATE_CONFIG } from "@/lib/template-config";

export function TemplatesCarousel() {
  const { data: templates, isLoading } = useListTemplates();
  const templateList = Array.isArray(templates) ? templates : [];

  if (isLoading) {
    return (
      <div className="w-full overflow-hidden flex gap-4 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="min-w-[280px] aspect-[3/4] rounded-2xl shrink-0"
          />
        ))}
      </div>
    );
  }

  if (templateList.length === 0) return null;

  return (
    <div className="relative w-full max-w-full px-12">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {templateList.map((template) => {
            const cfg = TEMPLATE_CONFIG[template.id] ?? {
              accent: "#000000",
              bg: "#f8fafc",
            };
            return (
              <CarouselItem
                key={template.id}
                className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
              >
                <div className="relative rounded-2xl border border-border overflow-hidden bg-background flex flex-col h-full">
                  <div
                    className="relative overflow-hidden w-full aspect-[3/4]"
                    style={{ background: cfg.bg }}
                  >
                    <TemplateThumbnail
                      templateId={template.id}
                      accent={cfg.accent}
                      showWatermark={true}
                    />
                  </div>
                  <div className="p-3.5 border-t border-border bg-card">
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {template.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {template.category}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="!absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 h-10 w-10 sm:h-12 sm:w-12 border border-border/60 hover:bg-muted hover:text-foreground shadow-sm bg-background/95 backdrop-blur z-10" />
        <CarouselNext className="!absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 h-10 w-10 sm:h-12 sm:w-12 border border-border/60 hover:bg-muted hover:text-foreground shadow-sm bg-background/95 backdrop-blur z-10" />
      </Carousel>
    </div>
  );
}
