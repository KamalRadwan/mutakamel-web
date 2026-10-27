import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface LinearRgbColor {
  r: number;
  g: number;
  b: number;
}

const WHITE: LinearRgbColor = { r: 1, g: 1, b: 1 };

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const ramp = declarations(blockAfter(css, "@theme {"));
const light = new Map([
  ...ramp,
  ...declarations(blockAfter(css, "/* Semantic roles — light values.")),
]);
const dark = new Map([
  ...light,
  ...declarations(blockAfter(css, ".dark {")),
]);

describe("dark semantic contrast source guard", () => {
  it("keeps dual-use action and destructive roles AA as text and fills", () => {
    const card = resolveLinearRgb("--card", dark);
    const primary = resolveLinearRgb("--primary", dark);
    const destructive = resolveLinearRgb("--destructive", dark);

    const ratios = {
      primaryTextOnCard: contrastRatio(primary, card),
      primaryFillPair: contrastRatio(
        primary,
        resolveLinearRgb("--primary-foreground", dark),
      ),
      destructiveTextOnCard: contrastRatio(destructive, card),
      destructiveFillPair: contrastRatio(
        destructive,
        resolveLinearRgb("--destructive-foreground", dark),
      ),
    };

    expect(ratios.primaryTextOnCard).toBeCloseTo(7.24, 2);
    expect(ratios.primaryFillPair).toBeCloseTo(7.68, 2);
    expect(ratios.destructiveTextOnCard).toBeCloseTo(7.04, 2);
    expect(ratios.destructiveFillPair).toBeCloseTo(7.47, 2);
    for (const ratio of Object.values(ratios)) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps dark control boundaries and focus indicators above 3:1", () => {
    const card = resolveLinearRgb("--card", dark);
    const ratios = {
      border: contrastRatio(resolveLinearRgb("--border", dark), card),
      input: contrastRatio(resolveLinearRgb("--input", dark), card),
      ring: contrastRatio(resolveLinearRgb("--ring", dark), card),
    };

    expect(ratios.border).toBeCloseTo(3.04, 2);
    expect(ratios.input).toBeCloseTo(3.04, 2);
    expect(ratios.ring).toBeCloseTo(7.24, 2);
    for (const ratio of Object.values(ratios)) {
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("Ocean Navy v3 semantic contrast source guard (light and dark)", () => {
  const themes: Array<["light" | "dark", Map<string, string>]> = [
    ["light", light],
    ["dark", dark],
  ];

  it("keeps v3 text roles at or above 4.5:1 across light and dark surfaces", () => {
    for (const [themeName, theme] of themes) {
      const cardBg = resolveLinearRgb("--card", theme);
      const toolbarBg = resolveLinearRgb("--surface-toolbar", theme);
      const columnHeaderBg = resolveLinearRgb("--surface-column-header", theme);
      const columnBg = resolveLinearRgb("--surface-column", theme);
      const subtleBg = resolveLinearRgb("--surface-subtle", theme);
      const navy800 = resolveLinearRgb("--color-navy-800", theme);
      const headerStops = resolveGradientStops("--gradient-header", theme);
      const chipStops = resolveGradientStops("--gradient-chip-active", theme);

      const textPairs: Array<[string, LinearRgbColor, LinearRgbColor[]]> = [
        [
          `nav-foreground vs gradient-header (${themeName})`,
          resolveLinearRgb("--nav-foreground", theme),
          headerStops,
        ],
        [
          `nav-foreground-strong vs gradient-header (${themeName})`,
          resolveLinearRgb("--nav-foreground-strong", theme),
          headerStops,
        ],
        [
          `nav-switcher-fg vs nav-switcher-surface (${themeName})`,
          resolveLinearRgb("--nav-switcher-fg", theme),
          [resolveLinearRgb("--nav-switcher-surface", theme, navy800)],
        ],
        [
          `foreground vs card (${themeName})`,
          resolveLinearRgb("--foreground", theme),
          [cardBg],
        ],
        [
          `foreground vs surface-column (${themeName})`,
          resolveLinearRgb("--foreground", theme),
          [columnBg],
        ],
        [
          `foreground-secondary vs card (${themeName})`,
          resolveLinearRgb("--foreground-secondary", theme),
          [cardBg],
        ],
        [
          `foreground-secondary vs surface-column (${themeName})`,
          resolveLinearRgb("--foreground-secondary", theme),
          [columnBg],
        ],
        [
          `foreground-secondary vs surface-subtle (${themeName})`,
          resolveLinearRgb("--foreground-secondary", theme),
          [subtleBg],
        ],
        [
          `muted-foreground vs card (${themeName})`,
          resolveLinearRgb("--muted-foreground", theme),
          [cardBg],
        ],
        [
          `muted-foreground vs surface-subtle (${themeName})`,
          resolveLinearRgb("--muted-foreground", theme),
          [subtleBg],
        ],
        [
          `chip-active-fg vs gradient-chip-active (${themeName})`,
          resolveLinearRgb("--chip-active-fg", theme),
          chipStops,
        ],
      ];

      for (const state of ["none", "future", "today", "overdue"] as const) {
        textPairs.push([
          `activity-${state}-text vs surface (${themeName})`,
          resolveLinearRgb(`--activity-${state}-text`, theme),
          [resolveLinearRgb(`--activity-${state}-surface`, theme, cardBg)],
        ]);
      }

      for (const kind of ["total", "new", "rated", "qualified", "overdue"] as const) {
        textPairs.push([
          `kpi-${kind}-text vs surface (${themeName})`,
          resolveLinearRgb(`--kpi-${kind}-text`, theme),
          [resolveLinearRgb(`--kpi-${kind}-surface`, theme, toolbarBg)],
        ]);
        textPairs.push([
          `white vs kpi-${kind}-count (${themeName})`,
          WHITE,
          [resolveLinearRgb(`--kpi-${kind}-count`, theme, toolbarBg)],
        ]);
      }

      for (const kind of ["active", "zero", "danger"] as const) {
        textPairs.push([
          `count-${kind}-fg vs surface (${themeName})`,
          resolveLinearRgb(`--count-${kind}-fg`, theme),
          [resolveLinearRgb(`--count-${kind}-surface`, theme, columnHeaderBg)],
        ]);
      }

      for (const [label, foreground, backgrounds] of textPairs) {
        const minRatio = Math.min(
          ...backgrounds.map((background) => contrastRatio(foreground, background)),
        );
        expect(minRatio, `${label} must clear 4.5:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps white text at or above 4.5:1 on primary and avatar gradient stops", () => {
    for (const [themeName, theme] of themes) {
      for (const gradient of ["--gradient-primary", "--gradient-avatar"] as const) {
        const stops = resolveGradientStops(gradient, theme);
        expect(stops.length, `${gradient} (${themeName}) must have two stops`).toBe(2);
        for (const [index, stop] of stops.entries()) {
          expect(
            contrastRatio(WHITE, stop),
            `white vs ${gradient} stop ${index + 1} (${themeName}) must clear 4.5:1`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("keeps v3 non-text roles and control lines at or above 3:1", () => {
    for (const [themeName, theme] of themes) {
      const cardBg = resolveLinearRgb("--card", theme);
      const subtleBg = resolveLinearRgb("--surface-subtle", theme);
      const backgroundBg = resolveLinearRgb("--background", theme);
      const headerStops = resolveGradientStops("--gradient-header", theme);

      const nonTextPairs: Array<[string, LinearRgbColor, LinearRgbColor[]]> = [
        [
          `nav-active vs gradient-header (${themeName})`,
          resolveLinearRgb("--nav-active", theme),
          headerStops,
        ],
        [
          `input vs card (${themeName})`,
          resolveLinearRgb("--input", theme),
          [cardBg],
        ],
        [
          `ring vs background (${themeName})`,
          resolveLinearRgb("--ring", theme),
          [backgroundBg],
        ],
      ];

      for (const kind of ["person", "company"] as const) {
        nonTextPairs.push([
          `entity-${kind}-fg vs surface (${themeName})`,
          resolveLinearRgb(`--entity-${kind}-fg`, theme),
          [resolveLinearRgb(`--entity-${kind}-surface`, theme, cardBg)],
        ]);
      }

      if (themeName === "dark") {
        nonTextPairs.push([
          "line-control vs surface-subtle (dark)",
          resolveLinearRgb("--line-control", theme),
          [subtleBg],
        ]);
        nonTextPairs.push([
          "line-control vs card (dark)",
          resolveLinearRgb("--line-control", theme),
          [cardBg],
        ]);
      }

      for (const [label, foreground, backgrounds] of nonTextPairs) {
        const minRatio = Math.min(
          ...backgrounds.map((background) => contrastRatio(foreground, background)),
        );
        expect(minRatio, `${label} must clear 3:1`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

/** Source-token guard only; browser gamut mapping/compositing remains runtime evidence. */
function resolveLinearRgb(
  exprOrToken: string,
  theme: Map<string, string>,
  backdrop: LinearRgbColor = WHITE,
  seen = new Set<string>(),
): LinearRgbColor {
  const expr = exprOrToken.trim();
  if (expr === "white") return WHITE;

  if (expr.startsWith("--")) {
    if (seen.has(expr)) throw new Error(`Circular CSS variable reference: ${expr}`);
    seen.add(expr);
    const value = theme.get(expr);
    if (!value) throw new Error(`Missing CSS token: ${expr}`);
    return resolveLinearRgb(value, theme, backdrop, seen);
  }

  const variable = /^var\(\s*(--[\w-]+)\s*\)$/.exec(expr);
  if (variable) {
    return resolveLinearRgb(variable[1], theme, backdrop, seen);
  }

  const hex = /^#([0-9a-fA-F]{6})$/.exec(expr);
  if (hex) {
    const raw = hex[1];
    return {
      r: srgbUnitToLinear(Number.parseInt(raw.slice(0, 2), 16) / 255),
      g: srgbUnitToLinear(Number.parseInt(raw.slice(2, 4), 16) / 255),
      b: srgbUnitToLinear(Number.parseInt(raw.slice(4, 6), 16) / 255),
    };
  }

  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(expr);
  if (oklch) {
    return oklchToLinearRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }

  const rgbAlpha =
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/.exec(
      expr,
    );
  if (rgbAlpha) {
    const alpha = rgbAlpha[4] === undefined ? 1 : Number(rgbAlpha[4]);
    const fgR = Number(rgbAlpha[1]) / 255;
    const fgG = Number(rgbAlpha[2]) / 255;
    const fgB = Number(rgbAlpha[3]) / 255;
    const bgR = linearToSrgbUnit(backdrop.r);
    const bgG = linearToSrgbUnit(backdrop.g);
    const bgB = linearToSrgbUnit(backdrop.b);
    return {
      r: srgbUnitToLinear(alpha * fgR + (1 - alpha) * bgR),
      g: srgbUnitToLinear(alpha * fgG + (1 - alpha) * bgG),
      b: srgbUnitToLinear(alpha * fgB + (1 - alpha) * bgB),
    };
  }

  throw new Error(`Unsupported color syntax: ${expr}`);
}

function resolveGradientStops(
  gradientToken: string,
  theme: Map<string, string>,
): LinearRgbColor[] {
  const raw = theme.get(gradientToken);
  if (!raw) throw new Error(`Missing CSS gradient token: ${gradientToken}`);
  const stops: LinearRgbColor[] = [];
  for (const match of raw.matchAll(/(var\(--[\w-]+\)|#[0-9a-fA-F]{6}|oklch\([^)]+\))/g)) {
    stops.push(resolveLinearRgb(match[1], theme));
  }
  if (stops.length === 0) {
    throw new Error(`No color stops parsed in ${gradientToken}: ${raw}`);
  }
  return stops;
}

function oklchToLinearRgb(
  lightness: number,
  chroma: number,
  hueDegrees: number,
): LinearRgbColor {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return {
    r: clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function linearToSrgbUnit(value: number): number {
  const clamped = clamp01(value);
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function srgbUnitToLinear(value: number): number {
  const clamped = clamp01(value);
  return clamped <= 0.04045
    ? clamped / 12.92
    : ((clamped + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(left: LinearRgbColor, right: LinearRgbColor): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

function relativeLuminance(color: LinearRgbColor): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function blockAfter(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing CSS marker: ${marker}`);
  const openIndex = source.indexOf("{", markerIndex);
  if (openIndex < 0) throw new Error(`Missing CSS block after: ${marker}`);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  throw new Error(`Unclosed CSS block after: ${marker}`);
}

function declarations(block: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of block.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    values.set(match[1], match[2].trim());
  }
  return values;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
