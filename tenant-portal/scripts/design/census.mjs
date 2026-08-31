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
// src/design-system/ used to be skipped outright, which made the ratchet
// blind to its own subject: every hardcoded ramp step inside the system was
// uncounted by every counter (MASTER-PLAN task 3.30). It is now walked like
// everything else and reported under `designSystemCounts` — a separate block
// so the documented zero targets keep meaning "zero in feature code", while
// nothing is invisible any more.
const designSystemRoot = resolve(srcRoot, "design-system");

function isDesignSystem(filePath) {
  return filePath === designSystemRoot || filePath.startsWith(`${designSystemRoot}\\`) || filePath.startsWith(`${designSystemRoot}/`);
}

function walk(directory) {
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

// The five semantic role ramps. `colorUtilityTotal` counts only the 22
// Tailwind families, so until 3.30 a `bg-brand-600` in feature code passed a
// green census — roughly 30 such call sites survived one. They get their own
// counter rather than joining `colorUtilityTotal`: a raw Tailwind family is
// banned outright, while a ramp step is *wrong in feature code and correct
// inside the design system*, and one number cannot say both.
const ROLE_RAMPS = ["brand", "ink", "positive", "caution", "negative"];

const UTILITY_PREFIXES =
  "bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent|placeholder|caret";

const colorUtility = (family) =>
  new RegExp(`\\b(?:${UTILITY_PREFIXES})-${family}-[0-9]{2,3}\\b`, "g");

const CHECKS = {
  colorUtilityTotal: colorUtility(`(?:${COLOR_FAMILIES.join("|")})`),
  roleRampUtilities: colorUtility(`(?:${ROLE_RAMPS.join("|")})`),
  arbitraryTypeSize: /\btext-\[[0-9]+px\]/g,
  fontBoldOrHeavier: /\bfont-(?:bold|extrabold|black)\b/g,
  fontNormalOrMedium: /\bfont-(?:normal|medium)\b/g,
  roundedXlOrAbove: /\brounded-(?:xl|2xl|3xl)\b/g,
  // Tailwind v4 renamed `bg-gradient-to-*` to `bg-linear-to-*`. Matching only
  // the v3 spelling meant the counter could never fire against this codebase
  // and the baseline read `gradients: 0` while a gradient existed (3.30).
  // Both spellings are kept: v3 is still what a copy-pasted snippet carries.
  gradients: /\bbg-(?:gradient|linear|radial|conic)-to-|\bbg-\[(?:linear|radial|conic)-gradient/g,
  backdropBlur: /\bbackdrop-blur\b|\bbackdrop-blur-/g,
  handRolledButtons: /<button\b/g,
  handRolledTables: /<table\b/g,
  physicalRtlViolations:
    /\b(?:ml|mr|pl|pr)-[0-9.]+\b|\b(?:left|right)-[0-9.]+\b|\btext-(?:left|right)\b|\bborder-[lr]\b|\brounded-[lr]-/g,
  languageTernaries: /(?:lang === "ar"|isRtl|isArabic)\s*\?/g,
  // One mirror mechanism, counted two ways. Outliers ratchet at 0; the
  // canonical spelling is an informational census, so adopting it in more
  // places is not reported as a regression. See docs/design/icons.md#mirroring.
  rtlMirrorOutliers: /\brtl:(?:rotate-180|scale-x-)/g,
  rtlMirrorCanonical: /\brtl:-scale-x-100\b/g,
};

const files = existsSync(srcRoot) ? walk(srcRoot) : [];
const featureFiles = files.filter((filePath) => !isDesignSystem(filePath));
const designSystemFiles = files.filter(isDesignSystem);

function tally(fileList) {
  const counts = Object.fromEntries(Object.keys(CHECKS).map((key) => [key, 0]));
  const colorFamilyCounts = Object.fromEntries(
    COLOR_FAMILIES.map((family) => [family, 0]),
  );

  for (const filePath of fileList) {
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

  counts.colorFamiliesInUse = Object.values(colorFamilyCounts).filter(
    (count) => count > 0,
  ).length;
  return { counts, colorFamilyCounts };
}

// globals.css lives outside src/design-system/ but IS the design system's
// token source, so it is tallied with it — otherwise every ramp definition
// lands in the feature-code column and `roleRampUtilities: 0` is unreachable
// for a reason that has nothing to do with feature code.
const globalsCssPath = resolve(srcRoot, "app/globals.css");
const featureTally = tally(featureFiles.filter((filePath) => filePath !== globalsCssPath));
const designSystemTally = tally([
  ...designSystemFiles,
  ...featureFiles.filter((filePath) => filePath === globalsCssPath),
]);

const report = {
  generatedAt: new Date().toISOString(),
  fileCount: featureFiles.length,
  designSystemFileCount: designSystemFiles.length,
  counts: featureTally.counts,
  colorFamilyCounts: featureTally.colorFamilyCounts,
  // The design system is no longer invisible. These counters ratchet the same
  // way, but they carry no zero target: the system is where a ramp step, a
  // <button> and a <table> legitimately live.
  designSystemCounts: designSystemTally.counts,
};

// Counters where a HIGHER number is worse. fontNormalOrMedium is excluded —
// it is expected to grow as bold sites de-escalate — and so is
// rtlMirrorCanonical, for the same reason: it counts the sanctioned mechanism.
const INFORMATIONAL_KEYS = new Set(["fontNormalOrMedium", "rtlMirrorCanonical"]);
const REGRESSION_KEYS = Object.keys(CHECKS).filter(
  (key) => !INFORMATIONAL_KEYS.has(key),
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
    // The design system ratchets too — it is the subject the system is meant
    // to keep true, and leaving it unchecked is what let ~25 hardcoded ramp
    // consumers accumulate unseen.
    const beforeDs = baseline.designSystemCounts?.[key] ?? 0;
    const nowDs = report.designSystemCounts[key] ?? 0;
    if (nowDs > beforeDs) regressions.push(`  design-system ${key}: ${beforeDs} -> ${nowDs}`);
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
    (key) =>
      (report.counts[key] ?? 0) < (baseline.counts?.[key] ?? 0) ||
      (report.designSystemCounts[key] ?? 0) < (baseline.designSystemCounts?.[key] ?? 0),
  );
  process.stdout.write(
    `Design census clean across ${files.length} files` +
      (improvements.length
        ? ` (${improvements.length} counters improved — run --update to bank them)\n`
        : ".\n"),
  );
}
