/** A4 resume width (px) — matches `.a4-page` / `.resume-continuous-canvas`. */
export const THUMBNAIL_PAGE_WIDTH_PX = 794;

/** Default A4 height for gallery viewport before first measure. */
export const THUMBNAIL_DEFAULT_VIEWPORT_H_PX = 1123;

export const THUMBNAIL_MIN_SCALE = 0.32;
export const THUMBNAIL_MAX_SCALE = 0.55;

const WIDTH_INSET = 0.996;

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

/** Template gallery: width-fit scale (no horizontal crop). */
export function computeTemplateGalleryScale(hostWidth: number): number {
  if (hostWidth <= 0) return 0.36;
  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * WIDTH_INSET;
  return Math.min(THUMBNAIL_MAX_SCALE, Math.max(THUMBNAIL_MIN_SCALE, scaleW));
}

/** Unscaled document height that matches the visible card clip. */
export function computeGalleryViewportHeight(
  hostHeight: number,
  scale: number,
): number {
  if (hostHeight <= 0 || scale <= 0) return THUMBNAIL_DEFAULT_VIEWPORT_H_PX;
  return Math.ceil(hostHeight / scale);
}

/** Dashboard cards: cover fit using full content height. */
export function computeThumbnailCoverScale(
  hostWidth: number,
  hostHeight: number,
  contentHeight: number,
): number | null {
  if (hostWidth <= 0 || hostHeight <= 0 || contentHeight <= 0) return null;

  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * WIDTH_INSET;
  const scaleH = (hostHeight / contentHeight) * WIDTH_INSET;

  return Math.min(
    THUMBNAIL_MAX_SCALE,
    Math.max(THUMBNAIL_MIN_SCALE, Math.max(scaleW, scaleH)),
  );
}
