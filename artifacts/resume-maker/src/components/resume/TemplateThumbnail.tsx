import { useRef, useState, useEffect } from "react";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import type { ResumeDetail } from "@workspace/api-client-react";

const PAGE_WIDTH_PX = 794;

/**
 * Template gallery thumbnail: continuous sample content (full resume visible in measure tree),
 * paginated-style cover scale, top-aligned, white backing.
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
      const w = host.clientWidth;
      const h = host.clientHeight;
      const ch = measure.scrollHeight;
      if (w <= 0 || h <= 0 || ch <= 0) return;
      const scaleW = (w / PAGE_WIDTH_PX) * 0.998;
      const scaleH = (h / ch) * 0.998;
      setFitScale(Math.min(0.55, Math.max(0.32, Math.max(scaleW, scaleH))));
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
      className="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none"
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: PAGE_WIDTH_PX,
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
