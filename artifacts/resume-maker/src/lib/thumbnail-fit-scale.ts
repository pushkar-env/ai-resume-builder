/** A4 resume width (px). */
export const THUMBNAIL_PAGE_WIDTH_PX = 794;

const MIN_SCALE = 0.32;
const MAX_SCALE = 0.55;

/** Flowing body height inside `layout="continuous"`. */
export function measureContinuousCanvasHeight(measureRoot: HTMLElement): number {
  const canvas = measureRoot.querySelector<HTMLElement>(".resume-continuous-canvas");
  if (!canvas) return measureRoot.scrollHeight;

  const contentCol = canvas.querySelector<HTMLElement>(":scope > .relative");
  const target = contentCol ?? canvas;
  return Math.max(
    Math.ceil(target.getBoundingClientRect().height),
    target.scrollHeight,
    0,
  );
}

/**
 * Gallery thumbnail scale: lock to card width (never crop left/right).
 * Tiny inset factor avoids sub-pixel edge clipping on retina screens.
 */
export function computeTemplateGalleryScale(hostWidth: number): number {
  if (hostWidth <= 0) return 0.36;
  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * 0.996;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleW));
}

/**
 * Dashboard resume cards: cover fit (may crop edges) using full content height.
 */
export function computeThumbnailCoverScale(
  hostWidth: number,
  hostHeight: number,
  contentHeight: number,
): number | null {
  if (hostWidth <= 0 || hostHeight <= 0 || contentHeight <= 0) return null;

  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * 0.996;
  const scaleH = (hostHeight / contentHeight) * 0.996;

  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.max(scaleW, scaleH)));
}
