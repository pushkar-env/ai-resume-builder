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
    return trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
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
