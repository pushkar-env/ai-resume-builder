/** Relative luminance for sRGB hex; used for watermark contrast on light vs dark page backgrounds. */
export function isDarkBackgroundColor(hex: string): boolean {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6 && raw.length !== 3) return false;
  const expand = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  const r = Number.parseInt(expand.slice(0, 2), 16) / 255;
  const g = Number.parseInt(expand.slice(2, 4), 16) / 255;
  const b = Number.parseInt(expand.slice(4, 6), 16) / 255;
  const [R, G, B] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return L < 0.42;
}
