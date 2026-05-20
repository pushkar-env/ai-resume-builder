/** Vertical gap between stacked `.a4-page` cards (`mb-6`). */
export const A4_PAGE_STACK_GAP_PX = 24;

const MIN_PAGED_HEIGHT_PX = 1123;

/**
 * Total rendered height of a paginated resume preview (all A4 pages + gaps).
 * Prefer summing `.a4-page` boxes — more reliable than scrollHeight when a parent uses `display:none` or CSS zoom.
 */
export function measureResumePagedViewHeight(root: HTMLElement | null): number {
  if (!root) return MIN_PAGED_HEIGHT_PX;

  const paged = root.querySelector<HTMLElement>(".resume-paged-view");
  if (!paged) {
    return Math.max(
      MIN_PAGED_HEIGHT_PX,
      Math.ceil(root.getBoundingClientRect().height),
      root.scrollHeight,
    );
  }

  const pages = paged.querySelectorAll<HTMLElement>(".a4-page");
  if (pages.length > 0) {
    let sum = 0;
    pages.forEach((page, index) => {
      const h = Math.max(
        page.offsetHeight,
        Math.ceil(page.getBoundingClientRect().height),
      );
      if (h > 0) sum += h;
      if (index < pages.length - 1) sum += A4_PAGE_STACK_GAP_PX;
    });
    if (sum > 0) {
      return Math.max(
        sum,
        paged.scrollHeight,
        Math.ceil(paged.getBoundingClientRect().height),
      );
    }
  }

  return Math.max(
    MIN_PAGED_HEIGHT_PX,
    paged.scrollHeight,
    Math.ceil(paged.getBoundingClientRect().height),
    Math.ceil(root.getBoundingClientRect().height),
    root.scrollHeight,
  );
}
