import { RESUME_PDF_EXPORT_CSS } from "@/lib/resume-export-styles";

const MAX_INLINE_STYLESHEET_BYTES = 2 * 1024 * 1024;
const MAX_INLINE_ASSET_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_INLINE_ASSET_BYTES = 10 * 1024 * 1024;
const EXPORT_ASSET_WAIT_MS = 8_000;

type InlinedStylesheet = {
  css: string;
  baseUrl: string;
};

async function inlineStylesheet(href: string): Promise<InlinedStylesheet | null> {
  try {
    const res = await fetch(href, { credentials: "same-origin" });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_INLINE_STYLESHEET_BYTES) return null;
    return { css: text, baseUrl: res.url || href };
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read export asset"));
    reader.readAsDataURL(blob);
  });
}

function escapeHtmlText(value: string): string {
  return value.replace(
    /[&<>]/g,
    (character) =>
      (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
        } as const
      )[character as "&" | "<" | ">"],
  );
}

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; bytes: number } | null> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size > MAX_INLINE_ASSET_BYTES) return null;
    return { dataUrl: await blobToDataUrl(blob), bytes: blob.size };
  } catch {
    return null;
  }
}

function fontFamiliesUsedBy(root: HTMLElement): Set<string> {
  const families = new Set<string>();
  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
    for (const family of getComputedStyle(element).fontFamily.split(",")) {
      const normalized = family.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
      if (normalized) families.add(normalized);
    }
  }
  return families;
}

function removeUnusedFontFaces(css: string, usedFamilies: Set<string>): string {
  return css.replace(/@font-face\s*\{[\s\S]*?\}/gi, (rule) => {
    const match = rule.match(/font-family\s*:\s*(['"]?)([^;'"]+)\1\s*;/i);
    if (!match) return rule;
    return usedFamilies.has(match[2].trim().toLowerCase()) ? rule : "";
  });
}

async function inlineCssUrls(
  css: string,
  baseUrl: string,
  budget: { used: number },
): Promise<string> {
  const matches = Array.from(css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi));
  const replacements = new Map<string, string>();

  for (const match of matches) {
    const rawUrl = match[2].trim();
    if (
      replacements.has(rawUrl) ||
      /^(data:|#|about:|javascript:)/i.test(rawUrl)
    ) {
      continue;
    }

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(rawUrl, baseUrl).href;
    } catch {
      continue;
    }

    const asset = await fetchAsDataUrl(absoluteUrl);
    if (!asset || budget.used + asset.bytes > MAX_TOTAL_INLINE_ASSET_BYTES) continue;
    budget.used += asset.bytes;
    replacements.set(rawUrl, asset.dataUrl);
  }

  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (full, _quote: string, rawUrl: string) =>
      replacements.has(rawUrl.trim())
        ? `url("${replacements.get(rawUrl.trim())}")`
        : full,
  );
}

async function waitForPreviewAssets(root: HTMLElement): Promise<void> {
  const fontsReady =
    "fonts" in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
  const imagesReady = Promise.all(
    Array.from(root.querySelectorAll("img")).map(async (image) => {
      if (image.complete) {
        await image.decode?.().catch(() => undefined);
        return;
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
      await image.decode?.().catch(() => undefined);
    }),
  );

  await Promise.race([
    Promise.all([fontsReady, imagesReady]),
    new Promise<void>((resolve) => window.setTimeout(resolve, EXPORT_ASSET_WAIT_MS)),
  ]);
}

async function inlinePreviewImages(
  source: HTMLElement,
  clone: HTMLElement,
  budget: { used: number },
): Promise<void> {
  const sourceImages = Array.from(source.querySelectorAll<HTMLImageElement>("img"));
  const clonedImages = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(
    sourceImages.map(async (image, index) => {
      const clonedImage = clonedImages[index];
      const src = image.currentSrc || image.src;
      if (!clonedImage || !src || src.startsWith("data:")) return;
      const asset = await fetchAsDataUrl(src);
      if (!asset || budget.used + asset.bytes > MAX_TOTAL_INLINE_ASSET_BYTES) return;
      budget.used += asset.bytes;
      clonedImage.src = asset.dataUrl;
      clonedImage.removeAttribute("srcset");
      clonedImage.removeAttribute("crossorigin");
    }),
  );
}

/**
 * Build a self-contained HTML document for server-side PDF rendering.
 * Stylesheets, used font files, and preview images are embedded so Puppeteer
 * can render the same typography and artwork without external network access.
 */
export async function buildSelfContainedExportHtml(
  resumeTitle: string,
): Promise<string | null> {
  const previewEl = document.querySelector<HTMLElement>(
    "[data-resume-export-target]",
  );
  if (!previewEl) return null;

  await waitForPreviewAssets(previewEl);

  const clonedPreview = previewEl.cloneNode(true) as HTMLElement;
  const inlineBudget = { used: 0 };

  const styleBlocks: string[] = [];
  const usedFontFamilies = fontFamiliesUsedBy(previewEl);

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
      if (css) {
        styleBlocks.push(
          await inlineCssUrls(
            removeUnusedFontFaces(css, usedFontFamilies),
            document.baseURI,
            inlineBudget,
          ),
        );
      }
    }
  }

  const inlined = await Promise.all(
    stylesheetLinks.map((link) =>
      inlineStylesheet(new URL(link.href, document.baseURI).href),
    ),
  );
  for (const stylesheet of inlined) {
    if (!stylesheet) continue;
    styleBlocks.push(
      await inlineCssUrls(
        removeUnusedFontFaces(stylesheet.css, usedFontFamilies),
        stylesheet.baseUrl,
        inlineBudget,
      ),
    );
  }

  // Prioritize typography, then use the remaining payload budget for photos.
  await inlinePreviewImages(previewEl, clonedPreview, inlineBudget);

  const safeTitle = escapeHtmlText(resumeTitle);
  const combinedCss = styleBlocks.join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="color-scheme" content="light only" />
  <title>${safeTitle}</title>
  <style>
    ${combinedCss}
    ${RESUME_PDF_EXPORT_CSS}
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${clonedPreview.outerHTML.trim()}</body>
</html>`;
}
