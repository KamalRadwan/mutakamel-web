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
const DESIGN_RAMP_FAMILIES = [
  "brand",
  "ink",
  "warn",
  "danger",
  "action",
  "surface",
  "success",
  "info",
];
const DIRECT_RAMP_FAMILIES = [...COLOR_FAMILIES, ...DESIGN_RAMP_FAMILIES];
const COLOR_UTILITY_RE = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-(?:${COLOR_FAMILIES.join("|")})-[0-9]{2,3}\\b`,
  "g",
);
const DIRECT_RAMP_UTILITY_RE = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-(?:${DIRECT_RAMP_FAMILIES.join("|")})-[0-9]{2,4}\\b`,
  "g",
);
const THEME_SENSITIVE_WHITE_RE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-white\b/g;
const STOCK_SHADOW_RE =
  /\b(?:shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?(?!-[\w[])|drop-shadow(?:-(?:xs|sm|md|lg|xl|2xl))?(?!-[\w[]))\b/g;
const RAW_HEX_RE = /#[0-9a-f]{3,8}\b/gi;
const SUB_FLOOR_NAMED_TEXT_RE = /\btext-(?:2xs|3xs)\b/g;
const ARBITRARY_TEXT_SIZE_RE = /\btext-\[([0-9]*\.?[0-9]+)(px|rem)\]/gi;
const MOTION_SITE_RE =
  /\b(?:animate-(?!none\b)[\w[\]./-]+|transition(?:-(?:all|transform|opacity))?\b|duration-[0-9]+|delay-[0-9]+|(?:slide|zoom|fade)-(?:in|out)[\w/-]*)\b/;
const REDUCED_MOTION_GUARD_RE = /\bmotion-(?:reduce|safe):/;
const NATIVE_CONTROL_RE = /<(button|input|select|textarea)\b/g;
const TABLE_RE = /<table\b/g;

const CANONICAL_NATIVE_PRIMITIVES = new Map([
  ["src/design-system/primitives/Button.tsx", new Set(["button"])],
  ["src/design-system/primitives/Input.tsx", new Set(["input"])],
  ["src/design-system/primitives/Range.tsx", new Set(["input"])],
  ["src/design-system/primitives/Textarea.tsx", new Set(["textarea"])],
  // Next's root global error boundary must be self-contained because the root
  // layout/design-system providers may be the failing code path.
  ["src/app/global-error.tsx", new Set(["button"])],
]);
const CANONICAL_TABLE_PRIMITIVE = "src/design-system/primitives/Table.tsx";

function portalRelativePath(path) {
  return relative(portalRoot, path).replaceAll("\\", "/");
}

function isTestSource(file) {
  return /\.(?:test|spec)\.(?:ts|tsx)$/u.test(portalRelativePath(file));
}

function countSubFloorText(text) {
  let total = countMatches(text, SUB_FLOOR_NAMED_TEXT_RE);
  for (const match of text.matchAll(ARBITRARY_TEXT_SIZE_RE)) {
    const value = Number(match[1]);
    const pixels = match[2].toLowerCase() === "rem" ? value * 16 : value;
    if (pixels < 13) total += 1;
  }
  return total;
}

// This is intentionally a census rather than a parser/linter: each source
// line that introduces visible motion is one site. A motion-safe or
// motion-reduce variant on that same class declaration marks the site as
// reviewed. The count makes unreviewed animation drift visible in CI.
function countMotionSitesMissingReduction(text) {
  return text.split(/\r?\n/u).reduce((total, line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return total;
    if (!MOTION_SITE_RE.test(line)) return total;
    return REDUCED_MOTION_GUARD_RE.test(line) ? total : total + 1;
  }, 0);
}

function countNativeOneOffControls(text, file) {
  const displayPath = portalRelativePath(file);
  // Test harness controls are fixtures, not shipped interface one-offs.
  if (isTestSource(file)) return 0;
  const allowedTags = CANONICAL_NATIVE_PRIMITIVES.get(displayPath);
  let total = 0;
  for (const match of text.matchAll(NATIVE_CONTROL_RE)) {
    if (!allowedTags?.has(match[1])) total += 1;
  }
  return total;
}

function isChartSource(file, text) {
  const displayPath = portalRelativePath(file);
  return (
    /(?:^|\/)charts?(?:\/|$)/iu.test(displayPath) ||
    /Chart(?:s)?(?:\.(?:test|spec))?\.(?:ts|tsx)$/u.test(displayPath) ||
    /\bfrom\s+["'](?:recharts|chart\.js|echarts)["']/u.test(text)
  );
}

const CHECKS = {
  colorUtilityTotal: { pattern: COLOR_UTILITY_RE, files: ["ts", "tsx"] },
  directRampUtilityTotal: { pattern: DIRECT_RAMP_UTILITY_RE, files: ["ts", "tsx"] },
  themeSensitiveWhite: { pattern: THEME_SENSITIVE_WHITE_RE, files: ["ts", "tsx"] },
  stockShadows: { pattern: STOCK_SHADOW_RE, files: ["ts", "tsx"] },
  rawChartHex: {
    count: ({ file, text }) => (isChartSource(file, text) ? countMatches(text, RAW_HEX_RE) : 0),
    files: ["ts", "tsx"],
  },
  subFloorText: { count: ({ text }) => countSubFloorText(text), files: ["ts", "tsx"] },
  motionSitesMissingReducedMotion: {
    // Test names and fixture copy can legitimately use words such as
    // "transition"; only shipped interface motion needs a reduced-motion
    // fallback.
    count: ({ file, text }) =>
      isTestSource(file) ? 0 : countMotionSitesMissingReduction(text),
    files: ["ts", "tsx"],
  },
  nativeOneOffControls: {
    count: ({ file, text }) => countNativeOneOffControls(text, file),
    files: ["tsx"],
  },
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
  handRolledTables: {
    count: ({ file, text }) =>
      portalRelativePath(file) === CANONICAL_TABLE_PRIMITIVE ? 0 : countMatches(text, TABLE_RE),
    files: ["ts", "tsx"],
  },
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
  const directRampFamilyCounts = Object.fromEntries(DIRECT_RAMP_FAMILIES.map((f) => [f, 0]));

  for (const file of files) {
    const kind = fileKind(file);
    const text = readFileSync(file, "utf8");

    for (const [name, check] of Object.entries(CHECKS)) {
      if (!check.files.includes(kind)) continue;
      counts[name] += check.count
        ? check.count({ file, kind, text })
        : countMatches(text, check.pattern);
    }

    if (kind !== "ts" && kind !== "tsx") continue;

    for (const family of DIRECT_RAMP_FAMILIES) {
      const re = new RegExp(
        `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-${family}-[0-9]{2,4}\\b`,
        "g",
      );
      const familyCount = countMatches(text, re);
      directRampFamilyCounts[family] += familyCount;
      if (Object.hasOwn(colorFamilyCounts, family)) {
        colorFamilyCounts[family] += familyCount;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    counts,
    colorFamilyCounts,
    colorFamiliesInUse: Object.values(colorFamilyCounts).filter((n) => n > 0).length,
    directRampFamilyCounts,
    directRampFamiliesInUse: Object.values(directRampFamilyCounts).filter((n) => n > 0).length,
  };
}

function appendCountMapDiff(lines, label, beforeMap = {}, afterMap = {}) {
  const keys = [...new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])].sort();
  for (const key of keys) {
    const before = beforeMap[key] ?? 0;
    const after = afterMap[key] ?? 0;
    if (before !== after) {
      lines.push(`  ${label}.${key}: ${before} -> ${after} (${after - before >= 0 ? "+" : ""}${after - before})`);
    }
  }
}

function diff(baseline, current) {
  const lines = [];
  if ((baseline.fileCount ?? 0) !== current.fileCount) {
    const delta = current.fileCount - (baseline.fileCount ?? 0);
    lines.push(`  fileCount: ${baseline.fileCount ?? 0} -> ${current.fileCount} (${delta >= 0 ? "+" : ""}${delta})`);
  }
  const countKeys = [...new Set([...Object.keys(baseline.counts ?? {}), ...Object.keys(current.counts)])].sort();
  for (const key of countKeys) {
    const before = baseline.counts[key] ?? 0;
    const after = current.counts[key] ?? 0;
    if (before !== after) {
      lines.push(`  ${key}: ${before} -> ${after} (${after - before >= 0 ? "+" : ""}${after - before})`);
    }
  }
  appendCountMapDiff(lines, "colorFamilyCounts", baseline.colorFamilyCounts, current.colorFamilyCounts);
  appendCountMapDiff(
    lines,
    "directRampFamilyCounts",
    baseline.directRampFamilyCounts,
    current.directRampFamilyCounts,
  );
  const familiesBefore =
    baseline.colorFamiliesInUse ??
    Object.values(baseline.colorFamilyCounts ?? {}).filter((n) => n > 0).length;
  const familiesAfter = current.colorFamiliesInUse;
  if (familiesBefore !== familiesAfter) {
    lines.push(`  colorFamiliesInUse: ${familiesBefore} -> ${familiesAfter}`);
  }
  const directFamiliesBefore =
    baseline.directRampFamiliesInUse ??
    Object.values(baseline.directRampFamilyCounts ?? {}).filter((n) => n > 0).length;
  if (directFamiliesBefore !== current.directRampFamiliesInUse) {
    lines.push(
      `  directRampFamiliesInUse: ${directFamiliesBefore} -> ${current.directRampFamiliesInUse}`,
    );
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
  console.error("design:census — baseline drift must be reviewed; run with --update only after approval.");
  process.exit(1);
} else {
  console.log(`design:census — scanned ${result.fileCount} files under src/.`);
  console.log(
    JSON.stringify(
      {
        counts: result.counts,
        colorFamiliesInUse: result.colorFamiliesInUse,
        directRampFamiliesInUse: result.directRampFamiliesInUse,
      },
      null,
      2,
    ),
  );
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
