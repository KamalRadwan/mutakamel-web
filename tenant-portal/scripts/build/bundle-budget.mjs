// MASTER-PLAN 13.9 — the bundle budget, enforced rather than recorded.
//
// Runs after `next build` and reads the emitted chunks. Next 16 with
// `--webpack` prints no size table, so nothing else in this repo would notice a
// bundle doubling.
//
// It measures three things, and only the first is really a user-facing cost:
//
//   shared   the chunks EVERY route loads. A byte here is paid by someone who
//            only ever opens the login screen.
//   largest  the biggest single chunk. Route-level, so only the routes that
//            need it pay — but it is the number that grows silently when a
//            heavy library gets imported from one more place.
//   total    every emitted chunk. A weak signal on its own; it moves whenever a
//            screen is added, which is normal. Included so growth is visible.
//
// MASTER-PLAN 13.8 is the other half and it is the stricter rule: no module's
// feature code may appear in a shared chunk. Trade shipping to a Core user is
// not a size problem, it is a splitting failure, and a budget would not catch
// it — so it is asserted separately below.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const nextDir = join(repoRoot, ".next");

// Shared and largest-chunk budgets remain anchored to the 2026-08-31 baseline.
// Total was 6240.0 kB at the 2026-09-18 / 100-route checkpoint. The 2026-09-27
// build emits 6426.5 kB across 146 app paths, including Category tree/detail and
// Item integration (the Category workspace chunk is 42.1 kB). Rebase only the
// aggregate cap to 6.375 MiB for the added screens. Shared remains 526.6 kB;
// neither per-user budget nor the feature-isolation assertion is relaxed.
//
// 2026-10-29 (FE-BUNDLE-001): total rebased to 7.875 MiB. The 2026-10-28 build
// emitted 7947.8 kB, mostly because the ar+en dictionaries (≈975 kB) sat in one
// chunk every page loaded. They are now two async chunks (ar 558.2 kB, en
// 417.6 kB) and a page downloads only the selected one: /crm/leads first-load
// JS fell 3986.3 -> 3571.1 kB and /trade/items 3514.5 -> 3099.3 kB. Emitted
// bytes barely move (7950.8 kB) because both languages must still be emitted
// for switching — total measures what is built, not what one user downloads.
// Shared and largest are unchanged; the dictionary checks below are new.
//
// 2026-10-31: total rebased to 8.25 MiB (measured 8346.2 kB across 288 chunks)
// for the Core Settings Hub (23.2 kB), Workspace Settings v3 (50.0 kB),
// Self-Service Component Updates (24.1 kB), Trade Quotation composer routes,
// and their bilingual dictionary entries. Shared (527.9 kB) and largest
// (1410.7 kB) per-user budgets and feature-isolation assertions are unchanged.
//
// 2026-11-03: aggregate rebased to 8.5 MiB for the eleven-section CRM Settings
// suite. After shared-module deduplication, the deployed build emits 8497.0 kB
// across 366 chunks. Shared (528.0 kB), largest (1099.2 kB), feature isolation
// and async dictionary assertions retain their existing limits.
const BUDGETS = {
  sharedBytes: 600 * 1024, // measured 527.9 kB
  largestChunkBytes: 1500 * 1024, // measured 1410.7 kB — the recharts/zod/lucide vendor chunk
  totalBytes: 8.5 * 1024 * 1024, // measured 8497.0 kB on 2026-11-03
};

// Feature code that must never reach a chunk every route loads.
const FEATURE_MARKERS = {
  trade: /\(tenant\)[\\/]trade[\\/]|tradeIfMatch|derivePageInfo/,
  crm: /\(tenant\)[\\/]crm[\\/]|useLeads|useOpportunitiesList/,
  core: /\(tenant\)[\\/]core[\\/]|readCorePage/,
};

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return p.endsWith(".js") ? [p] : [];
  });
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(nextDir, "build-manifest.json"), "utf8"));
} catch {
  console.error("No .next/build-manifest.json — run `pnpm build` before this check.");
  process.exit(1);
}

const chunks = walk(join(nextDir, "static", "chunks"));
if (chunks.length === 0) {
  console.error("No chunks found under .next/static/chunks.");
  process.exit(1);
}

const sharedNames = new Set(
  [...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])].map((f) =>
    f.split("/").pop(),
  ),
);
const isShared = (p) => sharedNames.has(p.split(/[\\/]/).pop());

const sharedChunks = chunks.filter(isShared);
const sharedBytes = sharedChunks.reduce((a, c) => a + statSync(c).size, 0);
const totalBytes = chunks.reduce((a, c) => a + statSync(c).size, 0);
const sized = chunks
  .map((c) => ({ name: c.split(/[\\/]/).pop(), path: c, size: statSync(c).size }))
  .sort((a, b) => b.size - a.size);
const largest = sized[0];

const failures = [];

