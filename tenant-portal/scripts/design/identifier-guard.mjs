// Identifier guard. Hard-fails on a machine identifier that is not
// bidi-isolated, and on `break-all`.
//
// This app's chrome is Arabic, so the paragraph direction is RTL. A bare Latin
// identifier inside it is reordered by the Unicode bidirectional algorithm:
// leading and trailing digits and punctuation migrate to the wrong end, so the
// id a user READS is not the id the system holds. A UUID, a correlation id or
// an idempotency key that renders wrong is a correctness bug — it is copied
// into support tickets and typed back into forms.
//
// The rule: every element carrying `font-mono` must be `<bdi>` (which
// `IdentifierText` renders) or must set `dir` itself. Two exemptions, both
// principled rather than convenient:
//
//   * `tabular-nums` alongside `font-mono` marks a NUMERIC column — a figure
//     aligned column-wise, not an identifier. Numbers are already formatted
//     through `Intl` with an explicit locale.
//   * The named list below. Every entry is a file another session owns this
//     cycle, not a category we have decided to tolerate. A named floor is
//     honest; a silent exclusion is not — docs/design/enforcement.md.
//
// `break-all` is banned outright: it is `word-break: break-all`, which
// hyphenates ordinary Arabic and English prose mid-syllable. The rule for an
// unbreakable token is `wrap-anywhere` (`overflow-wrap: anywhere`), which
// `identifierText` in src/design-system/lib/variants.ts already carries.
//
// Usage: node scripts/design/identifier-guard.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);

// Files owned by another session while U7–U17 landed. Each is a real
// violation, deliberately left rather than edited across a session boundary.
// Delete an entry the moment its owner lands — the guard then covers it.
const BARE_IDENTIFIER_EXEMPT = new Set([
  "src/app/(tenant)/crm/custom-fields/page.tsx",
  "src/app/(tenant)/crm/customer-profiles/components/CustomerProfileCard.tsx",
  "src/app/(tenant)/crm/opportunities/components/useOpportunityColumns.tsx",
  "src/app/login/page.tsx",
  "src/app/tenant/components/ActionTokenScreen.tsx",
  "src/design-system/shell/NotificationsDropdown.tsx",
]);

// Same reasoning: these three already set `dir`, so they are bidi-correct.
// Only the wrapping utility is wrong, and their owners hold the files.
const BREAK_ALL_EXEMPT = new Set([
  "src/app/(tenant)/crm/customer-profiles/[id]/components/CustomerProfileFacts.tsx",
  "src/app/(tenant)/crm/leads/[id]/components/LeadIdentityCards.tsx",
  "src/app/(tenant)/crm/opportunities/[id]/components/OpportunityFacts.tsx",
]);

// The guard's own prose, and the tests that pin the rule, name the banned
// strings on purpose. Neither is markup.
const SELF_DESCRIBING = new Set([
  "scripts/design/identifier-guard.mjs",
  "src/design-system/lib/variants.ts",
  "src/design-system/primitives/IdentifierText.tsx",
  // Asserts `not.toHaveClass("break-all")`. The rule's own test cannot state
  // the rule without naming what it forbids.
  "src/design-system/primitives/IdentifierText.test.tsx",
  "src/design-system/feedback/AppToast.tsx",
  "src/design-system/patterns/ambiguous-outcome/AmbiguousOutcomePanel.test.tsx",
]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIR_NAMES.has(entry.name) ? [] : walk(full);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [full] : [];
  });
}

/**
 * The JSX opening tag that encloses `index`, or null when `index` is in text
 * or a comment rather than inside a tag. Brace- and quote-aware, so a
 * `className={cn("a", x && "b")}` does not end the tag at its first `>`.
 */
function enclosingTag(text, index) {
  let start = -1;
  for (let i = index; i >= 0; i--) {
    if (text[i] === "<") { start = i; break; }
    if (text[i] === ">") return null;
  }
  if (start === -1) return null;
  const name = /^<\/?([A-Za-z][\w.:-]*)/.exec(text.slice(start, start + 60));
  if (!name) return null;

  let depth = 0;
  let quote = null;
  let i = start + 1;
  for (; i < text.length; i++) {
    const character = text[i];
    if (quote) {
      if (character === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") { quote = character; continue; }
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (character === ">" && depth === 0) break;
  }
  if (i >= text.length || index > i) return null;
  return { name: name[1], text: text.slice(start, i + 1) };
}

const files = existsSync(srcRoot) ? walk(srcRoot) : [];
const bare = [];
const breakAll = [];

for (const filePath of files) {
  const relativePath = relative(portalRoot, filePath).replaceAll("\\", "/");
  if (SELF_DESCRIBING.has(relativePath)) continue;
  const text = readFileSync(filePath, "utf8");
  const lineOf = (index) => text.slice(0, index).split("\n").length;

  if (!BREAK_ALL_EXEMPT.has(relativePath)) {
    for (const match of text.matchAll(/\bbreak-all\b/g)) {
      breakAll.push({ file: relativePath, line: lineOf(match.index) });
    }
  }

  if (BARE_IDENTIFIER_EXEMPT.has(relativePath)) continue;
  for (const match of text.matchAll(/\bfont-mono\b/g)) {
    const tag = enclosingTag(text, match.index);
    if (!tag) continue;
    if (tag.name === "bdi" || tag.name === "IdentifierText") continue;
    if (/\bdir\s*=/.test(tag.text)) continue;
    if (/\btabular-nums\b/.test(tag.text)) continue;
    bare.push({ file: relativePath, line: lineOf(match.index), tag: tag.name });
  }
}

const failures = bare.length + breakAll.length;
if (failures > 0) {
  process.stderr.write(`Identifier guard failed: ${failures} violations.\n\n`);
  if (bare.length > 0) {
    process.stderr.write(
      `  ${bare.length} bare monospace identifier(s) — wrap in <IdentifierText>, or set dir if it is a control:\n`,
    );
    for (const item of bare.slice(0, 60)) {
      process.stderr.write(`    ${item.file}:${item.line}  <${item.tag}>\n`);
    }
    if (bare.length > 60) process.stderr.write(`    ... and ${bare.length - 60} more\n`);
  }
  if (breakAll.length > 0) {
    process.stderr.write(`\n  ${breakAll.length} break-all — use wrap-anywhere:\n`);
    for (const item of breakAll) {
      process.stderr.write(`    ${item.file}:${item.line}\n`);
    }
  }
  process.stderr.write("\nSee docs/design/accessibility.md#bidirectional-text\n");
  process.exit(1);
}

process.stdout.write(
  `Identifier guard clean across ${files.length} files ` +
    `(${BARE_IDENTIFIER_EXEMPT.size + BREAK_ALL_EXEMPT.size} named exemptions).\n`,
);
