import { test, expect, type Page } from "@playwright/test";

/**
 * Auto-fit compresses a resume to keep it on one page, in phases: page margins
 * first, then section spacing, then heading type, then body type. Each phase is
 * exposed as a CSS custom property on `.a4-page`.
 *
 * These tests previously targeted a `/e2e-test-autofit` route and
 * `--resume-*-factor` variables, neither of which exist any more — auto-fit was
 * rewritten around `--resume-*-scale` and the route was dropped, so every test
 * here failed on a blank page. They now drive the real ResumePagedView through
 * e2e/fixtures/autofit.html.
 */

const FIXTURE = "/e2e/fixtures/autofit.html";

/** The floor each phase reaches at maximum compression (autoFitScale 0.82). */
const FLOOR = { margin: 0.5, spacing: 0.45, header: 0.78, desc: 0.85 };

async function compressionScales(page: Page) {
  const body = page.locator(".resume-page-body").first();
  return body.evaluate((el) => {
    const cs = getComputedStyle(el);
    const read = (name: string) => parseFloat(cs.getPropertyValue(name).trim());
    return {
      margin: read("--resume-margin-scale"),
      spacing: read("--resume-spacing-scale"),
      header: read("--resume-header-scale"),
      desc: read("--resume-desc-scale"),
    };
  });
}

test.describe("ResumeSensei Auto-Fit Optimization Tests", () => {
  test("Should render single page at scale 1.0 when content fits", async ({ page }) => {
    // Comfortably inside one A4 page, so nothing should compress.
    await page.goto(`${FIXTURE}?blocks=8&lines=3`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    await expect(page.locator(".resume-paged-view > .a4-page")).toHaveCount(1);

    const scales = await compressionScales(page);
    expect(scales.margin).toBeCloseTo(1.0, 2);
    expect(scales.spacing).toBeCloseTo(1.0, 2);
    expect(scales.header).toBeCloseTo(1.0, 2);
    expect(scales.desc).toBeCloseTo(1.0, 2);
  });

  test("Should scale down spacing to keep content within a single page", async ({ page }) => {
    // Just past one page: compression should claw the overflow back rather than
    // spill onto a second page.
    await page.goto(`${FIXTURE}?blocks=14&lines=3`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    await expect(page.locator(".resume-paged-view > .a4-page")).toHaveCount(1);

    const scales = await compressionScales(page);
    // Whitespace gave way first (phases 1-2)...
    expect(scales.margin).toBeLessThan(1.0);
    expect(scales.spacing).toBeLessThan(1.0);
    expect(scales.spacing).toBeGreaterThanOrEqual(FLOOR.spacing);
    // ...and body copy is still full size: legibility is surrendered last.
    expect(scales.desc).toBeCloseTo(1.0, 2);
  });

  test("Should settle at minimum compression limit when content exceeds single page constraints", async ({ page }) => {
    // Far too much content to squeeze onto one page at any scale: the loop should
    // bottom out and the overflow should paginate rather than be clipped away.
    await page.goto(`${FIXTURE}?blocks=20&lines=4`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const pages = page.locator(".resume-paged-view > .a4-page");
    expect(await pages.count()).toBeGreaterThanOrEqual(2);

    const scales = await compressionScales(page);
    expect(scales.margin).toBeCloseTo(FLOOR.margin, 2);
    expect(scales.spacing).toBeCloseTo(FLOOR.spacing, 2);
    expect(scales.header).toBeCloseTo(FLOOR.header, 2);
    expect(scales.desc).toBeCloseTo(FLOOR.desc, 2);
  });
});