// FE-BUNDLE-001: use an existing, distinctive value from each source, so a
// translation edit cannot silently invalidate the co-bundling assertion.
const dictionaryChunks = {};
for (const language of ["ar", "en"]) {
  const source = readFileSync(join(repoRoot, "src", "i18n", "dictionaries", `${language}.ts`), "utf8");
  const literal = source.match(/["']?privacy["']?\s*:\s*("(?:\\.|[^"\\])*")/)?.[1];
  if (!literal) throw new Error(`Missing ${language} dictionary bundle marker`);
  const marker = JSON.parse(literal);
  dictionaryChunks[language] = chunks.filter((chunk) => {
    const contents = readFileSync(chunk, "utf8").replace(/\\u([\da-f]{4})/gi,
      (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return contents.includes(marker);
  });
  if (dictionaryChunks[language].length !== 1) {
    failures.push(`${language} dictionary must occur in exactly one async chunk; found ${dictionaryChunks[language].length}`);
  }
}
for (const chunk of dictionaryChunks.ar) {
  if (dictionaryChunks.en.includes(chunk)) {
    failures.push(`both dictionaries are in ${chunk.split(/[\\/]/).pop()} — languages must be separate async chunks`);
  }
}

// Next 16's per-page client-reference manifest includes ancestor index pages
// and sibling route groups too. Select chunk groups for this route's page,
// layouts and boundaries, rather than counting every entry in clientModules.
function routeChunks(route) {
  const source = readFileSync(join(nextDir, "server", "app", "(tenant)", route, "page_client-reference-manifest.js"), "utf8");
  const json = source.match(/globalThis\.__RSC_MANIFEST\[[^\]]+\]\s*=\s*({[\s\S]+})\s*;?\s*$/)?.[1];
  if (!json) throw new Error(`Cannot read client-reference manifest for /${route}`);
  const reference = JSON.parse(json);
  const ancestors = ["app", "app/(tenant)"];
  for (const part of route.split("/")) ancestors.push(`${ancestors.at(-1)}/${part}`);
  const entries = new Set(ancestors.flatMap((ancestor) =>
    ["layout", "template", "loading", "error", "not-found"].map((name) => `${ancestor}/${name}`)));
  entries.add("app/global-error");
  entries.add(`${ancestors.at(-1)}/page`);
  const names = new Set([...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])]);
  let foundPage = false;
  for (const clientModule of Object.values(reference.clientModules)) {
    const files = clientModule.chunks.filter((name) => name.endsWith(".js"));
    const entry = files.find((name) => name.startsWith("static/chunks/app/"))
      ?.replace(/^static\/chunks\//, "").replace(/-[^/-]+\.js$/, "");
    if (!entries.has(entry)) continue;
    if (entry === `${ancestors.at(-1)}/page`) foundPage = true;
    for (const name of files) names.add(name);
  }
  if (!foundPage) throw new Error(`No page entry in client-reference manifest for /${route}`);
  return [...names].map((name) => join(nextDir, name));
}

const routeSizes = ["crm/leads", "trade/items"].map((route) => {
  const files = routeChunks(route);
  const languages = Object.entries(dictionaryChunks)
    .filter(([, paths]) => paths.some((path) => files.includes(path)))
    .map(([language]) => language);
  if (languages.length === 2) failures.push(`/${route} initially loads both dictionaries`);
  else if (languages.length === 1) {
    failures.push(`/${route} initially loads the ${languages[0]} dictionary — the provider must fetch it async`);
  }
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  // The provider fetches exactly one dictionary chunk on first load (Arabic
  // by default), so a page's real first-load JS includes it.
  const selected = dictionaryChunks.ar[0] ? statSync(dictionaryChunks.ar[0]).size : 0;
  return { route, bytes, firstLoad: bytes + selected };
});

if (sharedBytes > BUDGETS.sharedBytes) {
  failures.push(
    `shared chunks ${kb(sharedBytes)} exceeds ${kb(BUDGETS.sharedBytes)} — every route pays this`,
  );
}
if (largest.size > BUDGETS.largestChunkBytes) {
  failures.push(
    `largest chunk ${largest.name} at ${kb(largest.size)} exceeds ${kb(BUDGETS.largestChunkBytes)}`,
  );
}
if (totalBytes > BUDGETS.totalBytes) {
  failures.push(`total ${kb(totalBytes)} exceeds ${kb(BUDGETS.totalBytes)}`);
}

// 13.8 — the splitting assertion. Not a budget: any hit is a failure.
for (const chunk of sharedChunks) {
  const text = readFileSync(chunk, "utf8");
  for (const [feature, pattern] of Object.entries(FEATURE_MARKERS)) {
    if (pattern.test(text)) {
      failures.push(
        `${feature} feature code is in shared chunk ${chunk.split(/[\\/]/).pop()} — ` +
          `it would ship to every route, including users who never open ${feature}`,
      );
    }
  }
}

process.stdout.write("\nBUNDLE BUDGET\n\n");
process.stdout.write(`  chunks emitted   ${chunks.length}\n`);
process.stdout.write(
  `  shared           ${kb(sharedBytes).padStart(9)}  / ${kb(BUDGETS.sharedBytes)}  (${sharedChunks.length} chunks, every route)\n`,
);
process.stdout.write(
  `  largest chunk    ${kb(largest.size).padStart(9)}  / ${kb(BUDGETS.largestChunkBytes)}  (${largest.name})\n`,
);
process.stdout.write(
  `  total            ${kb(totalBytes).padStart(9)}  / ${kb(BUDGETS.totalBytes)}\n\n`,
);
for (const [language, files] of Object.entries(dictionaryChunks)) {
  process.stdout.write(`  ${language} dictionary    ${files.map((file) => file.split(/[\\/]/).pop()).join(", ") || "missing"}\n`);
}
for (const { route, bytes, firstLoad } of routeSizes) {
  process.stdout.write(`  /${route} first-load JS  ${kb(firstLoad)}  (${kb(bytes)} initial + ar dictionary)\n`);
}
process.stdout.write("\n");

if (failures.length > 0) {
  for (const f of failures) process.stdout.write(`  FAIL  ${f}\n`);
  process.stdout.write(`\n${failures.length} bundle budget failure(s).\n`);
  process.exit(1);
}

process.stdout.write("  No feature code in shared chunks. All budgets met.\n");
