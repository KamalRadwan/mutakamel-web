// Verifies the OTHER direction: every API path this app's source actually
// calls must (a) exist in the Gateway contract and (b) be documented.
//
// The existing checks all start from the contract or the docs. None of them
// look at what the code calls. That gap let three completely fabricated Trade
// endpoints sit in the codebase — /trade/v1/analytics/daily-revenue,
// /trade/v1/credit/available-limit, /trade/v1/products/top-selling — none of
// which has a controller anywhere in trade-app.
//
// Usage:
//   node scripts/docs/verify-called-routes.mjs
//   node scripts/docs/verify-called-routes.mjs --json

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");
const apiDocsRoot = resolve(portalRoot, "docs/api");
const asJson = process.argv.includes("--json");

const inventory = JSON.parse(
  readFileSync(resolve(portalRoot, "docs/generated/tenant-api-routes.json"), "utf8"),
);

// Collapse every path parameter to one token so :id / :pipelineId / ${x} all
// compare equal.
const normalise = (p) =>
  p.replace(/\$\{[^}]*\}/gu, ":P").replace(/:[A-Za-z0-9_]+/gu, ":P").replace(/\/$/u, "");

const contractPaths = new Set(
  inventory.routes.map((route) => normalise(route.canonicalPath)),
);

/* ---------- what the docs mention ---------- */

const documentedPaths = new Set();
for (const name of readdirSync(apiDocsRoot).filter((f) => f.endsWith(".md"))) {
  const text = readFileSync(join(apiDocsRoot, name), "utf8");
  for (const m of text.matchAll(/\/api\/tenant\/[a-z]+\/v1\/[^\s`|)]*/gu)) {
    documentedPaths.add(normalise(m[0]));
  }
  // Domain pages use the short form in their route tables: `/leads/:id`
  for (const m of text.matchAll(/`(\/[a-z-]+(?:\/[:A-Za-z0-9_-]+)*)`/gu)) {
    for (const prefix of [
      "/api/tenant/core/v1",
      "/api/tenant/crm/v1",
      "/api/tenant/trade/v1",
    ]) {
      documentedPaths.add(normalise(prefix + m[1]));
    }
  }
}

/* ---------- what the source calls ---------- */

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ["node_modules", ".next"].includes(entry.name) ? [] : walk(full);
    }
    // Test files legitimately use invented paths as fixtures — a fake
    // endpoint is often the point of the test.
    if (/\.(test|spec)\.tsx?$/u.test(entry.name)) return [];
    return /\.tsx?$/u.test(entry.name) ? [full] : [];
  });
}

const calls = new Map(); // normalised path -> Set(relative file)
for (const file of existsSync(srcRoot) ? walk(srcRoot) : []) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/["`](\/api\/tenant\/[a-z]+\/v1\/[^"`?]*)/gu)) {
    const raw = m[1];
    // Skip obvious concatenation fragments — a bare prefix or a trailing slash.
    if (/\/v1\/?$/u.test(raw) || raw.endsWith("/")) continue;
    // Prose, not a call: `/api/tenant/core/v1/...` in a doc comment.
    if (raw.endsWith("...")) continue;
    const key = normalise(raw);
    // A template-literal TYPE — `/api/tenant/core/v1/${string}` in
    // src/lib/api/envelope.ts — normalises to one parameter directly under the
    // version prefix. No Gateway route has that shape, and a path assembled
    // entirely from a variable is already banned by the canonical-path rule, so
    // this can only ever be a type alias.
    if (/^\/api\/tenant\/[a-z]+\/v1\/:P$/u.test(key)) continue;
    if (!calls.has(key)) calls.set(key, new Set());
    calls.get(key).add(file.replace(portalRoot, "").replaceAll("\\", "/").replace(/^\//u, ""));
  }
}

/* ---------- findings ---------- */

const fabricated = [];
const undocumented = [];
let verified = 0;

for (const [path, files] of [...calls.entries()].sort()) {
  if (!contractPaths.has(path)) {
    fabricated.push({ path, files: [...files] });
    continue;
  }
  if (!documentedPaths.has(path)) {
    undocumented.push({ path, files: [...files] });
    continue;
  }
  verified += 1;
}

if (asJson) {
  process.stdout.write(
    `${JSON.stringify({ verified, fabricated, undocumented }, null, 2)}\n`,
  );
  process.exit(fabricated.length > 0 ? 1 : 0);
}

process.stdout.write(
  `\nCALLED-ROUTE VERIFICATION\n` +
    `  distinct paths called by src/ : ${calls.size}\n` +
    `  in contract AND documented    : ${verified}\n` +
    `  NOT in the Gateway contract   : ${fabricated.length}\n` +
    `  in contract, undocumented     : ${undocumented.length}\n`,
);

if (fabricated.length > 0) {
  process.stdout.write(
    `\nFABRICATED — these paths do not exist in the Gateway contract:\n`,
  );
  for (const { path, files } of fabricated) {
    process.stdout.write(`  ${path}\n`);
    for (const f of files) process.stdout.write(`      ${f}\n`);
  }
}

if (undocumented.length > 0) {
  process.stdout.write(`\nUNDOCUMENTED — real routes with no API page entry:\n`);
  for (const { path, files } of undocumented) {
    process.stdout.write(`  ${path}\n`);
    for (const f of files) process.stdout.write(`      ${f}\n`);
  }
}

// A fabricated endpoint is a real defect — the call can only ever 404.
// An undocumented-but-real route is a docs gap, reported but not fatal, so the
// gate does not block on documentation debt in code that is being deleted.
if (fabricated.length > 0) {
  process.stderr.write(
    `\nFAILED: ${fabricated.length} fabricated endpoint(s).\n` +
      `Either the path is wrong, or the feature was built against an API that\n` +
      `was never implemented. Do not add a Gateway route to make this pass —\n` +
      `record it in docs/build/OPEN-QUESTIONS.md.\n`,
  );
  process.exit(1);
}

process.stdout.write("\nNo fabricated endpoints.\n");
