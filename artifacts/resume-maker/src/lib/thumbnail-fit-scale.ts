/** A4 resume width in px — must match `.resume-continuous-canvas` / `.a4-page`. */
export const THUMBNAIL_PAGE_WIDTH_PX = 794;

/** Even gutter inside template card preview hosts (px). */
export const THUMBNAIL_PREVIEW_INSET_PX = 10;

const MIN_SCALE = 0.28;
const MAX_SCALE = 0.55;

export type ThumbnailFit = {
  scale: number;
};

/**
 * Flowing resume body inside continuous layout (excludes absolute watermark layer).
 */
export function measureContinuousCanvasHeight(measureRoot: HTMLElement): number {
  const canvas = measureRoot.querySelector<HTMLElement>(".resume-continuous-canvas");
  if (!canvas) return 0;

  const contentCol =
    canvas.querySelector<HTMLElement>(":scope > .relative") ?? canvas;

  const canvasTop = canvas.getBoundingClientRect().top;
  const colRect = contentCol.getBoundingClientRect();
  const visualH = Math.ceil(colRect.bottom - canvasTop);

  return Math.max(visualH, contentCol.scrollHeight, canvas.scrollHeight, 0);
}

/**
 * Width-fit scale for a padded preview viewport. Pair with CSS centering:
 * `left/top: 50%` + `translate(-50%, -50%) scale(scale)`.
 */
export function computeThumbnailWidthFit(
  viewportWidth: number,
  viewportHeight: number,
  contentHeight: number,
): ThumbnailFit | null {
  if (viewportWidth <= 0 || viewportHeight <= 0 || contentHeight <= 0) return null;

  const scaleW = (viewportWidth / THUMBNAIL_PAGE_WIDTH_PX) * 0.998;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleW));

  return { scale };
}
