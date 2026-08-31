import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHART_COLORS } from "./ChartAccessibility";

interface OklabColor {
  lightness: number;
  a: number;
  b: number;
}

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const rawRamp = declarations(blockAfter(css, "@theme {"));
const lightRoles = declarations(blockAfter(css, "/* Semantic roles — light values."));
const darkRoles = declarations(blockAfter(css, ".dark {"));

const semanticTokens = [
  "--chart-action",
  "--chart-success",
  "--chart-warning",
  "--chart-danger",
  "--chart-axis",
] as const;
const semanticMarkTokens = semanticTokens.slice(0, 4);
const qualitativeTokens = Array.from(
  { length: CHART_COLORS.qualitative.length },
  (_, index) => `--chart-qualitative-${index + 1}`,
);

describe("dashboard chart palette source guard", () => {
  // Marks and axis are held to different floors on purpose. A chart mark is
  // non-text content, which WCAG 1.4.11 puts at 3:1; the axis is text and
  // stays at 4.5:1. This previously held marks to 4.5:1 as well, which was
  // stricter than the standard and was the binding constraint on how vivid a
  // light-theme chart could be — it forced every series down to L 0.49-0.59,
  // where they read as dark and muddy against a white card.
  it("keeps chart marks above the 3:1 non-text floor in both themes", () => {
    for (const [themeName, theme] of themeMaps()) {
      const card = resolveOklab("--card", theme);

      for (const token of [...semanticMarkTokens, ...qualitativeTokens]) {
        const ratio = contrastRatio(resolveOklab(token, theme), card);
        expect(
          ratio,
          `${themeName} ${token} should retain at least 3:1 source-level contrast against --card`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps axis text above the 4.5:1 text floor in both themes", () => {
    for (const [themeName, theme] of themeMaps()) {
      const ratio = contrastRatio(resolveOklab("--chart-axis", theme), resolveOklab("--card", theme));
      expect(
        ratio,
        `${themeName} --chart-axis is text and should retain at least 4.5:1 against --card`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every qualitative slot unique and separated in OKLab source values", () => {
    for (const [themeName, theme] of themeMaps()) {
      const palette = qualitativeTokens.map((token) => ({
        token,
        color: resolveOklab(token, theme),
      }));

      for (let left = 0; left < palette.length; left += 1) {
        for (let right = left + 1; right < palette.length; right += 1) {
          const distance = oklabDistance(palette[left].color, palette[right].color);
          expect(
            distance,
            `${themeName} ${palette[left].token} and ${palette[right].token} are too close in OKLab`,
          ).toBeGreaterThanOrEqual(0.1);
        }
      }
    }
  });

  it("keeps action and lifecycle semantic marks separated in OKLab source values", () => {
    for (const [themeName, theme] of themeMaps()) {
      const palette = semanticMarkTokens.map((token) => ({
        token,
        color: resolveOklab(token, theme),
      }));

      for (let left = 0; left < palette.length; left += 1) {
        for (let right = left + 1; right < palette.length; right += 1) {
          const distance = oklabDistance(palette[left].color, palette[right].color);
          expect(
            distance,
            `${themeName} ${palette[left].token} and ${palette[right].token} are too close in OKLab`,
          ).toBeGreaterThanOrEqual(0.08);
        }
      }
    }
  });

  it("keeps the chart component contract wired to semantic CSS variables", () => {
    expect(CHART_COLORS.action).toBe("var(--chart-action)");
    expect(CHART_COLORS.success).toBe("var(--chart-success)");
    expect(CHART_COLORS.warning).toBe("var(--chart-warning)");
    expect(CHART_COLORS.danger).toBe("var(--chart-danger)");
    expect(CHART_COLORS.axis).toBe("var(--chart-axis)");
    expect(CHART_COLORS.qualitative).toEqual(
      qualitativeTokens.map((token) => `var(${token})`),
    );
  });
});

/**
 * This deliberately guards source token drift only. Browser gamut mapping,
 * compositing, and color-vision-deficiency evaluation remain visual/runtime
 * verification tasks and must not be inferred from these deterministic checks.
 */
function themeMaps(): Array<["light" | "dark", Map<string, string>]> {
  const light = new Map([...rawRamp, ...lightRoles]);
  return [
    ["light", light],
    ["dark", new Map([...light, ...darkRoles])],
  ];
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

function resolveOklab(token: string, values: Map<string, string>, seen = new Set<string>()): OklabColor {
  if (seen.has(token)) throw new Error(`Circular CSS variable reference: ${token}`);
  seen.add(token);

  const value = values.get(token);
  if (!value) throw new Error(`Missing CSS token: ${token}`);
  if (value === "white") return { lightness: 1, a: 0, b: 0 };

  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  if (variable) return resolveOklab(variable[1], values, seen);

  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (!oklch) throw new Error(`Unsupported color syntax for ${token}: ${value}`);

  const lightness = Number(oklch[1]);
  const chroma = Number(oklch[2]);
  const hue = (Number(oklch[3]) * Math.PI) / 180;
  return {
    lightness,
    a: chroma * Math.cos(hue),
    b: chroma * Math.sin(hue),
  };
}

function contrastRatio(left: OklabColor, right: OklabColor): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

function relativeLuminance(color: OklabColor): number {
  const lRoot = color.lightness + 0.3963377774 * color.a + 0.2158037573 * color.b;
  const mRoot = color.lightness - 0.1055613458 * color.a - 0.0638541728 * color.b;
  const sRoot = color.lightness - 0.0894841775 * color.a - 1.291485548 * color.b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const red = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function oklabDistance(left: OklabColor, right: OklabColor): number {
  return Math.hypot(
    left.lightness - right.lightness,
    left.a - right.a,
    left.b - right.b,
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
