// Design-system regression detector. Counts the raw signals that the
// design-system migration (docs/design-system/migration.md) intends to
// change, so every phase can prove it moved only what it meant to move.
//
// Usage:
//   node scripts/design/census.mjs           # print + write baseline if absent
//   node scripts/design/census.mjs --check   # diff against the committed baseline

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");
const baselinePath = resolve(portalRoot, "docs/design-system/census.baseline.json");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) return [];
      return walk(resolve(directory, entry.name));
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [resolve(directory, entry.name)] : [];
  });
}

function countMatches(text, pattern) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

const COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];
const COLOR_UTILITY_RE = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-(?:${COLOR_FAMILIES.join("|")})-[0-9]{2,3}\\b`,
  "g",
);

const CHECKS = {
  colorUtilityTotal: { pattern: COLOR_UTILITY_RE, files: ["ts", "tsx"] },
  arbitraryTypeSize: { pattern: /\btext-\[[0-9]+px\]/g, files: ["ts", "tsx"] },
  textXs: { pattern: /\btext-xs\b/g, files: ["ts", "tsx"] },
  fontBoldOrHeavier: { pattern: /\bfont-(?:bold|extrabold|black)\b/g, files: ["ts", "tsx"] },
  fontNormalOrMedium: { pattern: /\bfont-(?:normal|medium)\b/g, files: ["ts", "tsx"] },
  roundedXl: { pattern: /\brounded-xl\b/g, files: ["ts", "tsx"] },
  rounded2xl: { pattern: /\brounded-2xl\b/g, files: ["ts", "tsx"] },
  rounded3xl: { pattern: /\brounded-3xl\b/g, files: ["ts", "tsx"] },
  gradients: { pattern: /\bbg-gradient-to-/g, files: ["ts", "tsx"] },
  backdropBlur: { pattern: /\bbackdrop-blur\b/g, files: ["ts", "tsx"] },
  navbarRenderSites: { pattern: /<Navbar\b/g, files: ["ts", "tsx"] },
  handRolledTables: { pattern: /<table\b/g, files: ["ts", "tsx"] },
  physicalRtlViolations: {
    pattern: /\b(?:ml|mr|pl|pr|left|right)-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b|\btext-(?:left|right)\b|\bfile:m[lr]-/g,
    files: ["ts", "tsx"],
  },
  toastCallSites: { pattern: /\btoast\.(?:success|error|info|warning|saved)\(/g, files: ["ts", "tsx"] },
};

function fileKind(path) {
  return extname(path).slice(1);
}

function runCensus() {
  const files = walk(srcRoot);
  const counts = Object.fromEntries(Object.keys(CHECKS).map((k) => [k, 0]));
  const colorFamilyCounts = Object.fromEntries(COLOR_FAMILIES.map((f) => [f, 0]));

  for (const file of files) {
    const kind = fileKind(file);
    const text = readFileSync(file, "utf8");

    for (const [name, check] of Object.entries(CHECKS)) {
      if (!check.files.includes(kind)) continue;
      counts[name] += countMatches(text, check.pattern);
    }

    for (const family of COLOR_FAMILIES) {
      const re = new RegExp(
        `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-${family}-[0-9]{2,3}\\b`,
        "g",
      );
      colorFamilyCounts[family] += countMatches(text, re);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    counts,
    colorFamilyCounts,
    colorFamiliesInUse: Object.values(colorFamilyCounts).filter((n) => n > 0).length,
  };
}

function diff(baseline, current) {
  const lines = [];
  for (const key of Object.keys(current.counts)) {
    const before = baseline.counts[key] ?? 0;
    const after = current.counts[key];
    if (before !== after) {
      lines.push(`  ${key}: ${before} -> ${after} (${after - before >= 0 ? "+" : ""}${after - before})`);
    }
  }
  const familiesBefore = baseline.colorFamiliesInUse ?? Object.keys(baseline.colorFamilyCounts ?? {}).length;
  const familiesAfter = current.colorFamiliesInUse;
  if (familiesBefore !== familiesAfter) {
    lines.push(`  colorFamiliesInUse: ${familiesBefore} -> ${familiesAfter}`);
  }
  return lines;
}

const isCheck = process.argv.includes("--check");
const result = runCensus();

if (isCheck) {
  if (!existsSync(baselinePath)) {
    console.error(`No baseline found at ${relative(portalRoot, baselinePath)}. Run without --check first.`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const changes = diff(baseline, result);
  if (changes.length === 0) {
    console.log("design:census — no change vs baseline.");
    process.exit(0);
  }
  console.log("design:census — changes vs baseline:");
  console.log(changes.join("\n"));
  // This script only reports; phases that intend a change update the
  // baseline explicitly (see below) rather than having --check fail here.
  process.exit(0);
} else {
  console.log(`design:census — scanned ${result.fileCount} files under src/.`);
  console.log(JSON.stringify({ counts: result.counts, colorFamiliesInUse: result.colorFamiliesInUse }, null, 2));
  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, JSON.stringify(result, null, 2) + "\n");
    console.log(`Wrote baseline to ${relative(portalRoot, baselinePath)}`);
  } else {
    console.log(`Baseline already exists at ${relative(portalRoot, baselinePath)} (not overwritten). Pass --update to replace it.`);
    if (process.argv.includes("--update")) {
      writeFileSync(baselinePath, JSON.stringify(result, null, 2) + "\n");
      console.log("Baseline updated.");
    }
  }
}
