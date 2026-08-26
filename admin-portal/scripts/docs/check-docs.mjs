import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const docsRoot = resolve(portalRoot, "docs");
const failures = [];

function walk(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    })
    .sort();
}

function normalizeLinkTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().split(/\s+(?=["'])/u, 1)[0];
  const withoutAngles =
    withoutTitle.startsWith("<") && withoutTitle.endsWith(">")
      ? withoutTitle.slice(1, -1)
      : withoutTitle;
  return decodeURIComponent(withoutAngles.split("#", 1)[0]);
}

const requiredFiles = [
  "DOCUMENTATION_CONTRACT.md",
  "api/README.md",
  "ai/START_HERE.md",
  "ai/SOURCE_OF_TRUTH.md",
  "ai/PROJECT_INDEX.md",
  "ai/KNOWN_GAPS.md",
  "ai/IMPLEMENTATION_PLAYBOOK.md",
  "ai/TEST_MATRIX.md",
  "architecture/http-and-error-contract.md",
  "architecture/permissions-idempotency-and-state.md",
  "audit/frontend-capability-matrix.md",
  "audit/documentation-coverage.md",
  "generated/admin-core-api-routes.json",
  "generated/admin-core-api-routes.md",
  "design-system/README.md",
  "design-system/tokens.md",
  "design-system/typography.md",
  "design-system/geometry-and-density.md",
  "design-system/primitives.md",
  "design-system/patterns.md",
  "design-system/shell-and-navigation.md",
  "design-system/theming-and-direction.md",
  "design-system/toast-contract.md",
  "design-system/migration.md",
];
for (const requiredFile of requiredFiles) {
  if (!existsSync(resolve(docsRoot, requiredFile))) {
    failures.push(`docs/${requiredFile}: required rebuilt document is missing`);
  }
}

const markdownFiles = walk(docsRoot).filter(
  (path) => extname(path).toLowerCase() === ".md",
);
for (const filePath of markdownFiles) {
  const content = readFileSync(filePath, "utf8");
  const displayPath = relative(portalRoot, filePath).replaceAll("\\", "/");
  const linkScanContent = content
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/`[^`\n]*`/gu, "");

  const linkPattern = /!?\[[^\]]*\]\(([^)\n]+)\)/gu;
  for (const match of linkScanContent.matchAll(linkPattern)) {
    const rawTarget = match[1];
    if (rawTarget.toLowerCase().startsWith("file:")) {
      failures.push(`${displayPath}: contains a forbidden local file link`);
      continue;
    }
    if (
      rawTarget.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)
    ) {
      continue;
    }
    const target = normalizeLinkTarget(rawTarget);
    if (!target) continue;
    if (!existsSync(resolve(dirname(filePath), target))) {
      failures.push(`${displayPath}: broken local link ${rawTarget}`);
    }
  }
}

const inventoryPath = resolve(
  docsRoot,
  "generated/admin-core-api-routes.json",
);
if (existsSync(inventoryPath)) {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));

  const uniqueAddresses = new Set(
    (inventory.routes ?? []).map(
      (route) => `${route.method} ${route.canonicalPath}`,
    ),
  );
  if (uniqueAddresses.size !== inventory.routes?.length) {
    failures.push(
      "docs/generated/admin-core-api-routes.json: duplicate method/path address",
    );
  }
  if (
    (inventory.routes ?? []).some(
      (route) => !route.canonicalPath.startsWith("/api/admin/core/v1/"),
    )
  ) {
    failures.push(
      "docs/generated/admin-core-api-routes.json: non-canonical Admin browser path",
    );
  }
}

const joinedHandWrittenDocs = markdownFiles
  .filter((path) => !path.includes(`${resolve(docsRoot, "generated")}`))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
for (const forbiddenClaim of [
  "GET /api/admin/core/v1/tenants/:id/fqdns",
  "POST /api/admin/core/v1/tenants/:id/subscription/cancel",
  "POST /api/admin/core/v1/tenants/:id/wallet/credit",
  "POST /api/admin/core/v1/tenants/:id/wallet/debit",
]) {
  if (joinedHandWrittenDocs.includes(forbiddenClaim)) {
    failures.push(`docs: contains known nonexistent route ${forbiddenClaim}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Documentation checks failed (${failures.length}):\n`);
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Documentation checks passed for ${markdownFiles.length} Markdown files.\n`,
  );
}
