import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ResumeWatermark } from "@/components/resume/ResumeWatermark";

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const WATERMARK_RESERVE_PX = 28;
const MAX_PAGES = 10;

export interface ResumePagedViewProps {
  children: ReactNode;
  fontScale?: number;
  showWatermark: boolean;
  backgroundColor: string;
  /** Change when resume content / template changes to re-measure */
  measureKey: string;
}

/**
 * Fixed-size A4 pages with a per-page watermark layer.
 * Uses one continuous layout measurement + vertical windowing (`translateY`)
 * so all templates paginate consistently without duplicating template markup logic.
 */
export function ResumePagedView({
  children,
  fontScale = 1,
  showWatermark,
  backgroundColor,
  measureKey,
}: ResumePagedViewProps) {
  const measureZoomRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  const fs = fontScale > 0 && Number.isFinite(fontScale) ? fontScale : 1;
  const viewHeight = PAGE_HEIGHT_PX - (showWatermark ? WATERMARK_RESERVE_PX : 0);

  useLayoutEffect(() => {
    const el = measureZoomRef.current;
    if (!el) return;

    const run = () => {
      // Use visual (post-zoom) height so measurement and translate offsets use one coordinate space.
      const h = Math.ceil(el.getBoundingClientRect().height);
      const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(h / viewHeight)));
      setPageCount(pages);
    };

    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const ro = new ResizeObserver(() => requestAnimationFrame(run));
    ro.observe(el);

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [measureKey, viewHeight]);

  const pageShell = (pageIndex: number) => (
    <div
      key={pageIndex}
      className="a4-page relative mb-6 overflow-hidden bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)] print:mb-0 print:shadow-none"
      style={{
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        maxHeight: PAGE_HEIGHT_PX,
        backgroundColor,
      }}
    >
      {showWatermark ? (
        <div
          className="resume-page-watermark pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center"
          aria-hidden
        >
          <ResumeWatermark backgroundColor={backgroundColor} />
        </div>
      ) : null}
      <div
        className="resume-page-body relative z-[1] box-border w-full overflow-hidden"
        style={{ height: viewHeight }}
      >
        <div style={{ transform: `translateY(-${pageIndex * viewHeight}px)` }}>
          <div style={{ zoom: fs, width: "100%" }}>{children}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="resume-paged-view flex flex-col items-center">
      {/* Off-screen measurement — same width + zoom as visible pages */}
      <div
        className="pointer-events-none fixed left-[-12000px] top-0 -z-10 opacity-0"
        style={{ width: PAGE_WIDTH_PX }}
        aria-hidden
      >
        <div ref={measureZoomRef} style={{ zoom: fs, width: "100%" }}>
          {children}
        </div>
      </div>

      {Array.from({ length: pageCount }, (_, i) => pageShell(i))}
    </div>
  );
}
