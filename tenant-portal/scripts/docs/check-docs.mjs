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

const markdownFiles = walk(docsRoot).filter(
  (path) => extname(path).toLowerCase() === ".md",
);

for (const filePath of markdownFiles) {
  const content = readFileSync(filePath, "utf8");
  const displayPath = filePath.slice(portalRoot.length + 1).replaceAll("\\", "/");

  if (/C:[/\\]mutakamel\.ai[/\\]backend/iu.test(content)) {
    failures.push(
      `${displayPath}: backend evidence must use a ../backend/... relative path`,
    );
  }

  const linkPattern = /!?\[[^\]]*\]\(([^)\n]+)\)/gu;
  for (const match of content.matchAll(linkPattern)) {
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
    const resolvedTarget = resolve(dirname(filePath), target);
    if (!existsSync(resolvedTarget)) {
      failures.push(`${displayPath}: broken local link ${rawTarget}`);
    }
  }

  const apiRoot = resolve(docsRoot, "api");
  const apiRelative = relative(apiRoot, filePath).replaceAll("\\", "/");
  const isApiPage =
    !apiRelative.startsWith("../") &&
    apiRelative !== ".." &&
    !apiRelative.endsWith("README.md");

  if (isApiPage) {
    if (!/(?:Contract status|Status):[^\n]+/iu.test(content)) {
      failures.push(`${displayPath}: API page is missing Status metadata`);
    }
    if (
      !/(?:Last (?:source )?verifi(?:ed|cation)|Verification date):[^\n]*\d{4}-\d{2}-\d{2}/iu.test(
        content,
      )
    ) {
      failures.push(
        `${displayPath}: API page is missing source-verification date`,
      );
    }
    if (!content.includes("/api/tenant/")) {
      failures.push(
        `${displayPath}: API page has no canonical tenant Gateway path`,
      );
    }
  }
}

const inventoryPath = resolve(
  docsRoot,
  "generated/tenant-api-routes.json",
);
if (!existsSync(inventoryPath)) {
  failures.push(
    "docs/generated/tenant-api-routes.json: missing; run npm run docs:routes",
  );
} else {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const routeCount = inventory.routes?.length ?? 0;
  if (routeCount === 0 || routeCount !== inventory.counts?.total) {
    failures.push(
      "docs/generated/tenant-api-routes.json: route count is empty or inconsistent",
    );
  }
  for (const app of ["core", "crm", "trade"]) {
    if (!inventory.counts?.byApp?.[app]) {
      failures.push(
        `docs/generated/tenant-api-routes.json: no ${app} tenant routes`,
      );
    }
  }

  const apiLines = markdownFiles
    .filter((filePath) => {
      const apiRelative = relative(
        resolve(docsRoot, "api"),
        filePath,
      ).replaceAll("\\", "/");
      return !apiRelative.startsWith("../") && apiRelative !== "..";
    })
    .flatMap((filePath) =>
      readFileSync(filePath, "utf8")
        .split(/\r?\n/u)
        .map((line) => ({
          filePath,
          line,
        })),
    );

  const undocumentedRoutes = [];
  for (const route of inventory.routes ?? []) {
    const methodPattern = new RegExp(`\\b${route.method}\\b`, "u");
    const documented = apiLines.some(
      ({ line }) =>
        line.includes(route.canonicalPath) && methodPattern.test(line),
    );
    if (!documented) {
      undocumentedRoutes.push(
        `${route.method} ${route.canonicalPath} (${route.routeKey})`,
      );
    }
  }
  if (undocumentedRoutes.length > 0) {
    failures.push(
      `docs/api: ${undocumentedRoutes.length} Gateway routes are absent from hand-written API pages:\n    ${undocumentedRoutes.join("\n    ")}`,
    );
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
