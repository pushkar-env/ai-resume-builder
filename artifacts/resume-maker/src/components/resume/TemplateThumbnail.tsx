import { useRef, useState, useEffect, useCallback } from "react";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import {
  computeThumbnailCoverScale,
  measureContinuousCanvasHeight,
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
  const hostRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  /** Scale to fill preview area (width + height “cover”), centered like dashboard thumbnails. */
  const [fitScale, setFitScale] = useState(0.36);

  const remeasure = useCallback(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) return;

    const ch = measureContinuousCanvasHeight(measure);
    const next = computeThumbnailCoverScale(host.clientWidth, host.clientHeight, ch);
    if (next != null) setFitScale(next);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) return;

    const schedule = () => {
      requestAnimationFrame(() => requestAnimationFrame(remeasure));
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
  }, [templateId, accent, showWatermark, remeasure]);

  const sample: ResumeDetail = {
    ...SAMPLE_RESUME,
    templateId,
    accentColor: accent,
  };
  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-white [content-visibility:visible]">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: 794,
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
