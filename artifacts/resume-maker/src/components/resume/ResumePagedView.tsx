import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ResumeWatermark } from "@/components/resume/ResumeWatermark";

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const WATERMARK_RESERVE_PX = 28;
const MAX_PAGES = 10;
const CONTINUED_PAGE_TOP_PAD_PX = 20;

export interface ResumePagedViewProps {
  children: ReactNode;
  fontScale?: number;
  autoFit?: boolean;
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
function calculateCompression(f: number) {
  // f ranges from 0.82 to 1.0. Clamp it.
  const clampedF = Math.max(0.82, Math.min(1.0, f));
  const p = (1.0 - clampedF) / 0.18; // progress from 0 to 1

  let marginScale = 1.0;
  let spacingScale = 1.0;
  let headerScale = 1.0;
  let descScale = 1.0;

  // Phase 1: Page margins reduction (p: 0 -> 0.3)
  if (p <= 0.3) {
    marginScale = 1.0 - (p / 0.3) * 0.5; // down to 0.5
  } else {
    marginScale = 0.5;
  }

  // Phase 2: Section spacing reduction (p: 0.3 -> 0.6)
  if (p > 0.3 && p <= 0.6) {
    spacingScale = 1.0 - ((p - 0.3) / 0.3) * 0.55; // down to 0.45
  } else if (p > 0.6) {
    spacingScale = 0.45;
  }

  // Phase 3: Header font size reduction (p: 0.6 -> 0.85)
  if (p > 0.6 && p <= 0.85) {
    headerScale = 1.0 - ((p - 0.6) / 0.25) * 0.22; // down to 0.78
  } else if (p > 0.85) {
    headerScale = 0.78;
  }

  // Phase 4: Description font size reduction (p: 0.85 -> 1.0)
  if (p > 0.85) {
    descScale = 1.0 - ((p - 0.85) / 0.15) * 0.15; // down to 0.85
  }

  return { marginScale, spacingScale, headerScale, descScale };
}

export function ResumePagedView({
  children,
  fontScale = 1,
  showWatermark,
  backgroundColor,
  dataFontColor,
  sidebarFill = null,
  measureKey,
  autoFit = true,
}: ResumePagedViewProps) {
  const measureZoomRef = useRef<HTMLDivElement>(null);
  const [pageStarts, setPageStarts] = useState<number[]>([0]);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  
  const [testAutoFitScale, setTestAutoFitScale] = useState<number>(1);
  const [finalAutoFitScale, setFinalAutoFitScale] = useState<number>(1);
  const testAutoFitScaleRef = useRef(testAutoFitScale);
  testAutoFitScaleRef.current = testAutoFitScale;
  
  const prevMeasureKey = useRef(measureKey);
  const prevAutoFit = useRef(autoFit);

  if (prevMeasureKey.current !== measureKey || prevAutoFit.current !== autoFit) {
    prevMeasureKey.current = measureKey;
    prevAutoFit.current = autoFit;
    setTestAutoFitScale(1);
    testAutoFitScaleRef.current = 1;
  }

  const baseFs = fontScale > 0 && Number.isFinite(fontScale) ? fontScale : 1;
  const viewHeight = PAGE_HEIGHT_PX - (showWatermark ? WATERMARK_RESERVE_PX : 0);

  useLayoutEffect(() => {
    const el = measureZoomRef.current;
    if (!el) return;

    let cancelled = false;
    let debounceId = 0;
    let rafId = 0;

    const run = () => {
      if (cancelled) return;
      const rootRect = el.getBoundingClientRect();
      const totalHeight = Math.max(
        el.scrollHeight,
        el.offsetHeight,
        el.getBoundingClientRect().height,
        Math.ceil(rootRect.height),
      );
      if (!Number.isFinite(totalHeight) || totalHeight <= 0) {
        setMeasuredHeight(0);
        setPageStarts([0]);
        return;
      }

      // Auto-Fit Logic using progressive compression variables
      if (autoFit && totalHeight > viewHeight && testAutoFitScaleRef.current > 0.82) {
        const overflowRatio = totalHeight / viewHeight;
        if (overflowRatio > 1.005) {
          const idealDrop = testAutoFitScaleRef.current - (testAutoFitScaleRef.current / overflowRatio);
          const safeDrop = Math.min(0.03, Math.max(0.005, idealDrop));
          const targetScale = Math.max(0.82, testAutoFitScaleRef.current - safeDrop);
          
          setTestAutoFitScale(targetScale);
          return; // Wait for next render cycle with new scale
        }
      }

      setMeasuredHeight(totalHeight);
      setFinalAutoFitScale(testAutoFitScaleRef.current);

      const keepBlocks = Array.from(
        el.querySelectorAll<HTMLElement>(
          [
            "[data-resume-keep]",
            ".resume-export-block",
            ".resume-section-header",
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

      const maxContentBottom = keepBlocks.length > 0
        ? Math.max(...keepBlocks.map((b) => b.bottom))
        : totalHeight;

      const starts: number[] = [0];
      const minStep = 48;
      const keepThreshold = Math.floor(viewHeight * 0.92);

      while (starts.length < MAX_PAGES) {
        const current = starts[starts.length - 1]!;
        const currentPageIndex = starts.length - 1;
        const currentPageCapacity =
          currentPageIndex === 0 ? viewHeight : Math.max(1, viewHeight - CONTINUED_PAGE_TOP_PAD_PX);
        const idealNext = current + currentPageCapacity;
        
        // If the current page can fit all remaining visible content, we are done.
        if (idealNext >= maxContentBottom || idealNext >= totalHeight) break;

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

        // If the only content left to put on the new page is extremely tiny (< 15px),
        // it's likely just bottom padding, border, or a tiny spacer. 
        // Discard it to prevent a blank extra page.
        if (maxContentBottom - next < 15) {
          break;
        }

        if (next <= current) break;
        starts.push(next);
      }

      setPageStarts(starts);
    };

    const schedule = () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          requestAnimationFrame(run);
        });
      }, 24);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
      cancelAnimationFrame(rafId);
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

  const pageShell = (pageIndex: number, start: number, span: number, topPad: number) => {
    const comp = calculateCompression(finalAutoFitScale);
    return (
      <div
        key={pageIndex}
        className="a4-page relative mb-6 overflow-hidden bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)] print:mb-0 print:shadow-none"
        data-font-color={dataFontColor || undefined}
        style={{
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          maxHeight: PAGE_HEIGHT_PX,
          backgroundColor,
          "--resume-margin-scale": comp.marginScale,
          "--resume-spacing-scale": comp.spacingScale,
          "--resume-header-scale": comp.headerScale,
          "--resume-desc-scale": comp.descScale,
        } as any}
      >
        {sidebarFill ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-0"
            style={{
              width: Math.max(0, Math.round(sidebarFill.widthPx * baseFs)),
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
              className="absolute bottom-0 z-0"
              style={{
                height: viewHeight - (topPad + span),
                backgroundColor,
                left: sidebarFill ? Math.max(0, Math.round(sidebarFill.widthPx * baseFs)) : 0,
                right: 0,
              }}
            >
            </div>
          ) : null}
          <div style={{ transform: topPad ? `translateY(${topPad}px)` : undefined }}>
          <div style={{ height: span, overflow: "hidden" }}>
            <div style={{ transform: `translateY(-${start}px)` }}>
              <div style={{ zoom: baseFs, width: "100%" }}>{children}</div>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  };

  const measureComp = calculateCompression(testAutoFitScale);
  const measureMount =
    typeof document !== "undefined"
      ? createPortal(
          <div
            aria-hidden
            className="resume-measure-mount resume-paged-view pointer-events-none"
            style={{
              position: "fixed",
              left: "-100vw",
              top: 0,
              width: PAGE_WIDTH_PX,
              visibility: "hidden",
              zIndex: -1,
              overflow: "visible",
            }}
          >
            <div
              ref={measureZoomRef}
              style={{
                zoom: baseFs,
                width: "100%",
                "--resume-margin-scale": measureComp.marginScale,
                "--resume-spacing-scale": measureComp.spacingScale,
                "--resume-header-scale": measureComp.headerScale,
                "--resume-desc-scale": measureComp.descScale,
              } as any}
            >
              {children}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="resume-paged-view relative flex flex-col items-center">
      {measureMount}
      {pageWindows.map((w, i) => pageShell(i, w.start, w.span, w.topPad))}
    </div>
  );
}
