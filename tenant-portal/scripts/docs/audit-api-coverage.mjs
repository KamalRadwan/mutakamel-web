// Deep API audit. Answers one question: is the documentation actually complete
// and correct against the OWNING CONTROLLERS, not just the Gateway inventory?
//
// verify-route-claims.mjs checks docs against docs/generated/tenant-api-routes.json
// (method + path). That inventory does NOT carry permissions or HTTP status
// codes — those live on the controller decorators. This script reads the
// controllers directly and reports:
//
//   1. Gateway routes with no semantic documentation at all
//   2. Permission strings a doc page claims that the controller does not require
//   3. Permissions the controller requires that the doc page omits
//   4. Controller routes that the Gateway does not expose (do not call these)
//
// Read-only. Never writes to ../backend.
//
// Usage: node scripts/docs/audit-api-coverage.mjs [--json]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const backendRoot = resolve(portalRoot, "../../backend/mutakamel-apps");
const apiRoot = resolve(portalRoot, "docs/api");
const asJson = process.argv.includes("--json");

const inventory = JSON.parse(
  readFileSync(resolve(portalRoot, "docs/generated/tenant-api-routes.json"), "utf8"),
);

/* ------------------------------------------------------------------ */
/* 1. Parse the owning controllers                                     */
/* ------------------------------------------------------------------ */

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : walk(full);
    }
    return entry.name.endsWith(".controller.ts") && !entry.name.endsWith(".spec.ts")
      ? [full]
      : [];
  });
}

const CONTROLLER_ROOTS = [
  { app: "crm", dir: resolve(backendRoot, "crm-app/src/crm") },
  { app: "core", dir: resolve(backendRoot, "core-app/src/tenant") },
  { app: "trade", dir: resolve(backendRoot, "trade-app/src") },
];

