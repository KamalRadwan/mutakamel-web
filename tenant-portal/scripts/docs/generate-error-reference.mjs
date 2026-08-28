// Generates docs/reference/error-codes.md — the error codes the built screens can
// actually receive, with the HTTP status each is thrown with.
//
// Scoped deliberately: the backend contains hundreds of codes, most belonging
// to features with no portal screen. Documenting all of them would produce a
// wall of text that rots. This covers the families the portal builds, which is
// what a build agent needs to map a failure onto a message.
//
// Read-only against ../backend.
//
// Usage:
//   node scripts/docs/generate-error-reference.mjs
//   node scripts/docs/generate-error-reference.mjs --check

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const backendRoot = resolve(portalRoot, "../../backend/mutakamel-apps");
const outputPath = resolve(portalRoot, "docs/reference/error-codes.md");
const checkOnly = process.argv.includes("--check");

const SCOPES = [
  { area: "Leads", dir: "crm-app/src/crm/leads" },
  { area: "Customer profiles", dir: "crm-app/src/crm/customer-profiles" },
  { area: "Opportunities & pipelines", dir: "crm-app/src/crm/opportunities" },
  { area: "Pipelines", dir: "crm-app/src/crm/pipelines" },
  { area: "Lead stages", dir: "crm-app/src/crm/lead-stages" },
  { area: "Acquisition sources", dir: "crm-app/src/crm/acquisition-sources" },
  { area: "Custom fields", dir: "crm-app/src/crm/custom-fields" },
  { area: "CRM settings", dir: "crm-app/src/crm/settings" },
  { area: "Authentication & session", dir: "core-app/src/tenant/tenant-auth" },
  { area: "Notifications", dir: "core-app/src/tenant/notifications" },
];

const EXCEPTION_STATUS = {
  BadRequestException: 400,
  UnauthorizedException: 401,
  ForbiddenException: 403,
  NotFoundException: 404,
  ConflictException: 409,
  UnsupportedMediaTypeException: 415,
  UnprocessableEntityException: 422,
  PayloadTooLargeException: 413,
  TooManyRequestsException: 429,
  InternalServerErrorException: 500,
  ServiceUnavailableException: 503,
};

// Enum wire values and non-error constants that share the SCREAMING_CASE shape.
const NOT_AN_ERROR = new Set([
  "INDIVIDUAL", "CORPORATE", "OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD",
  "NEW", "CONTACTED", "QUALIFYING", "QUALIFIED", "NURTURING", "IN_PROGRESS",
  "WON", "LOST", "PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED",
  "POSITIVE", "NEGATIVE", "DISCOVERY", "QUALIFICATION", "PROPOSAL",
  "NEGOTIATION", "CONTRACTING", "ASC", "DESC", "LEAD", "CUSTOMER_PROFILE",
  "PARTY", "OPPORTUNITY", "TEXT", "TEXTAREA", "NUMBER", "DATE", "DATETIME",
  "BOOLEAN", "SELECT", "MULTI_SELECT", "URL", "EMAIL", "PHONE", "CREATE",
  "UPDATE", "CONVERT", "ALL", "RESTRICTED", "ACTIVE", "CUSTOMER", "MOBILE",
  "WHATSAPP", "WEBSITE", "OTHER", "CONTACT_PERSON", "WEB", "IOS", "ANDROID",
  "DESKTOP", "CALL", "MEETING", "VISIT", "NOTE", "FOLLOW_UP", "INBOUND",
  "OUTBOUND", "INTERNAL", "DONE", "CANCELLED", "PENDING", "SENT", "LOW",
  "MEDIUM", "HIGH", "URGENT", "TASK", "CALENDAR_EVENT", "IN_APP", "SMS",
]);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") ? [full] : [];
  });
}

const byArea = [];
let total = 0;

for (const { area, dir } of SCOPES) {
  const files = walk(resolve(backendRoot, dir));
  const codes = new Map(); // code -> Set(status)

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // throw new XException( ... 'CODE' ... ) — scan the call's argument span.
    const re = /throw new ([A-Za-z]+Exception)\(/gu;
    let m;
    while ((m = re.exec(text)) !== null) {
      const status = EXCEPTION_STATUS[m[1]];
      if (!status) continue;
      // Balance parens from the opening to capture the whole argument list.
      let depth = 1;
      let i = re.lastIndex;
      while (i < text.length && depth > 0) {
        if (text[i] === "(") depth += 1;
        else if (text[i] === ")") depth -= 1;
        i += 1;
      }
      const args = text.slice(re.lastIndex, i - 1);
      for (const c of args.matchAll(/['"]([A-Z][A-Z0-9_]{4,})['"]/gu)) {
        const code = c[1];
        if (NOT_AN_ERROR.has(code)) continue;
        if (!codes.has(code)) codes.set(code, new Set());
        codes.get(code).add(status);
      }
    }
  }

  if (codes.size === 0) continue;
  total += codes.size;
  byArea.push({ area, dir, codes: [...codes.entries()].sort((a, b) => a[0].localeCompare(b[0])) });
}

const sections = byArea
  .map(({ area, dir, codes }) => {
    const rows = codes
      .map(([code, statuses]) => `| \`${code}\` | ${[...statuses].sort().join(", ")} |`)
      .join("\n");
    return `## ${area}\n\nSource: \`../backend/mutakamel-apps/${dir}\` · ${codes.length} codes\n\n| Error code | HTTP |\n| --- | --- |\n${rows}\n`;
  })
  .join("\n");

const page = `# Error Code Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with \`pnpm docs:errors\`.
> Generator: \`scripts/docs/generate-error-reference.mjs\`

Status: **verified** (parsed from \`throw new *Exception\` sites)

Last source verification: **${new Date().toISOString().slice(0, 10)}**

Codes: **${total}** across **${byArea.length}** areas

## Scope

These are the error codes the **built screens** can receive. The backend
defines many more, belonging to features with no portal screen; listing those
would produce documentation that rots before anyone reads it.

Add an area to \`SCOPES\` in the generator when a new screen ships.

## How to use this

- **Branch on the code, never on the message.** Messages are localized by
  request language and are not a stable contract. See
  [errors.md](errors.md).
- **An unknown code is not a crash.** Fall back to a generic message keyed by
  HTTP status. A backend adding a code must never break a screen.
- Every code the UI handles specifically needs a \`t.errors.*\` entry in **both**
  dictionaries. Codes with no entry fall back to the status-level message.
- A code appearing with **two statuses** is thrown from more than one site with
  different semantics — read the service before treating it as one condition.

${sections}`;

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : null;
  const strip = (t) => (t === null ? null : t.replace(/^Last source verification: .*$/mu, ""));
  if (strip(current) !== strip(page)) {
    process.stderr.write("Error reference is stale; run: pnpm docs:errors\n");
    process.exit(1);
  }
  process.stdout.write("Error reference is current.\n");
} else {
  writeFileSync(outputPath, page, "utf8");
  process.stdout.write(
    `Wrote docs/reference/error-codes.md — ${total} codes across ${byArea.length} areas.\n`,
  );
}
