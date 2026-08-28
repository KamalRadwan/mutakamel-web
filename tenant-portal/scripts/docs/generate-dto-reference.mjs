// Generates docs/reference/dto-fields.md — the exact request-body field shapes for
// every DTO the built screens submit.
//
// Hand-transcribing 1,500+ lines of class-validator decorators is both
// error-prone and guaranteed to rot. This parses the DTO source directly, so
// the field tables are correct by construction and regenerable when the
// backend changes.
//
// Read-only against ../backend. Never writes there.
//
// Usage:
//   node scripts/docs/generate-dto-reference.mjs
//   node scripts/docs/generate-dto-reference.mjs --check

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const backendRoot = resolve(portalRoot, "../../backend/mutakamel-apps");
const outputPath = resolve(portalRoot, "docs/reference/dto-fields.md");
const checkOnly = process.argv.includes("--check");

// Only the DTOs the built screens actually submit. Adding a screen means
// adding its DTO file here.
const SOURCES = [
  { screen: "Leads", file: "crm-app/src/crm/leads/dto/lead.dto.ts" },
  { screen: "Customer profiles", file: "crm-app/src/crm/customer-profiles/dto/customer-profile.dto.ts" },
  { screen: "Opportunities", file: "crm-app/src/crm/opportunities/dto/opportunity.dto.ts" },
  { screen: "Opportunity board", file: "crm-app/src/crm/opportunities/dto/opportunity-board.dto.ts" },
  { screen: "Lead stages", file: "crm-app/src/crm/lead-stages/dto/lead-stage.dto.ts" },
  { screen: "Acquisition sources", file: "crm-app/src/crm/acquisition-sources/dto/acquisition-source.dto.ts" },
  { screen: "Custom fields", file: "crm-app/src/crm/custom-fields/dto/custom-field.dto.ts" },
  { screen: "CRM settings", file: "crm-app/src/crm/settings/dto/update-crm-settings.dto.ts" },
  { screen: "Shared list queries", file: "crm-app/src/crm/common/dto/crm-list-query.dto.ts" },
];

/* ---------------- decorator -> human constraint ---------------- */

function describeDecorators(decorators) {
  const rules = [];
  let optional = false;
  let type = null;

  for (const d of decorators) {
    const name = d.name;
    const arg = d.args.trim();

    switch (name) {
      case "IsOptional": optional = true; break;
      case "IsString": type ??= "string"; break;
      case "IsBoolean": type ??= "boolean"; break;
      case "IsInt": type ??= "integer"; break;
      case "IsNumber": type ??= "number"; break;
      case "IsObject": type ??= "object"; break;
      case "IsArray": type ??= "array"; break;
      case "IsEmail": type = "email"; break;
      case "IsDateString": type = "ISO date string"; break;
      case "IsUUID":
        type = arg.includes("7") ? "UUIDv7" : "UUID";
        break;
      case "IsEnum":
        type = `enum ${arg.replace(/[()'"]/gu, "")}`;
        break;
      case "IsIn": {
        const values = [...arg.matchAll(/'([^']+)'/gu)].map((m) => m[1]);
        type = values.length ? values.map((v) => `\`${v}\``).join(" \\| ") : "one of a fixed set";
        break;
      }
      case "IsNotEmpty": rules.push("non-empty"); break;
      // Strip a trailing options object (e.g. `255, { each: true }`) and note
      // per-item application separately — it changes what the rule means.
      case "MaxLength": {
        const each = /each:\s*true/u.test(arg);
        const n = arg.split(",")[0].trim();
        rules.push(each ? `each item max ${n}` : `max ${n}`);
        break;
      }
      case "MinLength": {
        const n = arg.split(",")[0].trim();
        rules.push(`min ${n}`);
        break;
      }
      case "Length": rules.push(`length ${arg.replace(/\s*,\s*/u, "–")}`); break;
      case "Min": rules.push(`>= ${arg}`); break;
      case "Max": rules.push(`<= ${arg}`); break;
      case "ArrayMaxSize": rules.push(`max ${arg} items`); break;
      case "ArrayMinSize": rules.push(`min ${arg} items`); break;
      case "ValidateNested": rules.push("nested"); break;
      case "Type": {
        const m = arg.match(/=>\s*([A-Za-z0-9_]+)/u);
        if (m) rules.push(`of \`${m[1]}\``);
        break;
      }
      case "Transform": rules.push("transformed"); break;
      default: break;
    }
  }
  return { optional, type, rules };
}

/* ---------------- parse a DTO file ---------------- */

