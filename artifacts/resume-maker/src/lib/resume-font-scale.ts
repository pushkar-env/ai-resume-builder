/** Discrete font-size steps shown in the builder slider (CSS zoom on preview). */
export const FONT_SCALE_STEPS = [1, 1.1, 1.2, 1.35, 1.5] as const;

export type FontScaleStep = (typeof FONT_SCALE_STEPS)[number];

export const DEFAULT_FONT_SCALE: FontScaleStep = 1;

const STEP_TOLERANCE = 0.001;

/** Snap persisted or legacy values to the nearest allowed step. */
export function snapFontScale(value: number): FontScaleStep {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_FONT_SCALE;
  let nearest: FontScaleStep = FONT_SCALE_STEPS[0];
  let minDist = Math.abs(value - nearest);
  for (const step of FONT_SCALE_STEPS) {
    const dist = Math.abs(value - step);
    if (dist < minDist) {
      minDist = dist;
      nearest = step;
    }
  }
  return nearest;
}

export function fontScaleToSliderIndex(scale: number): number {
  const snapped = snapFontScale(scale);
  const idx = FONT_SCALE_STEPS.findIndex((s) => Math.abs(s - snapped) < STEP_TOLERANCE);
  return idx >= 0 ? idx : 0;
}

export function sliderIndexToFontScale(index: number): FontScaleStep {
  const i = Math.round(index);
  if (i <= 0) return FONT_SCALE_STEPS[0];
  if (i >= FONT_SCALE_STEPS.length - 1) return FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1];
  return FONT_SCALE_STEPS[i];
}

export function formatFontScaleLabel(scale: number): string {
  const snapped = snapFontScale(scale);
  return `${Math.round(snapped * 100)}%`;
}

/** True when free-plan single-page layout should use tighter typography. */
export function isHighFontScale(scale: number): boolean {
  return snapFontScale(scale) >= 1.35;
}
