import { sanitizeResumeRichHtml } from "@/lib/sanitize-resume-rich-html";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip tags for AI prompts — avoids sending huge Quill HTML to the API. */
export function richHtmlToPlainText(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (typeof DOMParser === "undefined") {
    return trimmed
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return trimmed
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

const HTML_TAG = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i;

/**
 * Flatten rich HTML into text: paragraphs become blank-line separated (so they
 * survive the trip back through plainTextToRichHtml), list items become single
 * lines. Plain text passes through untouched, so hand-typed breaks survive.
 *
 * Used by the plain <textarea> fields (profile summary) that can still receive
 * Quill HTML — e.g. profiles saved before resume extraction normalised it.
 */
export function richHtmlToMultilineText(value: string): string {
  const raw = (value ?? "").trim();
  if (!raw || !HTML_TAG.test(raw)) return raw;
  const withBreaks = raw
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(li|tr)\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote)\s*>/gi, "\n\n");
  let text: string;
  if (typeof DOMParser === "undefined") {
    text = withBreaks.replace(/<[^>]+>/g, "");
  } else {
    try {
      const doc = new DOMParser().parseFromString(withBreaks, "text/html");
      text = doc.body.textContent ?? "";
    } catch {
      text = withBreaks.replace(/<[^>]+>/g, "");
    }
  }
  return text
    // Collapse runs of spaces/tabs/nbsp but keep the block breaks above.
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Convert AI plain-text output into minimal HTML for Quill / preview. */
export function plainTextToRichHtml(text: string): string {
  const raw = text.trim();
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return sanitizeResumeRichHtml(raw);
  }
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  const html = paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return sanitizeResumeRichHtml(html);
}
