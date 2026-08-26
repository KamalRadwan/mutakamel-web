/**
 * Typed access to design tokens for JS consumers (chart series colors,
 * canvas-drawn indicators) that can't reach a CSS custom property through a
 * Tailwind class. This module never hard-codes a color value itself — it
 * only reads what globals.css already defines, so the tokens stay the
 * single source of truth documented in docs/design-system/tokens.md.
 */

function readCssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** The 5 chart series colors (docs/design-system/tokens.md), in series order. */
export function getChartSeriesColors(): string[] {
  return [1, 2, 3, 4, 5].map((n) => readCssVar(`--chart-${n}`));
}
