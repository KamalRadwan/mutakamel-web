import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface OklabColor {
  lightness: number;
  a: number;
  b: number;
}

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const ramp = declarations(blockAfter(css, "@theme {"));
const light = declarations(blockAfter(css, "/* Semantic roles — light values."));
const dark = new Map([
  ...ramp,
  ...light,
  ...declarations(blockAfter(css, ".dark {")),
]);

describe("dark semantic contrast source guard", () => {
  it("keeps dual-use action and destructive roles AA as text and fills", () => {
    const card = resolveOklab("--card");
    const primary = resolveOklab("--primary");
    const destructive = resolveOklab("--destructive");

    const ratios = {
      primaryTextOnCard: contrastRatio(primary, card),
      primaryFillPair: contrastRatio(primary, resolveOklab("--primary-foreground")),
      destructiveTextOnCard: contrastRatio(destructive, card),
      destructiveFillPair: contrastRatio(
        destructive,
        resolveOklab("--destructive-foreground"),
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
    const card = resolveOklab("--card");
    const ratios = {
      border: contrastRatio(resolveOklab("--border"), card),
      input: contrastRatio(resolveOklab("--input"), card),
      ring: contrastRatio(resolveOklab("--ring"), card),
    };

    expect(ratios.border).toBeCloseTo(3.04, 2);
    expect(ratios.input).toBeCloseTo(3.04, 2);
    expect(ratios.ring).toBeCloseTo(7.24, 2);
    for (const ratio of Object.values(ratios)) {
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });
});

/** Source-token guard only; browser gamut mapping/compositing remains runtime evidence. */
function resolveOklab(token: string, seen = new Set<string>()): OklabColor {
  if (seen.has(token)) throw new Error(`Circular CSS variable reference: ${token}`);
  seen.add(token);
  const value = dark.get(token);
  if (!value) throw new Error(`Missing CSS token: ${token}`);
  if (value === "white") return { lightness: 1, a: 0, b: 0 };
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  if (variable) return resolveOklab(variable[1], seen);
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
