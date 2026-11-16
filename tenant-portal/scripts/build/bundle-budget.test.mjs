import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "vitest";

const script = readFileSync(new URL("./bundle-budget.mjs", import.meta.url), "utf8");

function fixture({ combined = false, eager = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "tenant-bundle-budget-"));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write("scripts/build/bundle-budget.mjs", script);
  const markers = { ar: "Arabic dictionary privacy fixture", en: "English dictionary privacy fixture" };
  for (const [language, marker] of Object.entries(markers)) {
    write(`src/i18n/dictionaries/${language}.ts`, `export const ${language} = { privacy: ${JSON.stringify(marker)} };`);
  }
  write(".next/build-manifest.json", JSON.stringify({ rootMainFiles: ["static/chunks/root.js"], polyfillFiles: [] }));
  write(".next/static/chunks/root.js", "// runtime");
  write(".next/static/chunks/ar.js", JSON.stringify(markers.ar));
  if (combined) {
    write(".next/static/chunks/ar.js", JSON.stringify(markers));
  } else {
    write(".next/static/chunks/en.js", JSON.stringify(markers.en));
  }
  for (const route of ["crm/leads", "trade/items"]) {
    const page = `static/chunks/app/(tenant)/${route}/page-123.js`;
    write(`.next/${page}`, "// page");
    const chunks = ["123", page];
    if (eager === "ar") chunks.push("static/chunks/ar.js");
    else if (eager) chunks.push("static/chunks/ar.js", "static/chunks/en.js");
    const manifest = { clientModules: { page: { chunks } } };
    write(`.next/server/app/(tenant)/${route}/page_client-reference-manifest.js`,
      `globalThis.__RSC_MANIFEST[${JSON.stringify(`/(tenant)/${route}/page`)}]=${JSON.stringify(manifest)};`);
  }
  return root;
}

function check(options) {
  const root = fixture(options);
  try {
    return spawnSync(process.execPath, [resolve(root, "scripts/build/bundle-budget.mjs")], { encoding: "utf8" });
  } finally {
    // mkdtemp created this exact temporary directory, never a repository path.
    rmSync(root, { recursive: true, force: true });
  }
}

test("accepts separate async dictionaries and reports route JS", () => {
  const result = check();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\/crm\/leads first-load JS/);
  assert.match(result.stdout, /\/trade\/items first-load JS/);
});

test("rejects both languages in one chunk regardless of its size", () => {
  const result = check({ combined: true });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /both dictionaries are in ar\.js/);
});

test("rejects separate dictionaries eagerly loaded by the same route", () => {
  const result = check({ eager: true });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /\/crm\/leads initially loads both dictionaries/);
});

test("rejects the selected dictionary in a route's initial JS", () => {
  const result = check({ eager: "ar" });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /\/crm\/leads initially loads the ar dictionary/);
});
