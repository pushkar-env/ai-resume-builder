import { useRef, useState, useEffect, type CSSProperties } from "react";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import {
  computeTemplateGalleryScale,
  THUMBNAIL_PAGE_WIDTH_PX,
} from "@/lib/thumbnail-fit-scale";
import type { ResumeDetail } from "@workspace/api-client-react";

/**
 * Template gallery preview: full continuous sample, width-locked scale, top-aligned.
 * Uses a two-layer transform so horizontal centering is not overridden by scale().
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
  const measureRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.36);
  /** Unscaled doc height matching the visible card clip (for full-height two-col sidebars). */
  const [viewportH, setViewportH] = useState(1123);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w <= 0 || h <= 0) return;
      const scale = computeTemplateGalleryScale(w);
      setFitScale(scale);
      setViewportH(Math.ceil(h / scale));
    };

    const schedule = () => {
      requestAnimationFrame(() => requestAnimationFrame(update));
    };

    schedule();
    const roHost = new ResizeObserver(schedule);
    roHost.observe(host);

    const measure = measureRef.current;
    const roMeasure = measure ? new ResizeObserver(schedule) : null;
    if (measure && roMeasure) roMeasure.observe(measure);

    return () => {
      roHost.disconnect();
      roMeasure?.disconnect();
    };
  }, [templateId, accent, showWatermark]);

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
      {/* Center layer — never combine with scale on the same transform (breaks -translate-x-1/2). */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div
          style={{
            width: THUMBNAIL_PAGE_WIDTH_PX,
            transformOrigin: "top center",
            transform: `scale(${fitScale}) translateZ(0)`,
            backfaceVisibility: "hidden",
            WebkitFontSmoothing: "antialiased",
            pointerEvents: "none",
          }}
        >
          <div
            ref={measureRef}
            data-template-gallery-thumb
            className="w-[794px]"
            style={
              {
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
