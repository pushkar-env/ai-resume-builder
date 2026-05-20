/** A4 resume width in px — must match `.resume-continuous-canvas` / `.a4-page`. */
export const THUMBNAIL_PAGE_WIDTH_PX = 794;

const MIN_SCALE = 0.28;
const MAX_SCALE = 0.55;

export type ThumbnailFit = {
  scale: number;
  /** Host-space px offset to vertically center when content is shorter than the card. */
  offsetY: number;
};

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
 * Width-fit thumbnail layout: every preview spans the full card width (no side crop).
 * Short resumes are centered vertically; tall resumes are top-aligned with bottom crop.
 */
export function computeThumbnailWidthFit(
  hostWidth: number,
  hostHeight: number,
  contentHeight: number,
): ThumbnailFit | null {
  if (hostWidth <= 0 || hostHeight <= 0 || contentHeight <= 0) return null;

  const scaleW = (hostWidth / THUMBNAIL_PAGE_WIDTH_PX) * 0.998;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleW));
  const scaledHeight = contentHeight * scale;
  const offsetY =
    scaledHeight < hostHeight ? Math.max(0, (hostHeight - scaledHeight) / 2) : 0;

  return { scale, offsetY };
}
