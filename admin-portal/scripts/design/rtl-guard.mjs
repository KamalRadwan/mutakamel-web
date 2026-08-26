// Hard gate: the codebase is 98% RTL-logical today (364 logical utilities vs
// 7 physical ones — see docs/design-system/migration.md). This script fails
// the build if physical direction utilities creep past that count, so a new
// PR can't silently reintroduce ml-/mr-/pl-/pr-/left-/right-/text-left/
// text-right in place of the logical ms-/me-/ps-/pe-/start-/end- forms.
//
// Usage: node scripts/design/rtl-guard.mjs [--limit=7]

import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");

const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) return [];
      return walk(resolve(directory, entry.name));
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [resolve(directory, entry.name)] : [];
  });
}

// One pattern per physical-property family. Kept separate (rather than one
// combined regex) so a failure message can name which family regressed.
// Each site should match exactly one pattern. The bare ml-/mr-/pl-/pr-
// patterns exclude a `file:` variant prefix so a `file:mr-3` utility is
// counted once, by the dedicated file: pattern, not twice.
const VIOLATION_PATTERNS = [
  { name: "ml-*", re: /(?<!file:)\bml-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
  { name: "mr-*", re: /(?<!file:)\bmr-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
  { name: "pl-*", re: /(?<!file:)\bpl-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
  { name: "pr-*", re: /(?<!file:)\bpr-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
  { name: "left-*", re: /\bleft-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
  { name: "right-*", re: /\bright-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
  { name: "text-left", re: /\btext-left\b/g },
  { name: "text-right", re: /\btext-right\b/g },
  { name: "file:m[lr]-*", re: /\bfile:m[lr]-(?:\[[^\]]+\]|[0-9]+(?:\.[0-9]+)?)\b/g },
];

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 7;

const files = walk(srcRoot);
const hits = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const { name, re } of VIOLATION_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      hits.push({ file: relative(portalRoot, file), line, family: name, text: match[0] });
    }
  }
}

console.log(`rtl-guard — found ${hits.length} physical direction utilities (limit ${LIMIT}).`);
if (hits.length > 0) {
  for (const hit of hits) {
    console.log(`  ${hit.file}:${hit.line}  ${hit.family}  (${hit.text})`);
  }
}

if (hits.length > LIMIT) {
  console.error(`\nFAIL: ${hits.length} exceeds the pinned limit of ${LIMIT}. Use logical properties (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) instead, or update --limit deliberately if this is a reviewed exception.`);
  process.exit(1);
}

console.log("rtl-guard — OK.");
