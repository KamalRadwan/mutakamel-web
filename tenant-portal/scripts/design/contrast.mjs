// Verifies the token palette's contrast claims by actually computing them.
//
// docs/design/DESIGN-SYSTEM.md asserts specific WCAG ratios for the fill, text, ring
// and muted roles in both themes. Those were derived by reasoning about OKLCH
// lightness, not measured. This converts each token to sRGB and computes the
// real ratio, so a wrong step is caught before any screen is built.
//
// Usage: node scripts/design/contrast.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ---------- OKLCH -> linear sRGB -> relative luminance ---------- */

function oklchToLinearSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function relativeLuminance({ r, g, b }) {
  // Linear-light values already; clamp out-of-gamut before weighting.
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

function toHex({ r, g, b }) {
  const enc = (v) => {
    const c = clamp01(v);
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(clamp01(srgb) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${enc(r)}${enc(g)}${enc(b)}`;
}

function inGamut({ r, g, b }) {
  const eps = 1e-4;
  return [r, g, b].every((v) => v >= -eps && v <= 1 + eps);
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- The palette, READ FROM the token source of truth ---------- */

// This used to be a hand-copied table, which meant every palette change had to
// be made twice and the second copy silently rotted. It now parses
// src/app/globals.css — the file that declares the tokens — so this gate can
// never validate a palette the app does not actually ship.

const here = dirname(fileURLToPath(import.meta.url));
const globalsPath = join(here, "..", "..", "src", "app", "globals.css");
const css = readFileSync(globalsPath, "utf8");

const RAMP_TOKEN =
  /--color-(ink|brand|positive|caution|negative)-(\d+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;

const T = { white: [1, 0, 0] };
for (const m of css.matchAll(RAMP_TOKEN)) {
  T[`${m[1]}-${m[2]}`] = [Number(m[3]), Number(m[4]), Number(m[5])];
}

// A silent parse failure would validate an empty palette and report success,
// which is worse than a wrong colour. Pin the expected shape.
const RAMP_STEPS = { ink: 13, brand: 11, positive: 11, caution: 11, negative: 11 };
for (const [ramp, expected] of Object.entries(RAMP_STEPS)) {
  const found = Object.keys(T).filter((k) => k.startsWith(`${ramp}-`)).length;
  if (found !== expected) {
    process.stderr.write(
      `Palette parse failed: expected ${expected} ${ramp} steps in globals.css, found ${found}.\n`,
    );
    process.exit(1);
  }
}

const rgb = Object.fromEntries(
  Object.entries(T).map(([k, v]) => [k, oklchToLinearSrgb(...v)]),
);

/* ---------- The claims from docs/design/DESIGN-SYSTEM.md ---------- */

const CLAIMS = [
  // [label, foreground, background, required ratio, claimed in DESIGN-SYSTEM.md]
  ["primary fill · light", "white", "brand-600", 4.5, 4.79],
  ["primary fill · dark", "ink-950", "brand-400", 4.5, 7.47],
  ["link/text · light", "brand-700", "white", 4.5, 6.88],
  ["link/text · dark", "brand-300", "ink-1000", 4.5, 11.24],
  ["muted text · light", "ink-600", "white", 4.5, 6.31],
  ["muted text · dark", "ink-400", "ink-1000", 4.5, 8.07],
  ["body text · light", "ink-900", "ink-50", 4.5, 15.37],
  ["body text · dark", "ink-100", "ink-1000", 4.5, 18.31],
  ["destructive fill", "white", "negative-700", 4.5, 7.02],
  ["positive text · light", "positive-700", "white", 4.5, 5.78],
  ["positive text · dark", "positive-300", "ink-1000", 4.5, 12.29],
  ["focus ring · light (non-text)", "brand-500", "ink-50", 3.0, 3.4],
  ["focus ring · dark (non-text)", "brand-400", "ink-1000", 3.0, 7.96],
  ["zebra row separation (non-text)", "ink-25", "white", 1.0, null],

  // Badge tones. Badge.tsx renders <tone>-800 on <tone>-100 in light and
  // <tone>-300 on <tone>-950 in dark, for all four roles — eight pairs this
  // gate never checked, on the most numerous coloured element in the product.
  ["badge brand · light", "brand-800", "brand-100", 4.5, 7.9],
  ["badge positive · light", "positive-800", "positive-100", 4.5, 7.19],
  ["badge caution · light", "caution-800", "caution-100", 4.5, 6.29],
  ["badge negative · light", "negative-800", "negative-100", 4.5, 8.07],
  ["badge brand · dark", "brand-300", "brand-950", 4.5, 9.49],
  ["badge positive · dark", "positive-300", "positive-950", 4.5, 9.91],
  ["badge caution · dark", "caution-300", "caution-950", 4.5, 10.45],
  ["badge negative · dark", "negative-300", "negative-950", 4.5, 9.47],
];

// The one genuine contrast-driven exclusion. The docs used to claim two more
// (negative-600 and caution fills); measurement disproved both, and tokens.md
// now carries the corrected reasoning. Do not re-add them here as contrast
// claims — "amber is never a filled button" is a semantic rule.
const MUST_FAIL = [
  ["ink-500 as muted text", "ink-500", "white", 4.5],
];

/* ---------- Report ---------- */

let failures = 0;
let drift = 0;

process.stdout.write("\nPALETTE CONTRAST VERIFICATION\n");
process.stdout.write("(computed from the OKLCH values in docs/design/DESIGN-SYSTEM.md)\n\n");

// An out-of-gamut token is not a warning. The browser clips it, so the colour
// that ships is not the colour that was measured — which silently invalidates
// every ratio computed against it.
const outOfGamut = Object.entries(rgb).filter(([, v]) => !inGamut(v));
if (outOfGamut.length > 0) {
  failures += outOfGamut.length;
  process.stdout.write("OUT OF sRGB GAMUT — the browser will clip these:\n");
  for (const [name, v] of outOfGamut) {
    process.stdout.write(`  FAIL  ${name.padEnd(16)} ${toHex(v)}\n`);
  }
  process.stdout.write("\n");
}

process.stdout.write("  ratio   need  claimed  role\n");
for (const [label, fg, bg, need, claimed] of CLAIMS) {
  const ratio = contrast(rgb[fg], rgb[bg]);
  const pass = ratio >= need;
  if (!pass) failures += 1;
  const claimDrift = claimed !== null && Math.abs(ratio - claimed) > 0.6;
  if (claimDrift) drift += 1;
  process.stdout.write(
    `  ${pass ? "OK " : "FAIL"} ${ratio.toFixed(2).padStart(6)}  ` +
      `${need.toFixed(1)}   ${claimed === null ? "  -  " : claimed.toFixed(1).padStart(5)}` +
      `${claimDrift ? " <-" : "  "}  ${label}\n`,
  );
}

process.stdout.write("\nNEGATIVE CONTROLS (the docs claim these fail — they must)\n");
for (const [label, fg, bg, need] of MUST_FAIL) {
  const ratio = contrast(rgb[fg], rgb[bg]);
  const correctlyFails = ratio < need;
  if (!correctlyFails) failures += 1;
  process.stdout.write(
    `  ${correctlyFails ? "OK " : "WRONG"} ${ratio.toFixed(2).padStart(6)}  ${label}\n`,
  );
}

process.stdout.write("\nRESOLVED HEX (for eyeballing / design tools)\n");
for (const [name, v] of Object.entries(rgb)) {
  if (name === "white") continue;
  process.stdout.write(`  ${name.padEnd(14)} ${toHex(v)}\n`);
}

process.stdout.write(
  `\n${failures === 0 ? "All contrast requirements met." : `${failures} CONTRAST FAILURE(S).`}` +
    `${drift > 0 ? `  ${drift} claimed ratio(s) drifted >0.6 from computed — update tokens.md.` : ""}\n`,
);

process.exit(failures > 0 ? 1 : 0);
