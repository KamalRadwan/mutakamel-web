// Design-system regression detector.
//
// Counts the raw signals the design system intends to change, so each phase
// can prove it moved only what it meant to move. Diffs against
// docs/design/census.baseline.json.
//
// Usage:
//   node scripts/design/census.mjs            print, and write a baseline if absent
//   node scripts/design/census.mjs --check    fail on any undeclared regression
//   node scripts/design/census.mjs --update   move the baseline forward
//
// --update is for a REVIEWED, INTENDED delta only. Never run it to turn a red
// gate green — see docs/design/enforcement.md.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");
const baselinePath = resolve(portalRoot, "docs/design/census.baseline.json");

const mode = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--update")
    ? "update"
    : "print";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);
// src/design-system/ is the target system, not the sprawl being measured — it
// legitimately defines the tokens and utilities this census counts.
const SKIP_ABSOLUTE_DIRS = new Set([resolve(srcRoot, "design-system")]);

function walk(directory) {
  if (SKIP_ABSOLUTE_DIRS.has(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIR_NAMES.has(entry.name) ? [] : walk(full);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [full] : [];
  });
}

function countMatches(text, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return (text.match(new RegExp(pattern.source, flags)) ?? []).length;
}

const COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

const colorUtility = (family) =>
  new RegExp(
    `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent|placeholder|caret)-${family}-[0-9]{2,3}\\b`,
    "g",
  );

const CHECKS = {
  colorUtilityTotal: colorUtility(`(?:${COLOR_FAMILIES.join("|")})`),
  arbitraryTypeSize: /\btext-\[[0-9]+px\]/g,
  fontBoldOrHeavier: /\bfont-(?:bold|extrabold|black)\b/g,
  fontNormalOrMedium: /\bfont-(?:normal|medium)\b/g,
  roundedXlOrAbove: /\brounded-(?:xl|2xl|3xl)\b/g,
  gradients: /\bbg-gradient-to-|\bbg-\[linear-gradient/g,
  backdropBlur: /\bbackdrop-blur\b|\bbackdrop-blur-/g,
  handRolledButtons: /<button\b/g,
  handRolledTables: /<table\b/g,
  physicalRtlViolations:
    /\b(?:ml|mr|pl|pr)-[0-9.]+\b|\b(?:left|right)-[0-9.]+\b|\btext-(?:left|right)\b|\bborder-[lr]\b|\brounded-[lr]-/g,
  languageTernaries: /(?:lang === "ar"|isRtl|isArabic)\s*\?/g,
};

const files = existsSync(srcRoot) ? walk(srcRoot) : [];
const counts = Object.fromEntries(Object.keys(CHECKS).map((key) => [key, 0]));
const colorFamilyCounts = Object.fromEntries(
  COLOR_FAMILIES.map((family) => [family, 0]),
);

for (const filePath of files) {
  const text = readFileSync(filePath, "utf8");
  const isStyleSheet = extname(filePath) === ".css";
  for (const [key, pattern] of Object.entries(CHECKS)) {
    // JSX/TS-only signals do not apply to stylesheets.
    if (isStyleSheet && key !== "gradients" && key !== "backdropBlur") continue;
    counts[key] += countMatches(text, pattern);
  }
  if (isStyleSheet) continue;
  for (const family of COLOR_FAMILIES) {
    colorFamilyCounts[family] += countMatches(text, colorUtility(family));
  }
}

const colorFamiliesInUse = Object.values(colorFamilyCounts).filter(
  (count) => count > 0,
).length;

const report = {
  generatedAt: new Date().toISOString(),
  fileCount: files.length,
  counts: { ...counts, colorFamiliesInUse },
  colorFamilyCounts,
};

// Counters where a HIGHER number is worse. fontNormalOrMedium is excluded —
// it is expected to grow as bold sites de-escalate.
const REGRESSION_KEYS = Object.keys(CHECKS).filter(
  (key) => key !== "fontNormalOrMedium",
);
REGRESSION_KEYS.push("colorFamiliesInUse");

if (mode === "print" || mode === "update") {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (mode === "update" || (mode === "print" && !existsSync(baselinePath))) {
  writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Baseline written: ${relative(portalRoot, baselinePath)}\n`);
  process.exit(0);
}

if (mode === "check") {
  if (!existsSync(baselinePath)) {
    process.stderr.write(
      "No census baseline. Run: node scripts/design/census.mjs\n",
    );
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const regressions = [];
  for (const key of REGRESSION_KEYS) {
    const before = baseline.counts?.[key] ?? 0;
    const now = report.counts[key] ?? 0;
    if (now > before) regressions.push(`  ${key}: ${before} -> ${now}`);
  }

  if (regressions.length > 0) {
    process.stderr.write(
      `Design census regressions (${regressions.length}):\n${regressions.join("\n")}\n\n` +
        "If this delta is intended and reviewed, run:\n" +
        "  node scripts/design/census.mjs --update\n",
    );
    process.exit(1);
  }

  const improvements = REGRESSION_KEYS.filter(
    (key) => (report.counts[key] ?? 0) < (baseline.counts?.[key] ?? 0),
  );
  process.stdout.write(
    `Design census clean across ${files.length} files` +
      (improvements.length
        ? ` (${improvements.length} counters improved — run --update to bank them)\n`
        : ".\n"),
  );
}
