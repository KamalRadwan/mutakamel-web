// Validates every in-repo Markdown anchor link (`file.md#heading` and `#heading`).
//
// check-docs.mjs validates that a linked FILE exists. It does not look at the
// fragment, so a link to a heading that was renamed stays green while landing
// the reader at the top of the page with no idea what they were meant to see.
// That is exactly what happened when headings were reworded during the
// implementation: 10 anchors rotted silently.
//
// Slugs follow GitHub's algorithm: lowercase, strip everything that is not
// alphanumeric / space / hyphen / underscore, then replace EACH space with a
// hyphen (consecutive spaces therefore produce consecutive hyphens — a heading
// containing an em-dash yields a double hyphen).
//
// Usage: node scripts/docs/verify-anchors.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const docsRoot = resolve(portalRoot, "docs");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // generated/ is machine-written and carries no hand-authored anchors.
      return entry.name === "generated" ? [] : walk(full);
    }
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

const slug = (heading) =>
  heading
    .replace(/\r/gu, "")
    .replace(/`/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 \-_]/gu, "")
    .trim()
    .replace(/ /gu, "-");

const files = walk(docsRoot);
const anchors = new Map();

for (const file of files) {
  const set = new Set();
  for (const m of readFileSync(file, "utf8").matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*\r?$/gmu)) {
    set.add(slug(m[1]));
  }
  anchors.set(resolve(file), set);
}

const rel = (p) => relative(portalRoot, p).replaceAll("\\", "/");
const failures = [];
let verified = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");

  // Cross-file: [label](../design/foo.md#bar)
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+\.md)#([^)\s]+)\)/gu)) {
    const target = resolve(dirname(file), m[1]);
    if (!anchors.has(target)) {
      failures.push({ file, link: `${m[1]}#${m[2]}`, why: "target file not found" });
      continue;
    }
    if (anchors.get(target).has(m[2])) {
      verified += 1;
      continue;
    }
    const stem = m[2].split("--")[0].slice(0, 12);
    const near = [...anchors.get(target)].find((a) => a.startsWith(stem));
    failures.push({
      file,
      link: `${m[1]}#${m[2]}`,
      why: near ? `no such heading — did you mean #${near}` : "no such heading",
    });
  }

  // Same-file: [label](#bar)
  for (const m of text.matchAll(/\[[^\]]*\]\(#([^)\s]+)\)/gu)) {
    if (anchors.get(resolve(file)).has(m[1])) verified += 1;
    else failures.push({ file, link: `#${m[1]}`, why: "no such heading in this file" });
  }
}

if (failures.length > 0) {
  process.stderr.write(`Broken anchors (${failures.length}):\n`);
  for (const f of failures) {
    process.stderr.write(`  ${rel(f.file)}\n      ${f.link}\n      ${f.why}\n`);
  }
  process.stderr.write(
    "\nA renamed heading breaks every link to it silently — the page still\n" +
      "resolves, the reader just lands nowhere useful. Fix the link, or restore\n" +
      "the heading.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Anchors verified: ${verified} across ${files.length} Markdown files.\n`,
);
