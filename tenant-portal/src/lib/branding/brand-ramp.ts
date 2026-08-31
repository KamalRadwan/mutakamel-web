// Derives a tenant brand ramp from one hex colour, the same way Phase 0 built
// the system ramp: hold each step's OKLCH **lightness**, keep the tenant's hue,
// and fit chroma to the sRGB gamut. Only the hue moves.
//
// This is the runtime half of the guard that `scripts/design/contrast.mjs`
// cannot provide. That script is a build-time Node pass over the static tokens
// in `src/app/globals.css`; from the moment branding overrides
// `--color-brand-*` at runtime it proves nothing about what a real tenant sees.
// So the ratio is recomputed here, in the browser, before anything is applied —
// see docs/api/core-billing.md#wiring-branding-into-the-token-layer.

/** The eleven ramp steps, in the order `globals.css` declares them. */
export const BRAND_RAMP_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

type BrandRampStep = (typeof BRAND_RAMP_STEPS)[number];

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/**
 * The system brand ramp, transcribed from `src/app/globals.css` §2. The L and C
 * columns are the contract this module preserves; only H is replaced.
 */
const SYSTEM_BRAND: Record<BrandRampStep, Oklch> = {
  50: { l: 0.97, c: 0.014, h: 258 },
  100: { l: 0.94, c: 0.028, h: 258 },
  200: { l: 0.888, c: 0.054, h: 258 },
  300: { l: 0.812, c: 0.094, h: 258 },
  400: { l: 0.716, c: 0.147, h: 258 },
  500: { l: 0.632, c: 0.196, h: 258 },
  600: { l: 0.56, c: 0.204, h: 258 },
  700: { l: 0.474, c: 0.173, h: 258 },
  800: { l: 0.4, c: 0.146, h: 258 },
  900: { l: 0.336, c: 0.123, h: 258 },
  950: { l: 0.23, c: 0.085, h: 258 },
};

/** The neutrals the brand ramp is measured against, also from `globals.css`. */
const INK_50: Oklch = { l: 0.985, c: 0.007, h: 240 };
const INK_950: Oklch = { l: 0.175, c: 0.028, h: 240 };
const INK_1000: Oklch = { l: 0.127, c: 0.024, h: 240 };
const WHITE: Oklch = { l: 1, c: 0, h: 0 };

interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

export function oklchToLinearSrgb({ l, c, h }: Oklch): LinearRgb {
  const hueRadians = (h * Math.PI) / 180;
  const a = c * Math.cos(hueRadians);
  const b = c * Math.sin(hueRadians);

  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    g: -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    b: -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  };
}

function linearSrgbToOklch({ r, g, b }: LinearRgb): Oklch {
  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const bAxis = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;

  const chroma = Math.hypot(a, bAxis);
  const hue = ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360;
  return { l, c: chroma, h: hue };
}

const GAMUT_EPSILON = 1e-4;

