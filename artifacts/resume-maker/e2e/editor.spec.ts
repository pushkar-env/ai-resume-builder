import { test, expect } from "@playwright/test";

test.describe("Resume Editor HTML Sanitizer Tests", () => {
  test("should completely empty out html containing only blank elements or space tags", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async () => {
      // @ts-ignore
      const mod = await import("/src/lib/sanitize-resume-rich-html.ts");
      return {
        emptyPara: mod.sanitizeResumeRichHtml("<p><br></p>"),
        emptyDiv: mod.sanitizeResumeRichHtml("<div><br></div>"),
        nestedEmpty: mod.sanitizeResumeRichHtml("<p><span><br></span></p>"),
        whitespaceOnly: mod.sanitizeResumeRichHtml("<p>  &nbsp; </p>"),
      };
    });

    expect(result.emptyPara).toBe("");
    expect(result.emptyDiv).toBe("");
    expect(result.nestedEmpty).toBe("");
    expect(result.whitespaceOnly).toBe("");
  });

  test("should preserve trailing paragraphs, spaces, and intermediate blank lines when content exists", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async () => {
      // @ts-ignore
      const mod = await import("/src/lib/sanitize-resume-rich-html.ts");
      return {
        withSpaces: mod.sanitizeResumeRichHtml("<p>Hello World </p>"),
        withTrailingLine: mod.sanitizeResumeRichHtml("<p>Line 1</p><p><br></p>"),
        withIntermediateLine: mod.sanitizeResumeRichHtml("<p>Line 1</p><p><br></p><p>Line 2</p>"),
      };
    });

    expect(result.withSpaces).toBe("<p>Hello World </p>");
    expect(result.withTrailingLine).toBe("<p>Line 1</p><p><br></p>");
    expect(result.withIntermediateLine).toBe("<p>Line 1</p><p><br></p><p>Line 2</p>");
  });
});
