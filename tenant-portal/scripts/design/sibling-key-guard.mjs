// Sibling key guard. Hard-fails when two sibling JSX elements can carry the
// SAME key.
//
// The shape this exists for is the page-bottom dialog stack. Each dialog is
// keyed so it remounts clean instead of reopening on the last edit, and the
// idle branch of that key is a constant:
//
//   <CreateLeadsModal   key={isCreateOpen ? "open" : "closed"} />
//   <LeadActivityDialog key={activityLead?.id ?? "closed"} />
//
// Both are children of one parent, and with nothing open both read "closed".
// React warns — "Encountered two children with the same key" — and is entitled
// to treat the pair as one child, so one dialog can be dropped or duplicated.
// The fix is a namespace per dialog (`create-closed`, `activity-…`), which
// changes nothing about WHEN each key changes. This had to be found four times
// by hand across the CRM pages before it was worth a gate.
//
// The guard proves collisions rather than guessing at them. It walks the TSX
// with the TypeScript parser and, for every `key`, works out the set of
// constant strings that key can actually take:
//
//   key="a"                            -> {"a"}
//   key={c ? "a" : "b"}                -> {"a", "b"}
//   key={maybe ?? "closed"}            -> {"closed"}   (the id side is unknown)
//   key={`activity-${x ?? "closed"}`}  -> {"activity-closed"}
//
// Anything it cannot evaluate contributes nothing, so an unknown key never
// trips the gate. Two siblings fail only when their sets intersect — a value
// both can hold at the same moment.
//
// Mutually exclusive children are not siblings: `{c ? <A/> : <B/>}` renders one
// child, so its two branches are compared against the REST of the stack but
// never against each other.
//
// Usage: node scripts/design/sibling-key-guard.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(scriptDirectory, "../..");
const srcRoot = resolve(portalRoot, "src");

const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "coverage"]);

// A template with several unknown-but-bounded spans multiplies out. The cap is
// a safety valve, not a rule: past it the key is treated as unevaluable, which
// is the silent-and-safe direction.
const MAX_TEMPLATE_COMBINATIONS = 32;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIR_NAMES.has(entry.name) ? [] : walk(full);
    }
    return extname(entry.name) === ".tsx" ? [full] : [];
  });
}

/**
 * The constant strings `expression` can evaluate to. An empty set means "not
 * evaluable" — the guard then has nothing to prove and stays quiet.
 */
function constantValuesOf(expression) {
  if (!expression) return new Set();

  if (ts.isParenthesizedExpression(expression)) {
    return constantValuesOf(expression.expression);
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return new Set([expression.text]);
  }
  if (ts.isConditionalExpression(expression)) {
    return new Set([
      ...constantValuesOf(expression.whenTrue),
      ...constantValuesOf(expression.whenFalse),
    ]);
  }
  // `??` and `||` pick one side at runtime, so both sides are reachable. The
  // unknown side contributes nothing, which is exactly how `id ?? "closed"`
  // reduces to the fallback alone.
  if (
    ts.isBinaryExpression(expression) &&
    (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return new Set([
      ...constantValuesOf(expression.left),
      ...constantValuesOf(expression.right),
    ]);
  }
  if (ts.isTemplateExpression(expression)) {
    let combinations = [expression.head.text];
    for (const span of expression.templateSpans) {
      const spanValues = [...constantValuesOf(span.expression)];
      // One unevaluable span makes the whole template unevaluable: a partial
      // string would compare against nothing truthfully.
      if (spanValues.length === 0) return new Set();
      if (combinations.length * spanValues.length > MAX_TEMPLATE_COMBINATIONS) return new Set();
      combinations = combinations.flatMap((prefix) =>
        spanValues.map((value) => prefix + value + span.literal.text),
      );
    }
    return new Set(combinations);
  }
  return new Set();
}

/** The `key` attribute's possible values, or null when the element has no key. */
function keyValuesOf(element) {
  const attributes = ts.isJsxElement(element) ? element.openingElement.attributes : element.attributes;
  for (const attribute of attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || attribute.name.getText() !== "key") continue;
    const initializer = attribute.initializer;
    if (!initializer) return new Set();
    if (ts.isStringLiteral(initializer)) return new Set([initializer.text]);
    if (ts.isJsxExpression(initializer)) return constantValuesOf(initializer.expression);
    return new Set();
  }
  return null;
}

