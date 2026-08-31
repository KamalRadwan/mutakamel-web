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

// Budgets are set just above what the tree measured on 2026-08-31, so the gate
// catches growth rather than blessing it. Raising one is a deliberate act that
// should carry a reason in the commit that does it.
const BUDGETS = {
  sharedBytes: 600 * 1024, // measured 526.6 kB
  largestChunkBytes: 1500 * 1024, // measured 1389.4 kB — the recharts/date-fns vendor chunk
  totalBytes: 6 * 1024 * 1024, // measured 5.33 MB
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

if (failures.length > 0) {
  for (const f of failures) process.stdout.write(`  FAIL  ${f}\n`);
  process.stdout.write(`\n${failures.length} bundle budget failure(s).\n`);
  process.exit(1);
}

process.stdout.write("  No feature code in shared chunks. All budgets met.\n");
