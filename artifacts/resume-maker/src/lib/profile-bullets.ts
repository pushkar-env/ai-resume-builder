import { richHtmlToPlainText } from "@/lib/ai-rich-text";

/**
 * Resolves bullet points for profile experience/project entries.
 * Prefers the structured bullets array; falls back to legacy newline-split description.
 */
export function resolveProfileBullets(
  bullets: unknown,
  description?: string | null,
): string[] {
  if (Array.isArray(bullets)) {
    return bullets.map((b) => (typeof b === "string" ? b : String(b ?? "")));
  }

  return (description || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-\*\s]+/, "").trim())
    .filter(Boolean);
}

/** Keeps description in sync for legacy consumers that read the text field. */
export function syncBulletsToDescription(bullets: string[]): string {
  return bullets.map((bullet) => richHtmlToPlainText(bullet)).join("\n");
}
