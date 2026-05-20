import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ResumeWatermark } from "@/components/resume/ResumeWatermark";

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const WATERMARK_RESERVE_PX = 28;
const MAX_PAGES = 10;
const CONTINUED_PAGE_TOP_PAD_PX = 20;

export interface ResumePagedViewProps {
  children: ReactNode;
  fontScale?: number;
  showWatermark: boolean;
  backgroundColor: string;
  /** Applied to each `.a4-page` for custom font-color overrides in injected CSS */
  dataFontColor?: string;
  sidebarFill?: {
    widthPx: number;
    color: string;
  } | null;
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
  dataFontColor,
  sidebarFill = null,
  measureKey,
}: ResumePagedViewProps) {
  const measureZoomRef = useRef<HTMLDivElement>(null);
  const [pageStarts, setPageStarts] = useState<number[]>([0]);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);

  const fs = fontScale > 0 && Number.isFinite(fontScale) ? fontScale : 1;
  const viewHeight = PAGE_HEIGHT_PX - (showWatermark ? WATERMARK_RESERVE_PX : 0);

  useLayoutEffect(() => {
    const el = measureZoomRef.current;
    if (!el) return;

    const run = () => {
      // Use visual (post-zoom) height so measurement and translate offsets use one coordinate space.
      const rootRect = el.getBoundingClientRect();
      const totalHeight = Math.ceil(rootRect.height);
      if (!Number.isFinite(totalHeight) || totalHeight <= 0) {
        setMeasuredHeight(0);
        setPageStarts([0]);
        return;
      }
      setMeasuredHeight(totalHeight);

      const keepBlocks = Array.from(
        el.querySelectorAll<HTMLElement>(
          [
            "[data-resume-keep]",
            ".resume-export-block",
            ".resume-export-grid > div",
            ".grid > div",
            "[class*='space-y-'] > div",
            ".resume-text p",
            ".resume-text li",
            ".resume-text > div",
          ].join(", "),
        ),
      )
        .map((node) => {
          const r = node.getBoundingClientRect();
          const top = Math.max(0, Math.floor(r.top - rootRect.top));
          const bottom = Math.min(totalHeight, Math.ceil(r.bottom - rootRect.top));
          return { top, bottom, height: bottom - top };
        })
        .filter((b) => b.height > 0)
        .sort((a, b) => a.top - b.top);

      const starts: number[] = [0];
      const minStep = 48;
      const keepThreshold = Math.floor(viewHeight * 0.92);

      while (starts.length < MAX_PAGES) {
        const current = starts[starts.length - 1]!;
        const currentPageIndex = starts.length - 1;
        const currentPageCapacity =
          currentPageIndex === 0 ? viewHeight : Math.max(1, viewHeight - CONTINUED_PAGE_TOP_PAD_PX);
        const idealNext = current + currentPageCapacity;
        if (idealNext >= totalHeight) break;

        let next = idealNext;
        const crossing = keepBlocks.find(
          (b) => b.top < idealNext && b.bottom > idealNext && b.height <= keepThreshold,
        );

        if (crossing) {
          const beforeBlock = crossing.top;
          // Move the whole block to next page, unless it would stall pagination.
          if (beforeBlock - current >= minStep) {
            next = beforeBlock;
          }
        }

        if (next - current < minStep) {
          next = Math.min(totalHeight, current + viewHeight);
        }

        if (next <= current) break;
        starts.push(next);
      }

      setPageStarts(starts);
    };

    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const ro = new ResizeObserver(() => requestAnimationFrame(run));
    ro.observe(el);

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [measureKey, viewHeight]);

  const pageWindows = useMemo(
    () =>
      pageStarts.map((start, index) => {
        const nextStart = pageStarts[index + 1];
        const topPad = index === 0 ? 0 : CONTINUED_PAGE_TOP_PAD_PX;
        const maxSpan = Math.max(1, viewHeight - topPad);
        // Until measurement runs (measuredHeight === 0), assume a full viewport of content — avoids clipped/blank thumbnails and preview shells.
        const naturalEnd =
          nextStart ??
          (measuredHeight > 0 ? measuredHeight : start + maxSpan);
        const span = Math.max(0, Math.min(maxSpan, naturalEnd - start));
        return { start, span, topPad };
      }),
    [pageStarts, measuredHeight, viewHeight],
  );

  const pageShell = (pageIndex: number, start: number, span: number, topPad: number) => (
    <div
      key={pageIndex}
      className="a4-page relative mb-6 overflow-hidden bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)] print:mb-0 print:shadow-none"
      data-font-color={dataFontColor || undefined}
      style={{
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        maxHeight: PAGE_HEIGHT_PX,
        backgroundColor,
      }}
    >
      {sidebarFill ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-0"
          style={{
            width: Math.max(0, Math.round(sidebarFill.widthPx * fs)),
            backgroundColor: sidebarFill.color,
          }}
        />
      ) : null}
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
        {topPad + span < viewHeight ? (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 z-0"
            style={{ height: viewHeight - (topPad + span), backgroundColor }}
          >
          </div>
        ) : null}
        <div style={{ transform: topPad ? `translateY(${topPad}px)` : undefined }}>
        <div style={{ height: span, overflow: "hidden" }}>
          <div style={{ transform: `translateY(-${start}px)` }}>
            <div style={{ zoom: fs, width: "100%" }}>{children}</div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="resume-paged-view relative flex flex-col items-center">
      {/* Isolated measurement: zero layout footprint so card/preview scrollHeight & observers stay accurate */}
      <div
        aria-hidden
        className="resume-measure-mount pointer-events-none invisible"
        style={{
          position: "absolute",
          left: -26000,
          top: 0,
          width: PAGE_WIDTH_PX,
          height: 0,
          overflow: "hidden",
        }}
      >
        <div ref={measureZoomRef} style={{ zoom: fs, width: "100%" }}>
          {children}
        </div>
      </div>

      {pageWindows.map((w, i) => pageShell(i, w.start, w.span, w.topPad))}
    </div>
  );
}