/**
 * The elements one child position can render. A ternary or a `||` yields
 * several, and they are mutually exclusive — hence one group per position.
 */
function elementsInPosition(expression) {
  if (!expression) return [];
  if (ts.isParenthesizedExpression(expression)) return elementsInPosition(expression.expression);
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) return [expression];
  if (ts.isJsxFragment(expression)) return [];
  if (ts.isConditionalExpression(expression)) {
    return [...elementsInPosition(expression.whenTrue), ...elementsInPosition(expression.whenFalse)];
  }
  if (ts.isBinaryExpression(expression)) {
    const kind = expression.operatorToken.kind;
    // `cond && <El/>` renders the right side only. `a || <El/>` and
    // `a ?? <El/>` can render either.
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken) return elementsInPosition(expression.right);
    if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
      return [...elementsInPosition(expression.left), ...elementsInPosition(expression.right)];
    }
  }
  // A `.map()` and anything else dynamic is out of scope: its keys are per-row
  // and a static reading of them proves nothing.
  return [];
}

function tagNameOf(element) {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  return opening.tagName.getText();
}

/**
 * Every provable duplicate key among siblings in one file. Exported for the
 * guard's own test.
 */
export function findSiblingKeyCollisions(text, fileName = "page.tsx") {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const collisions = [];

  function checkChildren(children) {
    // One group per child position; slots inside a group are alternatives to
    // each other, so only cross-group pairs are compared.
    const groups = [];
    for (const child of children) {
      const elements =
        ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)
          ? [child]
          : ts.isJsxExpression(child)
            ? elementsInPosition(child.expression)
            : [];
      const slots = [];
      for (const element of elements) {
        const values = keyValuesOf(element);
        if (values === null || values.size === 0) continue;
        slots.push({
          tag: tagNameOf(element),
          line: source.getLineAndCharacterOfPosition(element.getStart(source)).line + 1,
          values,
        });
      }
      if (slots.length > 0) groups.push(slots);
    }

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        for (const left of groups[i]) {
          for (const right of groups[j]) {
            const shared = [...left.values].filter((value) => right.values.has(value));
            if (shared.length > 0) collisions.push({ left, right, shared });
          }
        }
      }
    }
  }

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) checkChildren(node.children);
    ts.forEachChild(node, visit);
  }
  visit(source);

  return collisions;
}

// The CLI. Importing this file — the test does — runs nothing.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const files = existsSync(srcRoot) ? walk(srcRoot) : [];
  const failures = [];

  for (const filePath of files) {
    const relativePath = relative(portalRoot, filePath).replaceAll("\\", "/");
    for (const collision of findSiblingKeyCollisions(readFileSync(filePath, "utf8"), relativePath)) {
      failures.push({ file: relativePath, ...collision });
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`Sibling key guard failed: ${failures.length} duplicate key(s).\n\n`);
    for (const failure of failures) {
      const shared = failure.shared.map((value) => JSON.stringify(value)).join(", ");
      process.stderr.write(
        `  ${failure.file}:${failure.left.line} <${failure.left.tag}> and ` +
          `:${failure.right.line} <${failure.right.tag}> share ${shared}\n`,
      );
    }
    process.stderr.write(
      "\nGive each sibling its own namespace, so the key still changes at the same\n" +
        "moments but can never equal a sibling's.\n" +
        "See docs/design/enforcement.md#sibling-key-guardmjs\n",
    );
    process.exit(1);
  }

  process.stdout.write(`Sibling key guard clean across ${files.length} files.\n`);
}
