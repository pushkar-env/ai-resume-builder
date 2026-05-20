/** A4 resume width (px). */
export const THUMBNAIL_PAGE_WIDTH_PX = 794;

/** A4 page height (px) — baseline for thumbnail scale so all cards fill like paginated previews. */
export const THUMBNAIL_PAGE_HEIGHT_PX = 1123;

const MIN_SCALE = 0.32;
const MAX_SCALE = 0.55;

/** Flowing body height inside `layout="continuous"` (excludes absolute watermark). */
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
 * Cover scale + top alignment (see TemplateThumbnail): fills the card edge-to-edge,
 * crops the bottom. Uses at least one A4 page of height for scale so short continuous
 * layouts match the original premium gallery (before pagination refactors).
 */
export function computeThumbnailCoverScale(
  hostWidth: number,
  hostHeight: number,
  contentHeight: number,
): number | null {
  if (hostWidth <= 0 || hostHeight <= 0 || contentHeight <= 0) return null;

  const ch = Math.max(contentHeight, THUMBNAIL_PAGE_HEIGHT_PX);
  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * 0.998;
  const scaleH = (hostHeight / ch) * 0.998;

  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.max(scaleW, scaleH)));
}
