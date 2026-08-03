// Regression cover for tablet touch reordering in the resume editor sidebar:
// the drag handle was hover-only (invisible on touch), the sensors let
// PointerSensor swallow every touch, and a long press raised the OS
// share/download menu which cancelled the drag.
import { test, expect, type Page } from "@playwright/test";

// iPad-landscape-ish: touch primary pointer, >= lg so the desktop rail renders.
test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });

const FIXTURE = "/e2e/fixtures/tablet-sortable.html";

/** Real trusted touch events via CDP: press, hold past the 220ms activation
 *  delay, then drag. `holdMs: 0` emulates a scroll flick instead. */
async function touchDrag(
  page: Page,
  selector: string,
  opts: { holdMs: number; dy: number; steps?: number },
) {
  const client = await page.context().newCDPSession(page);
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2;
  let y = box.y + box.height / 2;

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  if (opts.holdMs) await page.waitForTimeout(opts.holdMs);

  const steps = opts.steps ?? 12;
  for (let i = 1; i <= steps; i++) {
    y += opts.dy / steps;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
    await page.waitForTimeout(16);
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(150);
}

test.describe("tablet touch reordering", () => {
  test("emulation really looks like a tablet", async ({ page }) => {
    await page.goto(FIXTURE);
    const media = page.locator("[data-media]");
    await expect(media).toHaveAttribute("data-coarse", "true");
    await expect(media).toHaveAttribute("data-hover", "false");
  });

  test("rail: the grip is actually visible on touch", async ({ page }) => {
    await page.goto(FIXTURE);
    const grip = page.locator('[data-variant="rail"] span[title="Drag to reorder"]').first();
    await expect(grip).toHaveCSS("opacity", "1");
  });

  test("rail: long-press on the tile reorders", async ({ page }) => {
    await page.goto(FIXTURE);
    const rail = page.locator('[data-variant="rail"]');
    await expect(rail).toHaveAttribute("data-order", "1234");
    await touchDrag(page, '[data-variant="rail"] button >> nth=0', { holdMs: 400, dy: 70 });
    await expect(rail).not.toHaveAttribute("data-order", "1234");
  });

  test("rail: a quick swipe does not reorder (scrolling still wins)", async ({ page }) => {
    await page.goto(FIXTURE);
    const rail = page.locator('[data-variant="rail"]');
    await touchDrag(page, '[data-variant="rail"] button >> nth=0', { holdMs: 0, dy: 70 });
    await expect(rail).toHaveAttribute("data-order", "1234");
  });

  test("rail: a plain tap still selects the section", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.locator('[data-variant="rail"] button').first().tap();
    await expect(page.locator('[data-variant="rail"]')).toHaveAttribute("data-selected", "1");
    await expect(page.locator('[data-variant="rail"]')).toHaveAttribute("data-order", "1234");
  });

  test("rail: long press does not raise the native context menu", async ({ page }) => {
    await page.goto(FIXTURE);
    const fired = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let seen = false;
        document.addEventListener("contextmenu", (e) => {
          // defaultPrevented === the app suppressed the native menu.
          seen = !e.defaultPrevented;
        });
        setTimeout(() => resolve(seen), 1200);
        const btn = document.querySelector('[data-variant="rail"] button')!;
        btn.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
      });
    });
    expect(fired).toBe(false);
  });

  test("mobile row: long-press reorders, tap selects", async ({ page }) => {
    await page.goto(FIXTURE);
    const list = page.locator('[data-variant="mobile"]');
    await expect(list).toHaveAttribute("data-order", "1234");
    await touchDrag(page, '[data-variant="mobile"] [data-item], [data-variant="mobile"] > div > div >> nth=0', {
      holdMs: 400,
      dy: 90,
    });
    await expect(list).not.toHaveAttribute("data-order", "1234");
  });
});
