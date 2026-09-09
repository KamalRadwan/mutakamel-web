import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRouteContracts } from "./route-contract-reader.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes("--check");
const portalRoot = resolve(scriptDirectory, "../..");
const frontendRoot = resolve(portalRoot, "..");
const backendRepository = locateBackendRepository();

/**
 * The backend is a sibling checkout of the frontend, but "sibling of the
 * frontend root" only holds in the primary checkout. Inside a git worktree the
 * frontend root is `frontend/.claude/worktrees/<name>`, and the naive
 * `../backend` resolves to `frontend/.claude/worktrees/backend`, which does not
 * exist -- so this gate could never run from a worktree. Walk up instead, and
 * let an explicit env var win for checkouts laid out some other way.
 */
function locateBackendRepository() {
  const override = process.env.MUTAKAMEL_BACKEND_ROOT;
  if (override) return resolve(override);
  let directory = frontendRoot;
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
const gatewayRoot = resolve(
  backendRepository,
  "mutakamel-apps/api-gateway-app",
);
const sourcePath = resolve(
  gatewayRoot,
  "src/routing-proxy/route-contracts/core.route-contracts.ts",
);
const canonicalizationSource = resolve(
  gatewayRoot,
  "src/routing-proxy/gateway-api-path.ts",
);

function canonicalize(pathPattern) {
  const match = pathPattern.match(
    /^\/api\/v([1-9][0-9]*)\/core\/admin(?:\/(.*))?$/u,
  );
  if (!match) {
    throw new Error(`No Admin canonical mapping for ${pathPattern}`);
  }
  return `/api/admin/core/v${match[1]}${match[2] ? `/${match[2]}` : ""}`;
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

const extracted = readRouteContracts(sourcePath, "CORE_ROUTE_CONTRACTS");
const routes = extracted.routes
  .filter((route) => route.routeKey.startsWith("core.admin."))
  .map((route) => ({
    method: route.method,
    canonicalPath: canonicalize(route.pathPattern),
    upstreamPath: route.upstreamPath,
    routeKey: route.routeKey,
    routeClass: route.routeClass,
    idempotent: route.idempotent,
    idempotencyMode: route.idempotencyMode ?? null,
    requiredPermissions: route.requiredPermissions ?? [],
    requiredPermissionsMode: route.requiredPermissionsMode ?? "ALL",
    bodyLimitClass: route.bodyLimitClass ?? null,
    timeoutClass: route.timeoutClass ?? null,
    transportRetryMode: route.transportRetryMode ?? null,
    domainIdempotencyOperation: route.domainIdempotencyOperation ?? null,
  }))
  .sort(
    (left, right) =>
      left.canonicalPath.localeCompare(right.canonicalPath) ||
      left.method.localeCompare(right.method) ||
      left.routeKey.localeCompare(right.routeKey),
  );

const addresses = new Set();
for (const route of routes) {
  const address = `${route.method} ${route.canonicalPath}`;
  if (addresses.has(address)) {
    throw new Error(`Duplicate Admin route address: ${address}`);
  }
  addresses.add(address);
}

const counts = {
  total: routes.length,
  byMethod: {},
  byRouteClass: {},
  byDomain: {},
};
for (const route of routes) {
  increment(counts.byMethod, route.method);
  increment(counts.byRouteClass, route.routeClass);
  increment(counts.byDomain, route.routeKey.split(".")[2]);
}



const sourceHashes = {
  ...Object.fromEntries(extracted.sourceFiles.map(path => [relative(frontendRoot, path).replaceAll("\\", "/"), sourceHash(path)])),
  [relative(frontendRoot, canonicalizationSource).replaceAll("\\", "/")]:
    sourceHash(canonicalizationSource),
};
const generatedAt = new Date().toISOString();
const metadata = {
  generatedAt,
  generator: "scripts/docs/generate-admin-route-inventory.mjs",
  frontendRevision: repositoryRevision(portalRoot),
  backendRevision: repositoryRevision(backendRepository),
  sourcePolicy:
    "Gateway Core routes whose routeKey starts with core.admin.",
  canonicalNamespace: "/api/admin/core/v1/*",
  scope:
    "Core Admin routes only; Worker backup/restore routes are documented separately.",
};

const outputDirectory = resolve(portalRoot, "docs/generated");
const jsonOutputPath = resolve(
  outputDirectory,
  "admin-core-api-routes.json",
);
mkdirSync(outputDirectory, { recursive: true });

if (checkOnly) {
  let existing;
  try {
    existing = JSON.parse(readFileSync(jsonOutputPath, "utf8"));
  } catch {
    throw new Error(
      "Generated Admin route inventory is missing or invalid; run npm run docs:routes",
    );
  }
  const expected = JSON.stringify({ counts, sourceHashes, routes });
  const actual = JSON.stringify({
    counts: existing.counts,
    sourceHashes: existing.sourceHashes,
    routes: existing.routes,
  });
  if (expected !== actual) {
    throw new Error(
      "Generated Admin route inventory is stale; run npm run docs:routes",
    );
  }
  process.stdout.write(
    `Admin Core route inventory is current (${routes.length} routes).\n`,
  );
  process.exit(0);
}

writeFileSync(
  jsonOutputPath,
  `${JSON.stringify({ metadata, counts, sourceHashes, routes }, null, 2)}\n`,
  "utf8",
);

const markdown = [
  "# Generated Admin Core API Route Inventory",
  "",
  "> GENERATED FILE. Do not edit by hand. Run `npm run docs:routes` from",
  "> `admin-portal`.",
  "",
  `Generated at: **${generatedAt}**`,
  "",
  `Frontend revision: \`${metadata.frontendRevision}\``,
  "",
  `Backend revision: \`${metadata.backendRevision}\``,
  "",
  "## Coverage",
  "",
  `This inventory contains **${counts.total}** browser-visible Core Admin routes.`,
  "It proves Gateway method/path, route class, idempotency, and permission",
  "metadata. It does not prove DTO fields, response projections, runtime",
  "feature flags, deployment, or current frontend implementation.",
  "",
  "| Route class | Routes |",
  "| --- | ---: |",
  ...Object.entries(counts.byRouteClass)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => `| ${name} | ${count} |`),
  `| **Total** | **${counts.total}** |`,
  "",
  "Machine-readable source:",
  "[admin-core-api-routes.json](admin-core-api-routes.json).",
  "",
  "## Domain counts",
  "",
  "| Gateway route-key domain | Routes |",
  "| --- | ---: |",
  ...Object.entries(counts.byDomain)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => `| ${name} | ${count} |`),
  "",
  "## Routes",
  "",
  "| Method | Canonical Gateway path | Class | Idempotent | Permission mode | Permissions | Route key |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...routes.map((route) => {
    const permissions =
      route.requiredPermissions.length === 0
        ? "—"
        : route.requiredPermissions.join(
            route.requiredPermissionsMode === "ANY" ? " OR " : " + ",
          );
    return (
      `| ${escapeMarkdown(route.method)} | ` +
      `\`${escapeMarkdown(route.canonicalPath)}\` | ` +
      `${escapeMarkdown(route.routeClass)} | ` +
      `${route.idempotent ? "yes" : "no"} | ` +
      `${escapeMarkdown(route.requiredPermissionsMode)} | ` +
      `${escapeMarkdown(permissions)} | ` +
      `\`${escapeMarkdown(route.routeKey)}\` |`
    );
  }),
  "",
].join("\n");

writeFileSync(
  resolve(outputDirectory, "admin-core-api-routes.md"),
  markdown,
  "utf8",
);

process.stdout.write(
  `Generated ${routes.length} Admin Core routes across ` +
    `${Object.keys(counts.byDomain).length} route-key domains.\n`,
);
