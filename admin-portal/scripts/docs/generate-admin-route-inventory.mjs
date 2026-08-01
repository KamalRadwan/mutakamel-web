import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes("--check");
const portalRoot = resolve(scriptDirectory, "../..");
const frontendRoot = resolve(portalRoot, "..");
const backendRepository = resolve(frontendRoot, "../backend");
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

function unwrapExpression(node) {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function propertyName(node) {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  throw new Error(`Unsupported property name: ${node.getText()}`);
}

function evaluateExpression(input) {
  const node = unwrapExpression(input);

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(evaluateExpression);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Unsupported object member: ${property.getText()}`);
      }
      value[propertyName(property.name)] = evaluateExpression(
        property.initializer,
      );
    }
    return value;
  }

  throw new Error(`Unsupported route expression: ${node.getText()}`);
}

function extractRoutes(filePath) {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "CORE_ROUTE_CONTRACTS" &&
        declaration.initializer
      ) {
        const value = evaluateExpression(declaration.initializer);
        if (!Array.isArray(value)) {
          throw new Error("CORE_ROUTE_CONTRACTS is not an array");
        }
        return value;
      }
    }
  }

  throw new Error(`CORE_ROUTE_CONTRACTS was not found in ${filePath}`);
}

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

const routes = extractRoutes(sourcePath)
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

if (counts.total !== 243) {
  throw new Error(
    `Expected the verified Admin baseline of 243 routes, found ${counts.total}. ` +
      "Re-audit the documentation contract before accepting this drift.",
  );
}

const sourceHashes = {
  [relative(frontendRoot, sourcePath).replaceAll("\\", "/")]:
    sourceHash(sourcePath),
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
