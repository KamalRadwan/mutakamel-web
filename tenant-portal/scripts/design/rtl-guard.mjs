// RTL guard. Hard-fails on physical direction utilities.
//
// This app is Arabic-first and RTL by default, so a physical utility is a bug
// the moment it is written — it does not mirror. The limit is 0, with no
// transitional headroom. See docs/design/theming.md.
//
// Usage: node scripts/design/rtl-guard.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");

const LIMIT = 0;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);

const VIOLATIONS = [
  { name: "margin",  pattern: /\b(?:ml|mr)-[0-9.]+\b/g,        fix: "use ms-* / me-*" },
  { name: "padding", pattern: /\b(?:pl|pr)-[0-9.]+\b/g,        fix: "use ps-* / pe-*" },
  { name: "inset",   pattern: /\b(?:left|right)-[0-9.]+\b/g,   fix: "use start-* / end-*" },
  { name: "align",   pattern: /\btext-(?:left|right)\b/g,      fix: "use text-start / text-end" },
  { name: "border",  pattern: /\bborder-[lr]\b/g,              fix: "use border-s / border-e" },
  { name: "radius",  pattern: /\brounded-[lr]-/g,              fix: "use rounded-s-* / rounded-e-*" },
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIR_NAMES.has(entry.name) ? [] : walk(full);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [full] : [];
  });
}

const files = existsSync(srcRoot) ? walk(srcRoot) : [];
const found = [];

for (const filePath of files) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);
  lines.forEach((line, index) => {
    for (const { name, pattern, fix } of VIOLATIONS) {
      const matches = line.match(new RegExp(pattern.source, "g"));
      if (!matches) continue;
      for (const match of matches) {
        found.push({
          file: relative(portalRoot, filePath).replaceAll("\\", "/"),
          line: index + 1,
          match,
          name,
          fix,
        });
      }
    }
  });
}

if (found.length > LIMIT) {
  process.stderr.write(
    `RTL guard failed: ${found.length} physical direction utilities (limit ${LIMIT}).\n\n`,
  );
  for (const item of found.slice(0, 60)) {
    process.stderr.write(
      `  ${item.file}:${item.line}  ${item.match}  (${item.name} — ${item.fix})\n`,
    );
  }
  if (found.length > 60) {
    process.stderr.write(`  ... and ${found.length - 60} more\n`);
  }
  process.stderr.write("\nSee docs/design/theming.md#rtl\n");
  process.exit(1);
}

process.stdout.write(
  `RTL guard clean across ${files.length} files (0 physical direction utilities).\n`,
);
