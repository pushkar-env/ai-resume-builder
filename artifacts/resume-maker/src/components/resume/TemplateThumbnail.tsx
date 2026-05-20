import { useRef, useState, useCallback, type CSSProperties } from "react";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import {
  computeGalleryViewportHeight,
  computeTemplateGalleryScale,
  THUMBNAIL_DEFAULT_VIEWPORT_H_PX,
  THUMBNAIL_PAGE_WIDTH_PX,
} from "@/lib/thumbnail-fit-scale";
import { useThumbnailMeasure } from "@/hooks/use-thumbnail-scale";
import type { ResumeDetail } from "@workspace/api-client-react";

const SCALED_LAYER_STYLE = {
  backfaceVisibility: "hidden" as const,
  WebkitFontSmoothing: "antialiased" as const,
  pointerEvents: "none" as const,
};

/**
 * Template gallery preview: continuous sample, width-fit scale, top-aligned.
 * Transform layers are split so `scale()` does not override centering translate.
 */
export function TemplateThumbnail({
  templateId,
  accent,
  showWatermark,
}: {
  templateId: string;
  accent: string;
  showWatermark: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.36);
  const [viewportH, setViewportH] = useState(THUMBNAIL_DEFAULT_VIEWPORT_H_PX);

  const remeasure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;
    const scale = computeTemplateGalleryScale(w);
    setFitScale(scale);
    setViewportH(computeGalleryViewportHeight(h, scale));
  }, []);

  useThumbnailMeasure(hostRef, null, remeasure, [templateId, accent, showWatermark]);

  const sample: ResumeDetail = {
    ...SAMPLE_RESUME,
    templateId,
    accentColor: accent,
  };

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div
          style={{
            width: THUMBNAIL_PAGE_WIDTH_PX,
            transformOrigin: "top center",
            transform: `scale(${fitScale}) translateZ(0)`,
            ...SCALED_LAYER_STYLE,
          }}
        >
          <div
            data-template-gallery-thumb
            className="flex flex-col"
            style={
              {
                width: THUMBNAIL_PAGE_WIDTH_PX,
                minHeight: viewportH,
                height: viewportH,
                "--gallery-viewport-h": `${viewportH}px`,
              } as CSSProperties
            }
          >
            <ResumePreview
              key={templateId}
              layout="continuous"
              resume={sample}
              accentColor={accent}
              showWatermark={showWatermark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
