/** A4 at 96dpi — matches `.a4-page` in the builder preview. */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

const STYLESHEET_WAIT_MS = 5_000;

/**
 * Build a complete HTML document from the live resume preview DOM,
 * including stylesheets from the current document head.
 */
export function buildExportHtml(resumeTitle: string): string | null {
  const previewEl = document.querySelector<HTMLElement>("[data-resume-export-target]");
  if (!previewEl) return null;

  const headEls = Array.from(document.head.children).filter((el) => {
    if (el.tagName === "STYLE") return true;
    if (el.tagName === "LINK" && (el as HTMLLinkElement).rel === "stylesheet") return true;
    return false;
  });

  const headHtml = headEls
    .map((el) => {
      if (el.tagName === "LINK") {
        const link = el as HTMLLinkElement;
        const absHref = new URL(link.href, document.baseURI).href;
        return `<link rel="stylesheet" href="${absHref}" crossorigin="anonymous" />`;
      }
      return el.outerHTML;
    })
    .join("\n");

  const safeTitle = resumeTitle.replace(/[<>]/g, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  ${headHtml}
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    body { display: flex; justify-content: center; }
    .a4-page {
      box-shadow: none !important;
      width: ${A4_WIDTH_PX}px !important;
      min-height: ${A4_HEIGHT_PX}px !important;
      margin: 0 !important;
    }
    .a4-page[data-watermarked] {
      height: ${A4_HEIGHT_PX}px !important;
      max-height: ${A4_HEIGHT_PX}px !important;
      overflow: hidden !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  ${previewEl.outerHTML}
</body>
</html>`;
}

/** Wait for export iframe stylesheets and web fonts before rasterizing. */
export async function waitForExportDocument(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  const pending = links.filter((l) => !l.sheet);

  const stylesheetDone = Promise.all(
    pending.map(
      (link) =>
        new Promise<void>((resolve) => {
          const finish = () => resolve();
          link.addEventListener("load", finish, { once: true });
          link.addEventListener("error", finish, { once: true });
        }),
    ),
  );

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, STYLESHEET_WAIT_MS);
  });

  await Promise.race([stylesheetDone, timeout]);

  if (doc.fonts?.ready) {
    await Promise.race([
      doc.fonts.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, STYLESHEET_WAIT_MS)),
    ]);
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Renders export HTML in an off-screen iframe at full A4 width (no preview zoom).
 * Caller must remove the iframe when finished.
 */
export async function mountExportIframe(html: string): Promise<HTMLIFrameElement> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${A4_WIDTH_PX}px`,
    "height:0",
    "border:0",
    "visibility:hidden",
    "pointer-events:none",
  ].join(";");

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("Could not create export frame");
  }

  await new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      waitForExportDocument(doc).then(resolve).catch(reject);
    };
    win.addEventListener("load", onLoad, { once: true });
    doc.open();
    doc.write(html);
    doc.close();
    if (doc.readyState === "complete") {
      win.removeEventListener("load", onLoad);
      waitForExportDocument(doc).then(resolve).catch(reject);
    }
  });

  const page = doc.querySelector<HTMLElement>(".a4-page");
  const pageHeight = page ? Math.max(A4_HEIGHT_PX, page.scrollHeight) : A4_HEIGHT_PX;
  iframe.style.height = `${pageHeight}px`;

  return iframe;
}

export function getExportPageElement(iframe: HTMLIFrameElement): HTMLElement {
  const page = iframe.contentDocument?.querySelector<HTMLElement>(".a4-page");
  if (!page) throw new Error("Resume page not found in export view");
  return page;
}
