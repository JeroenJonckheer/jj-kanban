/**
 * Pure colour helpers — no React/DOM/PCF imports, fully unit-testable.
 * Inputs are #rrggbb or #rrggbbaa; outputs respect the same format.
 */

/** Tasteful neutral used whenever no colour is defined in metadata. */
export const NEUTRAL_LANE_COLOR = "#cbd5e1";

export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Lighter shade by mixing toward white (0..1). */
export function mix(hex: string, withWhite: number): string {
  const { r, g, b } = hexToRgb(hex);
  const m = (c: number) => Math.round(c + (255 - c) * withWhite);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

const DARK_TEXT = "#1f2937";
const LIGHT_TEXT = "#ffffff";

/** WCAG relative luminance of an sRGB colour (0..1). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pick dark or light text for the best contrast against `bg`. */
export function readableText(bg: string): string {
  return contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
}

/** Return a usable hex colour, or the neutral grey when nothing meaningful is set. */
export function normalizeColor(raw: unknown): string {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return t;
  }
  return NEUTRAL_LANE_COLOR;
}
