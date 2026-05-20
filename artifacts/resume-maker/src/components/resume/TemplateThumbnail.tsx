import { useRef, useState, useEffect, useCallback } from "react";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import {
  computeThumbnailWidthFit,
  measureContinuousCanvasHeight,
  THUMBNAIL_PAGE_WIDTH_PX,
  THUMBNAIL_PREVIEW_INSET_PX,
  type ThumbnailFit,
} from "@/lib/thumbnail-fit-scale";
import type { ResumeDetail } from "@workspace/api-client-react";

export function TemplateThumbnail({
  templateId,
  accent,
  showWatermark,
}: {
  templateId: string;
  accent: string;
  showWatermark: boolean;
}) {
  const clipRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<ThumbnailFit>({ scale: 0.36 });

  const remeasure = useCallback(() => {
    const clip = clipRef.current;
    const measure = measureRef.current;
    if (!clip || !measure) return;

    const ch = measureContinuousCanvasHeight(measure);
    const next = computeThumbnailWidthFit(clip.clientWidth, clip.clientHeight, ch);
    if (next != null) setFit(next);
  }, []);

  useEffect(() => {
    const clip = clipRef.current;
    const measure = measureRef.current;
    if (!clip || !measure) return;

    const schedule = () => {
      requestAnimationFrame(() => requestAnimationFrame(remeasure));
    };

    schedule();
    const roClip = new ResizeObserver(schedule);
    const roMeasure = new ResizeObserver(schedule);
    roClip.observe(clip);
    roMeasure.observe(measure);
    return () => {
      roClip.disconnect();
      roMeasure.disconnect();
    };
  }, [templateId, accent, showWatermark, remeasure]);

  const sample: ResumeDetail = {
    ...SAMPLE_RESUME,
    templateId,
    accentColor: accent,
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden [content-visibility:visible] [&_.resume-continuous-canvas]:!shadow-none"
      style={{ padding: THUMBNAIL_PREVIEW_INSET_PX }}
    >
      <div ref={clipRef} className="relative h-full w-full overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{
            width: THUMBNAIL_PAGE_WIDTH_PX,
            transform: `translate(-50%, -50%) scale(${fit.scale}) translateZ(0)`,
            transformOrigin: "center center",
            backfaceVisibility: "hidden",
            WebkitFontSmoothing: "antialiased",
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
    </div>
  );
}
