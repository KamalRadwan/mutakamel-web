import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRouteContracts } from "./route-contract-reader.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes("--check");
const portalRoot = resolve(scriptDirectory, "../..");
const workspaceRoot = resolve(portalRoot, "..");
const backendRepository = locateBackendRepository();

/**
 * The backend is a sibling checkout of the frontend, but "sibling of the
 * workspace root" only holds in the primary checkout. Inside a git worktree the
 * workspace root is `frontend/.claude/worktrees/<name>`, and the naive
 * `../backend` resolves to `worktrees/backend`, which does not exist -- so this
 * gate could never run from a worktree. Walk up instead, and let an explicit
 * env var win for checkouts laid out some other way.
 */
function locateBackendRepository() {
  const override = process.env.MUTAKAMEL_BACKEND_ROOT;
  if (override) return resolve(override);
  let directory = workspaceRoot;
  for (;;) {
    const candidate = resolve(directory, "../backend");
    if (existsSync(resolve(candidate, "mutakamel-apps"))) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(
    "Cannot locate the backend checkout. Expected a `backend` directory " +
      "containing `mutakamel-apps` beside the frontend checkout, or set " +
      "MUTAKAMEL_BACKEND_ROOT.",
  );
}
const backendApps = resolve(backendRepository, "mutakamel-apps");
const routeContractDirectory = resolve(
  backendApps,
  "api-gateway-app/src/routing-proxy/route-contracts",
);

const sources = [
  {
    app: "core",
    variableName: "CORE_ROUTE_CONTRACTS",
    fileName: "core.route-contracts.ts",
  },
  {
    app: "crm",
    variableName: "CRM_ROUTE_CONTRACTS",
    fileName: "crm.route-contracts.ts",
  },
  {
    app: "trade",
    variableName: "TRADE_ROUTE_CONTRACTS",
    fileName: "trade.route-contracts.ts",
  },
  // WebPhone is its own Gateway namespace served by core-app, so its routes
  // live in neither the core nor the crm/trade contracts. Without this entry
  // the inventory silently omitted every tenant WebPhone route while the
  // portal shipped the screens that call them.
  {
    app: "webphone",
    variableName: "WEBPHONE_ROUTE_CONTRACTS",
    fileName: "webphone.route-contracts.ts",
  },
];
const policySources = [
  resolve(
    backendApps,
    "api-gateway-app/src/routing-proxy/gateway-api-path.ts",
  ),
  resolve(
    backendApps,
    "api-gateway-app/src/routing-proxy/upstream-app.registry.ts",
  ),
];

function coreRouteBelongsToTenant(route) {
  const path = route.pathPattern;
  if (
    path.startsWith("/api/v1/tenant/") ||
    path.startsWith("/api/v1/core/tenant/") ||
    path.startsWith("/api/v1/core/templates") ||
    path.startsWith("/api/v1/core/business-letters")
  ) {
    return true;
  }
  return (
    route.routeClass === "PUBLIC" &&
    (path.startsWith("/api/v1/core/public/") ||
      path.startsWith("/api/v1/core/files/"))
  );
}

function canonicalize(app, legacyPath) {
  if (app === "crm") {
    return legacyPath.replace(
      /^\/api\/v([1-9][0-9]*)\/crm\/(.+)$/u,
      "/api/tenant/crm/v$1/$2",
    );
  }
  if (app === "trade") {
    return legacyPath.replace(
      /^\/api\/v([1-9][0-9]*)\/trade\/(.+)$/u,
      "/api/tenant/trade/v$1/$2",
    );
  }
  if (app === "webphone") {
    return legacyPath.replace(
      /^\/api\/v([1-9][0-9]*)\/tenant\/webphone\/(.+)$/u,
      "/api/tenant/webphone/v$1/$2",
    );
  }

  const mappings = [
    [
      /^\/api\/v([1-9][0-9]*)\/core\/tenant\/(.+)$/u,
      "/api/tenant/core/v$1/$2",
    ],
    [
      /^\/api\/v([1-9][0-9]*)\/tenant\/(.+)$/u,
      "/api/tenant/core/v$1/$2",
    ],
    [
      /^\/api\/v([1-9][0-9]*)\/core\/templates(?:\/(.*))?$/u,
      "/api/tenant/core/v$1/templates/$2",
    ],
    [
      /^\/api\/v([1-9][0-9]*)\/core\/business-letters(?:\/(.*))?$/u,
      "/api/tenant/core/v$1/business-letters/$2",
    ],
    [
      /^\/api\/v([1-9][0-9]*)\/core\/(public|files)(?:\/(.*))?$/u,
      "/api/tenant/core/v$1/$2/$3",
    ],
  ];

  for (const [pattern, replacement] of mappings) {
    if (!pattern.test(legacyPath)) continue;
    return legacyPath
      .replace(pattern, replacement)
      .replace(/\/undefined(?=\/|$)/gu, "")
      .replace(/\/+$/u, "");
  }
  throw new Error(`No tenant canonical mapping for ${legacyPath}`);
}

function portalUsage(route) {
  if (route.routeKey === "core.payments.webhook") {
    return "EXTERNAL_CALLBACK_DO_NOT_CALL";
  }
  if (route.routeKey === "core.public.fqdn-validation.validate") {
    return "PLATFORM_VALIDATION_DO_NOT_CALL_AS_FEATURE_API";
  }
  return "TENANT_PORTAL";
}

function repositoryRevision(repositoryPath) {
  try {
    const revision = execFileSync(
      "git",
      ["-C", repositoryPath, "rev-parse", "--short=12", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    const dirty =
      execFileSync(
        "git",
        [
          "-C",
          repositoryPath,
          "status",
          "--porcelain",
          "--untracked-files=no",
        ],
        { encoding: "utf8" },
      ).trim().length > 0;
    return dirty ? `${revision}+dirty` : revision;
  } catch {
    return "unavailable";
  }
}

function sourceHash(filePath) {
  return createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex");
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

const routes = [];
const routeSourceFiles = new Set();
for (const source of sources) {
  const sourcePath = resolve(routeContractDirectory, source.fileName);
  const { routes: extracted, sourceFiles } = readRouteContracts(sourcePath, source.variableName);
  sourceFiles.forEach((filePath) => routeSourceFiles.add(filePath));
  // crm and trade contracts are wholly tenant-facing; core and webphone both
  // carry admin routes in the same file and must be filtered.
  const tenantRoutes =
    source.app === "core" || source.app === "webphone"
      ? extracted.filter(coreRouteBelongsToTenant)
      : extracted;

  for (const route of tenantRoutes) {
    routes.push({
      app: source.app,
      canonicalPath: canonicalize(source.app, route.pathPattern),
      portalUsage: portalUsage(route),
      sourceContract: relative(workspaceRoot, sourcePath).replaceAll("\\", "/"),
      ...route,
    });
  }
}

routes.sort(
  (left, right) =>
    left.app.localeCompare(right.app) ||
    left.canonicalPath.localeCompare(right.canonicalPath) ||
    left.method.localeCompare(right.method) ||
    left.routeKey.localeCompare(right.routeKey),
);

const duplicateAddresses = [];
const addressKeys = new Set();
for (const route of routes) {
  const key = `${route.method} ${route.canonicalPath}`;
  if (addressKeys.has(key)) duplicateAddresses.push(key);
  addressKeys.add(key);
}
if (duplicateAddresses.length > 0) {
  throw new Error(
    `Duplicate tenant route addresses:\n${duplicateAddresses.join("\n")}`,
  );
}

const counts = {
  total: routes.length,
  byApp: {},
  byMethod: {},
  byRouteClass: {},
};
for (const route of routes) {
  increment(counts.byApp, route.app);
  increment(counts.byMethod, route.method);
  increment(counts.byRouteClass, route.routeClass);
}

const generatedAt = new Date().toISOString();
const sourceHashes = Object.fromEntries(
  [
    ...routeSourceFiles,
    ...policySources,
  ].map((filePath) => [
    relative(workspaceRoot, filePath).replaceAll("\\", "/"),
    sourceHash(filePath),
  ]),
);
const metadata = {
  generatedAt,
  generator: "scripts/docs/generate-route-inventory.mjs",
  frontendRevision: repositoryRevision(workspaceRoot),
  backendRevision: repositoryRevision(backendRepository),
  sourcePolicy:
    "Gateway master ownership and canonicalization rules for master=tenant",
  canonicalNamespaces: [
    "/api/tenant/core/v1/*",
    "/api/tenant/crm/v1/*",
    "/api/tenant/trade/v1/*",
  ],
  excludes:
    "Admin, partner, and direct Worker routes. Core PUBLIC public/files routes are included because tenant master owns them.",
};

const outputDirectory = resolve(portalRoot, "docs/generated");
mkdirSync(outputDirectory, { recursive: true });

const jsonOutputPath = resolve(outputDirectory, "tenant-api-routes.json");

if (checkOnly) {
  let existing;
  try {
    existing = JSON.parse(readFileSync(jsonOutputPath, "utf8"));
  } catch {
    throw new Error(
      "Generated tenant route inventory is missing or invalid; run npm run docs:routes",
    );
  }
  const expectedContract = JSON.stringify({ counts, sourceHashes, routes });
  const existingContract = JSON.stringify({
    counts: existing.counts,
    sourceHashes: existing.sourceHashes,
    routes: existing.routes,
  });
  if (expectedContract !== existingContract) {
    throw new Error(
      "Generated tenant route inventory is stale; run npm run docs:routes",
    );
  }
  process.stdout.write(
    `Tenant route inventory is current (${routes.length} routes).\n`,
  );
  process.exit(0);
}

writeFileSync(
  jsonOutputPath,
  `${JSON.stringify({ metadata, counts, sourceHashes, routes }, null, 2)}\n`,
  "utf8",
);

const markdown = [
  "# Generated Tenant API Route Inventory",
  "",
  "> GENERATED FILE. Do not edit by hand. Run",
  "> `npm run docs:routes` from `tenant-portal`.",
  "",
  `Generated at: **${generatedAt}**`,
  "",
  `Frontend revision: \`${metadata.frontendRevision}\``,
  "",
  `Backend revision: \`${metadata.backendRevision}\``,
  "",
  "Extraction method: Gateway route contracts filtered through the current",
  "`masterOwnsRoute` policy for `tenant`, then converted with the current",
  "canonical Gateway path mappings.",
  "",
  "## Coverage",
  "",
  "| App | Routes |",
  "| --- | ---: |",
  ...Object.entries(counts.byApp).map(
    ([app, count]) => `| ${app} | ${count} |`,
  ),
  `| **Total** | **${counts.total}** |`,
  "",
  "This inventory proves tenant-master Gateway method/path and edge-policy",
  "coverage. It does not replace controller, DTO, permission, response, or",
  "state-transition verification in the hand-written API guides.",
  "Routes marked `DO_NOT_CALL` are tenant-master reachable platform or",
  "integration endpoints, not application feature APIs.",
  "",
  "Machine-readable source:",
  "[tenant-api-routes.json](tenant-api-routes.json).",
  "",
  "## Routes",
  "",
  "| App | Method | Canonical Gateway path | Portal usage | Class | Idempotent | Route key |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...routes.map(
    (route) =>
      `| ${escapeMarkdown(route.app)} | ${escapeMarkdown(route.method)} | ` +
      `\`${escapeMarkdown(route.canonicalPath)}\` | ` +
      `${escapeMarkdown(route.portalUsage)} | ` +
      `${escapeMarkdown(route.routeClass)} | ` +
      `${route.idempotent ? "yes" : "no"} | ` +
      `\`${escapeMarkdown(route.routeKey)}\` |`,
  ),
  "",
].join("\n");

writeFileSync(
  resolve(outputDirectory, "tenant-api-routes.md"),
  markdown,
  "utf8",
);

process.stdout.write(
  `Generated ${routes.length} tenant routes: ${JSON.stringify(counts.byApp)}\n`,
);
