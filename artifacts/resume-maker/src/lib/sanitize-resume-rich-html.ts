/**
 * Normalizes HTML stored from the resume rich-text fields (summary, bullets, projects).
 *
 * Fixes common paste issues:
 * - Inline styles that force mid-word breaks (Word / Google Docs)
 * - Soft hyphens, zero-width spaces, explicit <wbr> break opportunities
 * - Entire paragraphs wrapped in a single <a> (makes our link-specific CSS treat prose like a URL)
 */

const SOFT_HYPHEN = /\u00ad/g;
/** Break opportunities inserted by editors — allow breaks between any characters */
const ZW_SPACE = /[\u200b\u200c\u200d\ufeff]/g;

const STRIP_STYLE_PREFIXES = [
  "word-break",
  "overflow-wrap",
  "word-wrap",
  "white-space",
  "line-break",
  "hyphens",
  "font-size",
  "font",
  "line-height",
];

function stripSoftHyphensFromHtml(html: string): string {
  return html.replace(SOFT_HYPHEN, "").replace(/&shy;/gi, "");
}

function stripWbrTags(html: string): string {
  return html.replace(/<wbr\s*\/?>/gi, "");
}

function cleanStyleAttribute(raw: string): string | null {
  const parts = raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => {
    const key = part.split(":")[0]?.trim().toLowerCase() ?? "";
    return !STRIP_STYLE_PREFIXES.some(
      (p) => key === p || key.startsWith(`${p}-`),
    );
  });
  if (kept.length === 0) return null;
  return kept.join("; ");
}

/** Word / Docs often wrap a whole paragraph in one anchor — unwrap so text wraps as normal prose */
function unwrapProseAnchors(root: Element) {
  const anchors = Array.from(root.querySelectorAll("a[href]"));
  for (const a of anchors) {
    const text = (a.textContent || "").trim();
    if (text.length < 72) continue;
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 6) continue;
    const parent = a.parentNode;
    if (!parent) continue;
    while (a.firstChild) {
      parent.insertBefore(a.firstChild, a);
    }
    parent.removeChild(a);
  }
}

function ensureTargetBlank(root: Element) {
  const anchors = Array.from(root.querySelectorAll("a[href]"));
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    if (!/^(mailto|tel):/i.test(href)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noreferrer noopener");
    }
  }
}

function stripBreakingCharsFromTextNodes(root: Element) {
  const doc = root.ownerDocument;
  if (!doc) return;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    const t = (cur as Text).nodeValue;
    if (!t) continue;
    let next = t;
    next = next.replace(/[\u200b\u200c\u200d\ufeff]/g, "");

    if (next !== t) {
      (cur as Text).nodeValue = next;
    }
  }
}

function stripRiskyClasses(root: Element) {
  for (const el of root.querySelectorAll("[class]")) {
    const c = el.getAttribute("class") || "";
    if (/\b(break-all|whitespace-pre|whitespace-pre-wrap)\b/i.test(c)) {
      el.removeAttribute("class");
    }
  }
}

function cleanInlineStyles(root: Element) {
  const walk = (el: Element) => {
    if (el.hasAttribute("style")) {
      const next = cleanStyleAttribute(el.getAttribute("style") ?? "");
      if (next) el.setAttribute("style", next);
      else el.removeAttribute("style");
    }
    for (const child of el.children) walk(child);
  };
  walk(root);
}

function stripEmptyRichBlocks(html: string): string {
  // If the HTML contains only formatting tags and whitespace (i.e. no text/content),
  // return an empty string to avoid saving empty blocks.
  const textContent = html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "");
  if (textContent.length === 0) {
    return "";
  }
  return html.trim();
}

export function sanitizeResumeRichHtml(html: string): string {
  let s = stripEmptyRichBlocks(
    stripWbrTags(stripSoftHyphensFromHtml(html)),
  ).replace(ZW_SPACE, "");
  if (typeof DOMParser === "undefined") return s;
  try {
    const wrapped = `<div class="resume-sanitize-root">${s}</div>`;
    const parsed = new DOMParser().parseFromString(wrapped, "text/html");
    if (parsed.querySelector("parsererror")) return s;
    const root = parsed.body.querySelector(".resume-sanitize-root");
    if (!root) return s;

    unwrapProseAnchors(root);
    ensureTargetBlank(root);
    cleanInlineStyles(root);
    stripRiskyClasses(root);
    stripBreakingCharsFromTextNodes(root);
    return root.innerHTML;
  } catch {
    return s;
  }
}
