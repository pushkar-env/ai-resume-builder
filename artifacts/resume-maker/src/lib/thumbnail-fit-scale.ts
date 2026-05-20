/** A4 resume width in px — must match `.resume-continuous-canvas` / `.a4-page`. */
export const THUMBNAIL_PAGE_WIDTH_PX = 794;

const MIN_SCALE = 0.28;
const MAX_SCALE = 0.55;

/**
 * Natural content height for `layout="continuous"` previews.
 * Ignores paginated measurement mounts so pagination refactors cannot inflate `ch`.
 */
export function measureContinuousCanvasHeight(measureRoot: HTMLElement): number {
  const canvas = measureRoot.querySelector<HTMLElement>(".resume-continuous-canvas");
  if (!canvas) return 0;

  const rectH = Math.ceil(canvas.getBoundingClientRect().height);
  const scrollH = canvas.scrollHeight;
  return Math.max(rectH, scrollH, 0);
}

/**
 * Cover-style scale: fills the thumbnail host (width + height), cropping overflow.
 * Clamped for legibility across breakpoints.
 */
export function computeThumbnailCoverScale(
  hostWidth: number,
  hostHeight: number,
  contentHeight: number,
): number | null {
  if (hostWidth <= 0 || hostHeight <= 0 || contentHeight <= 0) return null;

  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * 0.998;
  const scaleH = (hostHeight / contentHeight) * 0.998;
  const cover = Math.max(scaleW, scaleH);

  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, cover));
}
