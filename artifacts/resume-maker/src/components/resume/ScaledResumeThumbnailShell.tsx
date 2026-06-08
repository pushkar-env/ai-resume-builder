import {
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  computeGalleryViewportHeight,
  computeTemplateGalleryScale,
  THUMBNAIL_DEFAULT_VIEWPORT_H_PX,
  THUMBNAIL_PAGE_WIDTH_PX,
} from "@/lib/thumbnail-fit-scale";
import { useThumbnailMeasure } from "@/hooks/use-thumbnail-scale";

const SCALED_LAYER_STYLE = {
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
  pointerEvents: "none" as const,
  textRendering: "geometricPrecision" as const,
};

/**
 * Width-fit scale + fixed viewport height for card thumbnails.
 * Matches template gallery behavior so sparse/empty resumes show full-page structure (top-aligned).
 */
export function ScaledResumeThumbnailShell({
  hostClassName,
  measureDeps,
  children,
}: {
  hostClassName: string;
  measureDeps: readonly unknown[];
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.36);
  const [viewportH, setViewportH] = useState(THUMBNAIL_DEFAULT_VIEWPORT_H_PX);

  const lastDimensionsRef = useRef({ w: 0, h: 0 });

  const remeasure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;
    if (w === lastDimensionsRef.current.w && h === lastDimensionsRef.current.h) {
      return;
    }
    lastDimensionsRef.current = { w, h };
    const scale = computeTemplateGalleryScale(w);
    setFitScale(scale);
    setViewportH(computeGalleryViewportHeight(h, scale));
  }, []);

  useThumbnailMeasure(hostRef, null, remeasure, measureDeps);

  return (
    <div ref={hostRef} className={hostClassName}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div
          style={{
            width: THUMBNAIL_PAGE_WIDTH_PX,
            transformOrigin: "top center",
            transform: `scale(${fitScale})`,
            ...SCALED_LAYER_STYLE,
          }}
        >
          <div
            data-template-gallery-thumb
            className="flex flex-col"
            style={
              {
                width: THUMBNAIL_PAGE_WIDTH_PX,
                minHeight: viewportH,
                height: viewportH,
                "--gallery-viewport-h": `${viewportH}px`,
              } as CSSProperties
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
