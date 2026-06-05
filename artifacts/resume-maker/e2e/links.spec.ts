import { test, expect } from "@playwright/test";

test.describe("Resume Links Target Blank Tests", () => {
  test("should sanitize and force target='_blank' on standard external links in rich html", async ({ page }) => {
    // Navigate to pricing page as a safe loaded context
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });

    // Evaluate sanitizeResumeRichHtml in the browser page context
    const sanitizedHtml = await page.evaluate(async () => {
      // @ts-ignore
      const mod = await import("/src/lib/sanitize-resume-rich-html.ts");
      return mod.sanitizeResumeRichHtml(
        '<p>Check out <a href="https://google.com">Google</a> and <a href="http://example.org">Example</a></p>'
      );
    });

    expect(sanitizedHtml).toContain('target="_blank"');
    expect(sanitizedHtml).toContain('rel="noreferrer noopener"');
    expect(sanitizedHtml).toContain('href="https://google.com"');
    expect(sanitizedHtml).toContain('href="http://example.org"');
  });

  test("should NOT force target='_blank' on mailto or tel links in rich html", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });

    const sanitizedHtml = await page.evaluate(async () => {
      // @ts-ignore
      const mod = await import("/src/lib/sanitize-resume-rich-html.ts");
      return mod.sanitizeResumeRichHtml(
        '<p>Contact <a href="mailto:test@example.com">Email</a> or <a href="tel:+1234567890">Phone</a></p>'
      );
    });

    expect(sanitizedHtml).not.toContain('target="_blank"');
    expect(sanitizedHtml).not.toContain('rel="noreferrer noopener"');
    expect(sanitizedHtml).toContain('href="mailto:test@example.com"');
    expect(sanitizedHtml).toContain('href="tel:+1234567890"');
  });
});
