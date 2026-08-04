/**
 * Conversions between the rich HTML the resume editors store and the plain text
 * the profile form edits. Mirrors resume-maker's src/lib/ai-rich-text.ts.
 */

/** Decode the handful of entities our editors emit. `&amp;` last, so `&amp;lt;` stays literal. */
export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&(?:#39|apos);/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

const HTML_TAG = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i;

/** True when the value carries markup rather than being plain prose. */
export function looksLikeHtml(value: string): boolean {
  return HTML_TAG.test(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Flatten rich HTML into text: paragraphs become blank-line separated (so they
 * survive the trip back through plainTextToRichHtml), list items become single
 * lines. Plain text passes through untouched.
 */
export function richHtmlToMultilineText(html: string): string {
  const raw = html.trim();
  if (!raw || !looksLikeHtml(raw)) return raw;
  return decodeHtmlEntities(
    raw
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(li|tr)\s*>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|blockquote)\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    // Collapse runs of spaces/tabs/nbsp but keep the block breaks above.
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Wrap plain text back into the minimal HTML the resume editors render. */
export function plainTextToRichHtml(text: string): string {
  const raw = text.trim();
  if (!raw) return "";
  if (looksLikeHtml(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
