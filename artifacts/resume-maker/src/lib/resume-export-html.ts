import { RESUME_PDF_EXPORT_CSS } from "@/lib/resume-export-styles";

const MAX_INLINE_STYLESHEET_BYTES = 2 * 1024 * 1024;

async function inlineStylesheet(href: string): Promise<string | null> {
  try {
    const res = await fetch(href, { credentials: "same-origin" });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_INLINE_STYLESHEET_BYTES) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Build a self-contained HTML document for server-side PDF rendering.
 * Stylesheets are inlined on the client so Puppeteer does not depend on
 * external network requests (fonts, CDN CSS, etc.).
 */
export async function buildSelfContainedExportHtml(
  resumeTitle: string,
): Promise<string | null> {
  const previewEl = document.querySelector<HTMLElement>(
    "[data-resume-export-target]",
  );
  if (!previewEl) return null;

  const styleBlocks: string[] = [];

  const headChildren = Array.from(document.head.children);
  const stylesheetLinks = headChildren.filter(
    (el): el is HTMLLinkElement =>
      el.tagName === "LINK" &&
      (el as HTMLLinkElement).rel === "stylesheet" &&
      Boolean((el as HTMLLinkElement).href),
  );

  for (const el of headChildren) {
    if (el.tagName === "STYLE") {
      const css = el.textContent?.trim();
      if (css) styleBlocks.push(css);
    }
  }

  const inlined = await Promise.all(
    stylesheetLinks.map((link) =>
      inlineStylesheet(new URL(link.href, document.baseURI).href),
    ),
  );
  for (const css of inlined) {
    if (css) styleBlocks.push(css);
  }

  const safeTitle = resumeTitle.replace(/[<>]/g, "");
  const combinedCss = styleBlocks.join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    ${combinedCss}
    ${RESUME_PDF_EXPORT_CSS}
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${previewEl.outerHTML.trim()}</body>
</html>`;
}
