// Generates one route-level reference page per owning app from the machine
// inventory produced by generate-route-inventory.mjs.
//
// These pages are the exhaustive method/path index. The hand-written pages
// beside them (crm-leads.md, core-auth.md, ...) carry the semantic contract:
// DTOs, permissions, enums, errors. Both are needed; neither replaces the
// other.
//
// Usage:
//   node scripts/docs/generate-api-reference.mjs
//   node scripts/docs/generate-api-reference.mjs --check

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const inventoryPath = resolve(portalRoot, "docs/generated/tenant-api-routes.json");
const checkOnly = process.argv.includes("--check");

const APPS = {
  core: {
    file: "core-reference.md",
    title: "Core — Route Reference",
    upstream: "core-app",
    semantic: ["core-auth.md", "core-notifications.md"],
  },
  crm: {
    file: "crm-reference.md",
    title: "CRM — Route Reference",
    upstream: "crm-app",
    semantic: [
      "crm-leads.md",
      "crm-customer-profiles.md",
      "crm-opportunities.md",
      "crm-catalogues.md",
    ],
  },
  trade: {
    file: "trade-reference.md",
    title: "Trade — Route Reference",
    upstream: "trade-app",
    semantic: [],
  },
};

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function renderPage(app, config, routes) {
  const generatedAt = inventory.metadata?.generatedAt ?? "unknown";
  const backendRevision = inventory.metadata?.backendRevision ?? "unknown";

  const semanticList = config.semantic.length
    ? config.semantic
        .map((name) => `- [${name}](${name})`)
        .join("\n")
    : "- None yet. This app has no screen in the portal.";

  const rows = routes
    .map((route) => {
      const cells = [
        escapeCell(route.method),
        `\`${escapeCell(route.canonicalPath)}\``,
        `\`${escapeCell(route.routeKey)}\``,
        escapeCell(route.routeClass),
        route.idempotent ? "yes" : "no",
        escapeCell(route.portalUsage),
      ];
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");

  return `# ${config.title}

> **GENERATED FILE — do not edit by hand.**
> Regenerate with \`pnpm docs:api-reference\`.
> Generator: \`scripts/docs/generate-api-reference.mjs\`
> Source: \`docs/generated/tenant-api-routes.json\`

Status: **verified** (Gateway exposure and transport policy only)

Last source verification: **${generatedAt.slice(0, 10)}**

Generated at: **${generatedAt}**

Backend revision: \`${backendRevision}\`

Owning app: **${config.upstream}**

Routes: **${routes.length}**

## What this page is

The exhaustive method-and-path index for every Gateway route owned by
${config.upstream} on the tenant master. It proves Gateway exposure and
transport policy. It does **not** prove DTO fields, permissions, response
shapes or error codes — those live in the hand-written pages:

${semanticList}

Read [README.md](README.md) first for envelopes, pagination, idempotency and
the capabilities contract.

Routes marked \`DO_NOT_CALL\` are tenant-master reachable platform or
integration endpoints, not application feature APIs. Never call them from
browser code.

## Routes

| Method | Canonical path | Route key | Class | Idempotent | Portal usage |
| --- | --- | --- | --- | --- | --- |
${rows}
`;
}

let changed = 0;
for (const [app, config] of Object.entries(APPS)) {
  const routes = (inventory.routes ?? [])
    .filter((route) => route.app === app)
    .sort((a, b) =>
      a.canonicalPath === b.canonicalPath
        ? a.method.localeCompare(b.method)
        : a.canonicalPath.localeCompare(b.canonicalPath),
    );

  const outputPath = resolve(portalRoot, "docs/api", config.file);
  const next = renderPage(app, config, routes);

  let current = null;
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    current = null;
  }

  // Ignore the generated-at line so an unchanged inventory does not report drift.
  const strip = (text) =>
    text === null ? null : text.replace(/^Generated at: .*$/mu, "");

  if (strip(current) !== strip(next)) {
    changed += 1;
    if (checkOnly) continue;
    writeFileSync(outputPath, next, "utf8");
  }
}

if (checkOnly && changed > 0) {
  process.stderr.write(
    `Generated API reference pages are stale (${changed}); run: pnpm docs:api-reference\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    checkOnly
      ? "Generated API reference pages are current.\n"
      : `Wrote ${Object.keys(APPS).length} API reference pages.\n`,
  );
}