function isInGamut({ r, g, b }: LinearRgb): boolean {
  return [r, g, b].every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

/**
 * The largest chroma that still resolves inside sRGB at this lightness and hue.
 *
 * Bisection rather than an analytic solve: the sRGB solid is not convex in
 * OKLCH and the closed forms that exist are per-primary special cases. Twenty
 * iterations resolve to better than 1e-6 chroma, far below a perceptible step.
 */
function maxChromaInGamut(lightness: number, hue: number, ceiling: number): number {
  if (isInGamut(oklchToLinearSrgb({ l: lightness, c: ceiling, h: hue }))) return ceiling;
  let low = 0;
  let high = ceiling;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const middle = (low + high) / 2;
    if (isInGamut(oklchToLinearSrgb({ l: lightness, c: middle, h: hue }))) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function relativeLuminance(color: Oklch): number {
  const { r, g, b } = oklchToLinearSrgb(color);
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

export function contrastRatio(foreground: Oklch, background: Oklch): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

// `@IsHexColor()` on UpdateBrandingDto accepts 3, 4, 6 and 8 digit forms, and
// the column is varchar(9), so all four reach the browser.
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function channelToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Parses a tenant `primaryColor` into OKLCH, or null when it is not a hex colour. */
export function hexToOklch(hex: string): Oklch | null {
  const trimmed = hex.trim();
  if (!HEX_COLOR.test(trimmed)) return null;
  const digits = trimmed.slice(1);
  const expanded =
    digits.length <= 4
      ? digits
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : digits;
  const toChannel = (offset: number) =>
    channelToLinear(Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255);
  return linearSrgbToOklch({ r: toChannel(0), g: toChannel(2), b: toChannel(4) });
}

export type BrandRamp = Record<BrandRampStep, Oklch>;

/**
 * The pairs a tenant hue must not break. Each one is a token binding declared in
 * `globals.css`: `--primary` (brand-600 light / brand-400 dark),
 * `--sidebar-active` (brand-700 light / brand-300 dark) and `--ring`
 * (brand-500 light / brand-400 dark). The ring is non-text, so it takes WCAG's
 * 3:1 non-text threshold rather than 4.5:1.
 */
const CONTRAST_PAIRS = [
  { id: "primaryFillLight", foreground: WHITE, step: 600, background: null, minimum: 4.5 },
  { id: "primaryFillDark", foreground: INK_950, step: 400, background: null, minimum: 4.5 },
  { id: "sidebarActiveLight", foreground: null, step: 700, background: WHITE, minimum: 4.5 },
  { id: "sidebarActiveDark", foreground: null, step: 300, background: INK_950, minimum: 4.5 },
  { id: "ringLight", foreground: null, step: 500, background: INK_50, minimum: 3 },
  { id: "ringDark", foreground: null, step: 400, background: INK_1000, minimum: 3 },
] as const satisfies readonly {
  id: string;
  foreground: Oklch | null;
  step: BrandRampStep;
  background: Oklch | null;
  minimum: number;
}[];

export type BrandContrastPairId = (typeof CONTRAST_PAIRS)[number]["id"];

export interface BrandRampVerdict {
  /** True when every pair above clears its threshold and the ramp may be applied. */
  passes: boolean;
  ramp: BrandRamp;
  /** The pairs that fell short, with the ratio actually measured. */
  failures: { id: BrandContrastPairId; ratio: number; minimum: number }[];
}

/** Rebuilds the ramp at the tenant's hue, holding lightness and fitting chroma. */
export function deriveBrandRamp(hue: number): BrandRamp {
  const ramp = {} as BrandRamp;
  for (const step of BRAND_RAMP_STEPS) {
    const system = SYSTEM_BRAND[step];
    ramp[step] = {
      l: system.l,
      c: maxChromaInGamut(system.l, hue, system.c),
      h: hue,
    };
  }
  return ramp;
}

/**
 * Derives the ramp for one `primaryColor` and re-measures every token pair it
 * feeds. A `null` result means the value was not a hex colour at all.
 *
 * A failing verdict is not a reason to apply a "close enough" ramp: the caller
 * keeps the system brand and says so, because a tenant colour that cannot reach
 * 4.5:1 makes the product's primary action unreadable for the people the
 * threshold exists to protect.
 */
export function evaluateBrandColor(primaryColor: string): BrandRampVerdict | null {
  const color = hexToOklch(primaryColor);
  if (!color) return null;
  const ramp = deriveBrandRamp(color.h);
  const failures = CONTRAST_PAIRS.flatMap((pair) => {
    const ratio = contrastRatio(pair.foreground ?? ramp[pair.step], pair.background ?? ramp[pair.step]);
    return ratio >= pair.minimum ? [] : [{ id: pair.id, ratio, minimum: pair.minimum }];
  });
  return { passes: failures.length === 0, ramp, failures };
}

/** `oklch(L C H)` exactly as `globals.css` writes it, for a CSS custom property. */
export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(4)} ${h.toFixed(2)})`;
}
