import { ResumePreview } from "@/components/resume/ResumePreview";
import { ScaledResumeThumbnailShell } from "@/components/resume/ScaledResumeThumbnailShell";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import type { ResumeDetail } from "@workspace/api-client-react";

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
  const sample: ResumeDetail = {
    ...SAMPLE_RESUME,
    templateId,
    accentColor: accent,
  };

  return (
    <ScaledResumeThumbnailShell
      hostClassName="absolute inset-0 overflow-hidden bg-white [&_.resume-continuous-canvas]:!shadow-none"
      measureDeps={[templateId, accent, showWatermark]}
    >
      <ResumePreview
        key={templateId}
        layout="continuous"
        resume={sample}
        accentColor={accent}
        showWatermark={showWatermark}
      />
    </ScaledResumeThumbnailShell>
  );
}
