import { test, expect } from "@playwright/test";

test.describe("ResumeSensei Auto-Fit Optimization Tests", () => {
  test("Should render single page at scale 1.0 when content fits", async ({ page }) => {
    // Navigate with a small height of 800px which easily fits in a single A4 page (1123px)
    await page.goto("/e2e-test-autofit?height=800&testId=fits", { waitUntil: "networkidle" });

    // Assert that we have exactly 1 visible page
    const pages = page.locator(".resume-paged-view > .a4-page");
    await expect(pages).toHaveCount(1);

    // Verify spacing and typography factors are at full scale (1.0)
    const body = page.locator(".resume-page-body").first();
    const spacingFactor = await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-spacing-factor").trim());
    const largeTypoFactor = await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-large-typo-factor").trim());
    const bodyFactor = await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-body-factor").trim());

    // In CSS, variables are resolved or passed down, since initial values are 1, they should be '1' or close to it
    expect(parseFloat(spacingFactor)).toBeCloseTo(1.0, 2);
    expect(parseFloat(largeTypoFactor)).toBeCloseTo(1.0, 2);
    expect(parseFloat(bodyFactor)).toBeCloseTo(1.0, 2);
  });

  test("Should scale down spacing factor to keep content within a single page", async ({ page }) => {
    // Navigate with dynamic=true. Element height starts at 1150px (exceeds page height 1123px).
    // It should shrink dynamically to fit exactly on 1 page by scaling spacing down.
    await page.goto("/e2e-test-autofit?dynamic=true&testId=scale-down", { waitUntil: "networkidle" });

    // Wait for the layout system to complete its measurement loop and settle
    await page.waitForTimeout(2000);

    // Assert that we still have exactly 1 visible page after scaling down spacing
    const pages = page.locator(".resume-paged-view > .a4-page");
    await expect(pages).toHaveCount(1);

    // Verify spacing factor was reduced, but large typography and body remain at 1.0 (Phase 1)
    const body = page.locator(".resume-page-body").first();
    const spacingFactor = parseFloat(await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-spacing-factor").trim()));
    const largeTypoFactor = parseFloat(await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-large-typo-factor").trim()));
    const bodyFactor = parseFloat(await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-body-factor").trim()));

    // Spacing factor should be scaled down (should be ~0.73)
    expect(spacingFactor).toBeLessThan(0.85);
    expect(spacingFactor).toBeGreaterThan(0.68);

    // Typographies should remain at 1.0 (Phase 1 priority: spacing reduced first!)
    expect(largeTypoFactor).toBeCloseTo(1.0, 2);
    expect(bodyFactor).toBeCloseTo(1.0, 2);
  });

  test("Should settle at minimum compression limit when content exceeds single page constraints", async ({ page }) => {
    // Navigate with a height of 1300px which exceeds a single A4 page and cannot be squeezed into 1 page
    await page.goto("/e2e-test-autofit?height=1300&testId=fallback", { waitUntil: "networkidle" });

    // Wait for the layout system to complete its measurement loop and settle
    await page.waitForTimeout(2000);

    // Assert that the page layout splits content into 2 pages but keeps maximum compression applied
    const pages = page.locator(".resume-paged-view > .a4-page");
    const count = await pages.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify that the scale factors are settled at their minimum allowed limits
    const body = page.locator(".resume-page-body").first();
    const spacingFactor = await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-spacing-factor").trim());
    const largeTypoFactor = await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-large-typo-factor").trim());
    const bodyFactor = await body.evaluate(el => getComputedStyle(el).getPropertyValue("--resume-body-factor").trim());

    expect(parseFloat(spacingFactor)).toBeCloseTo(0.50, 2);
    expect(parseFloat(largeTypoFactor)).toBeCloseTo(0.70, 2);
    expect(parseFloat(bodyFactor)).toBeCloseTo(0.85, 2);
  });
});
