// Phase 7 codemods (docs/design-system/migration.md) — the deterministic,
// 1:1 substitutions. Each is a pure string rewrite with no judgment calls,
// unlike the dark:-pair collapse (codemod-pairs.mjs) or the gradient/blur
// deletions, which need a human to look at each site.
//
// Usage:
//   node scripts/design/codemod-simple.mjs --dry     # report counts only
//   node scripts/design/codemod-simple.mjs --apply   # write changes

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");

const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_ABSOLUTE_DIRS = new Set([resolve(srcRoot, "design-system")]);

function walk(directory) {
  if (SKIP_ABSOLUTE_DIRS.has(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) return [];
      return walk(resolve(directory, entry.name));
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [resolve(directory, entry.name)] : [];
  });
}

// Each rule: a regex + replacement, applied globally. Order matters where
// rules could otherwise double-match (none currently overlap).
const RULES = [
  {
    name: "font-black-extrabold-bold",
    re: /\bfont-(?:black|extrabold|bold)\b/g,
    replace: () => "font-semibold",
  },
  {
    name: "hex-canvas",
    re: /\bbg-\[#090d16\]/g,
    replace: () => "bg-canvas",
  },
  {
    name: "hex-sidebar",
    re: /\bbg-\[#(?:0f172a|0b132b)\]/g,
    replace: () => "bg-sidebar",
  },
  {
    name: "px-10px",
    re: /\bpx-\[10px\]/g,
    replace: () => "px-4",
  },
  {
    name: "radius-2xl-to-xl",
    re: /\brounded-2xl\b/g,
    replace: () => "rounded-xl",
  },
  {
    name: "radius-3xl-to-xl",
    re: /\brounded-3xl\b/g,
    replace: () => "rounded-xl",
  },
];

// text-[8-11px]: text-2xs if the *same class-attribute string* also
// contains "uppercase", else text-xs. Scoped per className="..."/'...' /
// clsx-style string literal (captured as one group) rather than a blind
// file-wide lookahead, so a match in one element's classes can't leak into
// the next element's decision.
const ARBITRARY_TYPE_SIZE_RE = /\btext-\[(?:8|9|10|11)px\]/;
const CLASS_STRING_RE = /(className\s*=\s*)(["'`])((?:(?!\2)[\s\S])*)\2/g;

function rewriteArbitraryTypeSizesInFile(text, counts) {
  return text.replace(CLASS_STRING_RE, (whole, prefix, quote, body) => {
    if (!ARBITRARY_TYPE_SIZE_RE.test(body)) return whole;
    const isUppercase = /\buppercase\b/.test(body);
    const target = isUppercase ? "text-2xs" : "text-xs";
    const countKey = isUppercase ? "arbitrary-type-2xs" : "arbitrary-type-xs";
    const newBody = body.replace(/\btext-\[(?:8|9|10|11)px\]/g, () => {
      counts[countKey] += 1;
      return target;
    });
    return `${prefix}${quote}${newBody}${quote}`;
  });
}

const isApply = process.argv.includes("--apply");
const files = walk(srcRoot);
const counts = Object.fromEntries([
  ...RULES.map((r) => [r.name, 0]),
  ["arbitrary-type-2xs", 0],
  ["arbitrary-type-xs", 0],
]);
const touchedFiles = new Set();

for (const file of files) {
  let text = readFileSync(file, "utf8");
  let fileChanged = false;

  const beforeArbitrary = text;
  text = rewriteArbitraryTypeSizesInFile(text, counts);
  if (text !== beforeArbitrary) fileChanged = true;

  for (const rule of RULES) {
    const before = text;
    text = text.replace(rule.re, (...args) => {
      counts[rule.name] += 1;
      return typeof rule.replace === "function" ? rule.replace(...args) : rule.replace;
    });
    if (text !== before) fileChanged = true;
  }

  if (fileChanged) {
    touchedFiles.add(relative(portalRoot, file));
    if (isApply) writeFileSync(file, text);
  }
}

console.log(`codemod-simple — ${isApply ? "APPLIED" : "DRY RUN"}`);
for (const [name, count] of Object.entries(counts)) {
  console.log(`  ${name}: ${count}`);
}
console.log(`Files touched: ${touchedFiles.size}`);
if (!isApply && touchedFiles.size > 0) {
  console.log("\nRun with --apply to write these changes.");
}
