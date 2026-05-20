import { useRef, useState, useEffect } from "react";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import {
  computeThumbnailCoverScale,
  measureContinuousCanvasHeight,
  THUMBNAIL_PAGE_WIDTH_PX,
} from "@/lib/thumbnail-fit-scale";
import type { ResumeDetail } from "@workspace/api-client-react";

/**
 * Template card preview: top-aligned, edge-to-edge cover fit (original gallery behavior).
 * Renders continuous sample content (no half-empty A4 page) but scales like a full page.
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

  useEffect(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) return;

    const update = () => {
      const ch = measureContinuousCanvasHeight(measure);
      const next = computeThumbnailCoverScale(
        host.clientWidth,
        host.clientHeight,
        ch,
      );
      if (next != null) setFitScale(next);
    };

    const schedule = () => {
      requestAnimationFrame(() => requestAnimationFrame(update));
    };

    schedule();
    const roHost = new ResizeObserver(schedule);
    const roMeasure = new ResizeObserver(schedule);
    roHost.observe(host);
    roMeasure.observe(measure);
    return () => {
      roHost.disconnect();
      roMeasure.disconnect();
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
      className="absolute inset-0 overflow-hidden [content-visibility:visible] [&_.resume-continuous-canvas]:!shadow-none"
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: THUMBNAIL_PAGE_WIDTH_PX,
          transformOrigin: "top center",
          transform: `scale(${fitScale}) translateZ(0)`,
          backfaceVisibility: "hidden",
          WebkitFontSmoothing: "antialiased",
          pointerEvents: "none",
        }}
      >
        <div ref={measureRef} className="w-[794px]">
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
  );
}