function parseFile(text) {
  const classes = [];
  const classRe = /export\s+class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?\s*\{/gu;

  let match;
  while ((match = classRe.exec(text)) !== null) {
    const [, name, parent] = match;

    // Balance braces from the class opening to find its body.
    let depth = 1;
    let i = classRe.lastIndex;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth += 1;
      else if (text[i] === "}") depth -= 1;
      i += 1;
    }
    const body = text.slice(classRe.lastIndex, i - 1);

    const fields = [];
    // A property is a run of decorators followed by `name!: type` / `name?: type`
    const propRe =
      /((?:^\s*@[A-Za-z0-9_]+\([\s\S]*?\)\s*$\n?)*)^\s*([A-Za-z0-9_]+)(!|\?)?\s*:\s*([^;=\n]+)/gmu;
    let p;
    while ((p = propRe.exec(body)) !== null) {
      const [, decoratorBlock, fieldName, marker, tsType] = p;
      if (!decoratorBlock || decoratorBlock.trim() === "") continue;

      const decorators = [
        ...decoratorBlock.matchAll(/@([A-Za-z0-9_]+)\(([\s\S]*?)\)\s*$/gmu),
      ].map((d) => ({ name: d[1], args: d[2] ?? "" }));
      if (decorators.length === 0) continue;

      const { optional, type, rules } = describeDecorators(decorators);
      fields.push({
        name: fieldName,
        required: marker === "!" && !optional,
        type: type ?? tsType.trim().replace(/\|/gu, "\\|"),
        rules,
      });
    }

    if (fields.length > 0) classes.push({ name, parent, fields });
  }
  return classes;
}

/* ---------------- render ---------------- */

const sections = [];
let totalClasses = 0;
let totalFields = 0;

for (const { screen, file } of SOURCES) {
  const full = resolve(backendRoot, file);
  if (!existsSync(full)) {
    sections.push(`## ${screen}\n\n> Source not found: \`../backend/mutakamel-apps/${file}\`\n`);
    continue;
  }
  const classes = parseFile(readFileSync(full, "utf8"));
  totalClasses += classes.length;

  const blocks = classes.map((cls) => {
    totalFields += cls.fields.length;
    const rows = cls.fields
      .map((f) => {
        const req = f.required ? "**yes**" : "no";
        const rules = f.rules.length ? f.rules.join(", ") : "—";
        return `| \`${f.name}\` | ${f.type} | ${req} | ${rules} |`;
      })
      .join("\n");
    const ext = cls.parent ? ` — extends \`${cls.parent}\`` : "";
    return `### \`${cls.name}\`${ext}\n\n| Field | Type | Required | Constraints |\n| --- | --- | --- | --- |\n${rows}\n`;
  });

  sections.push(
    `## ${screen}\n\nSource: \`../backend/mutakamel-apps/${file}\`\n\n${blocks.join("\n")}`,
  );
}

const page = `# DTO Field Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with \`pnpm docs:dto\`.
> Generator: \`scripts/docs/generate-dto-reference.mjs\`

Status: **verified** (parsed from controller DTO source)

Last source verification: **${new Date().toISOString().slice(0, 10)}**

Classes: **${totalClasses}** · Fields: **${totalFields}**

## How to read this

Every table is the exact request-body contract for one DTO, parsed from its
\`class-validator\` decorators.

Rules that apply to **every** DTO here:

- **\`forbidNonWhitelisted: true\`** — an undocumented key is a **422**, not a
  silent ignore. Send only fields listed below.
- **\`stopAtFirstError: false\`** — expect *multiple* field errors, and map all
  of them onto their \`Field\` components.
- Enum values are **case-sensitive**. See
  [enums.md](enums.md).
- \`UUIDv7\` means \`@IsUUID('7')\` — a v4 UUID is rejected. Never send a
  placeholder id.
- Decimal values are **strings**. Never \`Number()\` them.
- "Required" reflects the absence of \`@IsOptional()\`. A field can be required
  by the DTO and still be conditionally required by service logic — the API
  page notes those cases.

**This file lists request shapes only.** For routes, permissions, responses and
errors see the domain pages in [../api/README.md](../api/README.md).

${sections.join("\n")}`;

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : null;
  const strip = (t) => (t === null ? null : t.replace(/^Last source verification: .*$/mu, ""));
  if (strip(current) !== strip(page)) {
    process.stderr.write("DTO reference is stale; run: pnpm docs:dto\n");
    process.exit(1);
  }
  process.stdout.write("DTO reference is current.\n");
} else {
  writeFileSync(outputPath, page, "utf8");
  process.stdout.write(
    `Wrote docs/reference/dto-fields.md — ${totalClasses} classes, ${totalFields} fields.\n`,
  );
}
