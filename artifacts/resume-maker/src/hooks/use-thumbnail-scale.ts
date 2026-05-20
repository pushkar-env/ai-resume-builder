import { useEffect, useRef, type RefObject } from "react";

/** Double rAF so layout/fonts settle before measuring (content-visibility cards). */
export function scheduleThumbnailMeasure(cb: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(cb));
}

/**
 * ResizeObserver on host (+ optional measure node) with coalesced measurement.
 */
export function useThumbnailMeasure(
  hostRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null> | null,
  measure: () => void,
  deps: readonly unknown[],
): void {
  const measureRefStable = useRef(measure);
  measureRefStable.current = measure;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const run = () => measureRefStable.current();
    const schedule = () => scheduleThumbnailMeasure(run);

    schedule();
    const roHost = new ResizeObserver(schedule);
    roHost.observe(host);

    const el = measureRef?.current;
    const roMeasure = el ? new ResizeObserver(schedule) : null;
    if (el && roMeasure) roMeasure.observe(el);

    return () => {
      roHost.disconnect();
      roMeasure?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies reactive deps
  }, deps);
}
