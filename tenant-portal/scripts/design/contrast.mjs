// Verifies the token palette's contrast claims by actually computing them.
//
// docs/design/DESIGN-SYSTEM.md asserts specific WCAG ratios for the fill, text, ring
// and muted roles in both themes. Those were derived by reasoning about OKLCH
// lightness, not measured. This converts each token to sRGB and computes the
// real ratio, so a wrong step is caught before any screen is built.
//
// Usage: node scripts/design/contrast.mjs

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

/* ---------- The palette, mirroring docs/design/DESIGN-SYSTEM.md ---------- */

const T = {
  "brand-300": [0.8, 0.097, 258],
  "brand-400": [0.7, 0.155, 258],
  "brand-500": [0.606, 0.18, 258],
  "brand-600": [0.52, 0.18, 258],
  "brand-700": [0.442, 0.155, 258],
  "ink-25": [0.992, 0.004, 240],
  "ink-50": [0.983, 0.006, 240],
  "ink-100": [0.963, 0.01, 240],
  "ink-200": [0.923, 0.016, 240],
  "ink-400": [0.712, 0.028, 240],
  "ink-500": [0.585, 0.03, 240],
  "ink-600": [0.482, 0.03, 240],
  "ink-900": [0.247, 0.023, 240],
  "ink-950": [0.174, 0.02, 240],
  "ink-1000": [0.126, 0.017, 240],
  "positive-300": [0.812, 0.096, 166],
  "positive-600": [0.565, 0.113, 163],
  "positive-700": [0.478, 0.094, 162],
  "caution-100": [0.957, 0.04, 81],
  "caution-500": [0.755, 0.154, 64],
  "caution-700": [0.548, 0.128, 58],
  "negative-100": [0.939, 0.029, 19],
  "negative-200": [0.886, 0.056, 18],
  "negative-600": [0.556, 0.208, 15],
  "negative-700": [0.474, 0.18, 14],
  white: [1, 0, 0],
};

const rgb = Object.fromEntries(
  Object.entries(T).map(([k, v]) => [k, oklchToLinearSrgb(...v)]),
);

/* ---------- The claims from docs/design/DESIGN-SYSTEM.md ---------- */

const CLAIMS = [
  // [label, foreground, background, required ratio, claimed in DESIGN-SYSTEM.md]
  ["primary fill · light", "white", "brand-600", 4.5, 5.64],
  ["primary fill · dark", "ink-950", "brand-400", 4.5, 7.04],
  ["link/text · light", "brand-700", "white", 4.5, 7.87],
  ["link/text · dark", "brand-300", "ink-1000", 4.5, 10.8],
  ["muted text · light", "ink-600", "white", 4.5, 6.44],
  ["muted text · dark", "ink-400", "ink-1000", 4.5, 7.94],
  ["body text · light", "ink-900", "ink-50", 4.5, 15.34],
  ["body text · dark", "ink-100", "ink-1000", 4.5, 18.15],
  ["destructive fill", "white", "negative-700", 4.5, 7.41],
  ["positive text · light", "positive-700", "white", 4.5, 6.28],
  ["positive text · dark", "positive-300", "ink-1000", 4.5, 11.71],
  ["focus ring · light (non-text)", "brand-500", "ink-50", 3.0, 3.74],
  ["focus ring · dark (non-text)", "brand-400", "ink-1000", 3.0, null],
  ["zebra row separation (non-text)", "ink-25", "white", 1.0, null],
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

const outOfGamut = Object.entries(rgb).filter(([, v]) => !inGamut(v));
if (outOfGamut.length > 0) {
  process.stdout.write("OUT OF sRGB GAMUT — these will be clipped by the browser:\n");
  for (const [name] of outOfGamut) process.stdout.write(`  ${name}\n`);
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