function controllerBasePath(text) {
  // @Controller({ path: 'crm/leads', version: '1' })  |  @Controller('tenant/auth')
  const objectForm = text.match(/@Controller\(\s*\{[^}]*path:\s*['"]([^'"]+)['"]/u);
  if (objectForm) return objectForm[1];
  const stringForm = text.match(/@Controller\(\s*['"]([^'"]+)['"]/u);
  return stringForm ? stringForm[1] : null;
}

function joinPath(base, sub) {
  const parts = [base, sub].filter((p) => p !== null && p !== undefined && p !== "");
  return `/${parts.join("/")}`.replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
}

const controllerRoutes = [];

for (const { app, dir } of CONTROLLER_ROOTS) {
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    const base = controllerBasePath(text);
    if (base === null) continue;

    // Split on HTTP method decorators, keeping what follows each until the
    // next one, so nearby @RequirePermissions/@HttpCode belong to that route.
    const methodRe =
      /@(Get|Post|Patch|Put|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/gu;
    const hits = [...text.matchAll(methodRe)];

    hits.forEach((hit, index) => {
      const start = hit.index;
      const end = index + 1 < hits.length ? hits[index + 1].index : text.length;
      const block = text.slice(start, end);

      const permissions = [
        ...block.matchAll(/@RequirePermissions\(([^)]*)\)/gu),
      ].flatMap((m) => [...m[1].matchAll(/['"]([^'"]+)['"]/gu)].map((p) => p[1]));

      const httpCodeMatch = block.match(/@HttpCode\(\s*(\d{3})\s*\)/u);
      const isPublic = /@Public\(\s*\)/u.test(block);

      controllerRoutes.push({
        app,
        file: file.replace(backendRoot, "..").replaceAll("\\", "/"),
        method: hit[1].toUpperCase(),
        upstream: joinPath(base, hit[2] ?? ""),
        permissions,
        httpCode: httpCodeMatch ? Number(httpCodeMatch[1]) : null,
        isPublic,
      });
    });
  }
}

/* ------------------------------------------------------------------ */
/* 2. Map controller routes onto Gateway canonical paths               */
/* ------------------------------------------------------------------ */

// Inventory upstreamPath looks like /api/v1/crm/leads/:id ; controller base
// gives crm/leads and the sub-path gives :id. Normalise both to a comparable
// key: METHOD + path with :params collapsed.
const normalise = (p) =>
  p.replace(/^\/api\/v\d+/u, "").replace(/:[A-Za-z0-9_]+/gu, ":p").replace(/\/$/u, "");

const inventoryByKey = new Map();
for (const route of inventory.routes) {
  inventoryByKey.set(
    `${route.method} ${normalise(route.upstreamPath)}`,
    route,
  );
}

const matched = [];
const notExposed = [];

for (const cr of controllerRoutes) {
  const key = `${cr.method} ${normalise(cr.upstream)}`;
  const route = inventoryByKey.get(key);
  if (route) matched.push({ ...cr, canonicalPath: route.canonicalPath, routeKey: route.routeKey });
  else notExposed.push(cr);
}

/* ------------------------------------------------------------------ */
/* 3. Read the hand-written docs                                       */
/* ------------------------------------------------------------------ */

const handWritten = readdirSync(apiRoot).filter(
  (n) => n.endsWith(".md") && !n.endsWith("-reference.md"),
);
const docText = new Map(
  handWritten.map((n) => [n, readFileSync(resolve(apiRoot, n), "utf8")]),
);
const allDocs = [...docText.values()].join("\n");

// A route is "semantically documented" when a hand-written page mentions its
// canonical path — either in full, or in the short form those pages use
// (e.g. `/leads/:id` inside crm-leads.md).
function isDocumented(canonicalPath) {
  if (allDocs.includes(canonicalPath)) return true;
  const short = canonicalPath.replace(/^\/api\/tenant\/(core|crm|trade)\/v1/u, "");
  return short.length > 1 && new RegExp(`\`${short.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\``, "u").test(allDocs);
}

/* ------------------------------------------------------------------ */
/* 4. Findings                                                         */
/* ------------------------------------------------------------------ */

const undocumented = [];
const permissionMismatch = [];

for (const route of matched) {
  const documented = isDocumented(route.canonicalPath);
  if (!documented) {
    undocumented.push(route);
    continue;
  }
  // Which page documents it? Only a ROUTE TABLE ROW counts — "the path appears
  // somewhere in the prose" produced false positives (an avatar URL inside a
  // JSON example was attributing Core directory routes to the opportunities
  // page). A gate that cries wolf gets ignored, so this must be exact.
  const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const short = route.canonicalPath.replace(
    /^\/api\/tenant\/(core|crm|trade)\/v1/u,
    "",
  );
  const rowRe = new RegExp(
    `\\|\\s*${route.method}\\s*\\|\\s*\`?(?:${escaped(route.canonicalPath)}|${escaped(short)})\`?\\s*\\|`,
    "u",
  );
  const page = handWritten.find((n) => rowRe.test(docText.get(n)));
  if (!page) continue;

  for (const permission of route.permissions) {
    if (!docText.get(page).includes(permission)) {
      permissionMismatch.push({ ...route, page, missingPermission: permission });
    }
  }
}

const summary = {
  controllerRoutesParsed: controllerRoutes.length,
  gatewayExposed: matched.length,
  controllerOnly: notExposed.length,
  inventoryTotal: inventory.routes.length,
  semanticallyDocumented: matched.length - undocumented.length,
  undocumented: undocumented.length,
  permissionOmissions: permissionMismatch.length,
};

if (asJson) {
  process.stdout.write(
    `${JSON.stringify({ summary, undocumented, permissionMismatch, notExposed }, null, 2)}\n`,
  );
  process.exit(0);
}

const byApp = (list) =>
  list.reduce((acc, r) => ((acc[r.app] = (acc[r.app] ?? 0) + 1), acc), {});

process.stdout.write(`
API COVERAGE AUDIT
==================
Controller routes parsed      ${summary.controllerRoutesParsed}
  Gateway-exposed             ${summary.gatewayExposed}
  Controller-only (DO NOT CALL) ${summary.controllerOnly}
Gateway inventory total       ${summary.inventoryTotal}

Semantically documented       ${summary.semanticallyDocumented}
Route-level only              ${summary.undocumented}   ${JSON.stringify(byApp(undocumented))}
Permission omissions          ${summary.permissionOmissions}
`);

if (permissionMismatch.length > 0) {
  process.stdout.write("\nPERMISSIONS ON A DOCUMENTED ROUTE THAT THE PAGE OMITS\n");
  for (const m of permissionMismatch.slice(0, 40)) {
    process.stdout.write(
      `  ${m.page}  ${m.method} ${m.canonicalPath}\n      requires: ${m.missingPermission}\n`,
    );
  }
  if (permissionMismatch.length > 40) {
    process.stdout.write(`  ... and ${permissionMismatch.length - 40} more\n`);
  }
}

if (notExposed.length > 0) {
  process.stdout.write(
    `\nCONTROLLER ROUTES THE GATEWAY DOES NOT EXPOSE (${notExposed.length}) — never call these\n`,
  );
  for (const r of notExposed.slice(0, 25)) {
    process.stdout.write(`  ${r.app.padEnd(6)} ${r.method.padEnd(7)} ${r.upstream}\n`);
  }
  if (notExposed.length > 25) {
    process.stdout.write(`  ... and ${notExposed.length - 25} more\n`);
  }
}

// Only permission omissions fail the build. "Route-level only" is a deliberate
// scope decision (Trade and most of Core have no portal screen), not a defect —
// gating on it would make the gate permanently red and therefore ignored.
if (permissionMismatch.length > 0) {
  process.stderr.write(
    `\nFAILED: ${permissionMismatch.length} documented route(s) omit a permission the ` +
      `controller requires.\nFix the API page against the controller's ` +
      `@RequirePermissions — never the other way round.\n`,
  );
  process.exit(1);
}

process.stdout.write("\nNo permission omissions on documented routes.\n");
