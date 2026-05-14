/**
 * Normalizes HTML stored from the resume rich-text fields (summary, bullets, projects).
 * Strips paste cruft that forces mid-word breaks and removes soft hyphens.
 */
const SOFT_HYPHEN = /\u00ad/g;

/** style properties that commonly come from Word/Docs and break resume layout */
const STRIP_STYLE_PREFIXES = [
  "word-break",
  "overflow-wrap",
  "word-wrap",
  "white-space",
  "line-break",
  "hyphens",
];

function stripSoftHyphensFromHtml(html: string): string {
  return html.replace(SOFT_HYPHEN, "").replace(/&shy;/gi, "");
}

function cleanStyleAttribute(raw: string): string | null {
  const parts = raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => {
    const key = part.split(":")[0]?.trim().toLowerCase() ?? "";
    return !STRIP_STYLE_PREFIXES.some((p) => key === p || key.startsWith(`${p}-`));
  });
  if (kept.length === 0) return null;
  return kept.join("; ");
}

export function sanitizeResumeRichHtml(html: string): string {
  const withoutShy = stripSoftHyphensFromHtml(html);
  if (typeof DOMParser === "undefined") return withoutShy;
  try {
    const wrapped = `<div class="resume-sanitize-root">${withoutShy}</div>`;
    const parsed = new DOMParser().parseFromString(wrapped, "text/html");
    if (parsed.querySelector("parsererror")) return withoutShy;
    const root = parsed.body.querySelector(".resume-sanitize-root");
    if (!root) return withoutShy;

    const walk = (el: Element) => {
      if (el.hasAttribute("style")) {
        const next = cleanStyleAttribute(el.getAttribute("style") ?? "");
        if (next) el.setAttribute("style", next);
        else el.removeAttribute("style");
      }
      for (const child of el.children) walk(child);
    };
    walk(root);
    return root.innerHTML;
  } catch {
    return withoutShy;
  }
}
