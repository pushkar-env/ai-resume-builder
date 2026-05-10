import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 }, // iPhone 12/13-ish
  { name: "tablet", width: 820, height: 1180 }, // iPad Air-ish
  { name: "desktop", width: 1440, height: 900 },
] as const;

const PAGES: Array<{ path: string; titleLike: RegExp }> = [
  { path: "/", titleLike: /resume/i },
  { path: "/pricing", titleLike: /pricing/i },
  { path: "/sign-in", titleLike: /sign in/i },
  { path: "/sign-up", titleLike: /sign up/i },
  { path: "/this-route-does-not-exist", titleLike: /not found|404/i },
];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const ok = await page.evaluate(() => {
    const el = document.documentElement;
    const body = document.body;
    // Allow 1px rounding differences.
    const docOk = el.scrollWidth <= el.clientWidth + 1;
    const bodyOk = body ? body.scrollWidth <= body.clientWidth + 1 : true;
    return docOk && bodyOk;
  });
  expect(ok).toBeTruthy();
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} viewport`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const p of PAGES) {
      test(`responsive smoke: ${p.path}`, async ({ page }) => {
        await page.goto(p.path, { waitUntil: "domcontentloaded" });

        // Basic "page rendered" sanity.
        const title = await page.title();
        expect(title).toBeTruthy();

        // Presence of expected H1-ish content (robust against minor text changes).
        await expect(page.getByRole("heading").first()).toBeVisible();

        // Key assertion: no unexpected horizontal overflow at this viewport.
        await expectNoHorizontalOverflow(page);
      });
    }
  });
}

