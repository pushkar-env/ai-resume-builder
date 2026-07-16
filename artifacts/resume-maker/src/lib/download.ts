/**
 * Cross-browser / cross-device file download helpers.
 *
 * All client-side exports (PDF, DOCX, JSON) funnel through here so download
 * behavior stays identical and robust across desktop and mobile browsers.
 */

// Control characters that are illegal in Windows/macOS filenames.
const FILENAME_CONTROL_CHARS = new RegExp("[\\u0000-\\u001f]", "g");
const FILENAME_RESERVED_CHARS = /[<>:"/\\|?*]/g;

/** Safe for Windows/macOS/Linux filesystems and mobile download APIs. */
export function safeFileBaseName(title: string, fallback = "resume"): string {
  const base = title.trim().replace(/\s+/g, "_") || fallback;
  return base
    .replace(FILENAME_RESERVED_CHARS, "_")
    .replace(FILENAME_CONTROL_CHARS, "_")
    .slice(0, 120);
}

/**
 * Triggers a browser download for a Blob.
 *
 * The object URL is revoked on a delay (not synchronously) because Safari and
 * mobile WebKit can abort the download if the blob URL disappears before the
 * transfer has started.
 */
export function downloadFileBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke so Safari / mobile WebKit can start the download before the blob URL disappears.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** Downloads a string payload (e.g. JSON) as a file. */
export function downloadBlob(
  content: string,
  filename: string,
  type: string,
): void {
  downloadFileBlob(new Blob([content], { type }), filename);
}
