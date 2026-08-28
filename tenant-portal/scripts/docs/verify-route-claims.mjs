// Verifies that every route a hand-written API page claims actually exists in
// the Gateway inventory, with that exact method.
//
// This exists because a docs pass written partly from inference shipped two
// wrong claims (a PATCH that is really a PUT, and a DELETE that does not exist
// at all). check-docs.mjs catches the opposite direction — routes that exist
// but are undocumented — and could not catch these.
//
// Usage: node scripts/docs/verify-route-claims.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const apiRoot = resolve(portalRoot, "docs/api");
const inventoryPath = resolve(portalRoot, "docs/generated/tenant-api-routes.json");

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const exact = new Set(
  inventory.routes.map((route) => `${route.method} ${route.canonicalPath}`),
);
const methodsByPath = new Map();
for (const route of inventory.routes) {
  const list = methodsByPath.get(route.canonicalPath) ?? [];
  list.push(route.method);
  methodsByPath.set(route.canonicalPath, list);
}

// Generated pages are produced FROM the inventory, so they cannot drift.
const handWritten = readdirSync(apiRoot).filter(
  (name) => name.endsWith(".md") && !name.endsWith("-reference.md"),
);

const CLAIM =
  /\|\s*(GET|POST|PATCH|PUT|DELETE)\s*\|\s*`?(\/api\/tenant\/[^`|\s]+)`?/u;

const failures = [];
let verified = 0;

for (const name of handWritten) {
  const lines = readFileSync(resolve(apiRoot, name), "utf8").split(/\r?\n/u);
  lines.forEach((line, index) => {
    const match = line.match(CLAIM);
    if (!match) return;
    const [, method, path] = match;
    if (exact.has(`${method} ${path}`)) {
      verified += 1;
      return;
    }
    const actual = methodsByPath.get(path);
    failures.push(
      `docs/api/${name}:${index + 1}\n` +
        `    claims: ${method} ${path}\n` +
        `    actual: ${
          actual
            ? `path exists, but only [${[...new Set(actual)].sort().join(", ")}]`
            : "this path does not exist in the Gateway inventory"
        }`,
    );
  });
}

if (failures.length > 0) {
  process.stderr.write(
    `Route claim verification failed (${failures.length}):\n${failures.join("\n")}\n\n` +
      "A hand-written API page claims a route the Gateway does not expose.\n" +
      "Fix the page against docs/generated/tenant-api-routes.json — never the\n" +
      "other way round, and never by editing backend source.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Route claims verified: ${verified} across ${handWritten.length} hand-written API pages.\n`,
);
