import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path) ? [path] : [];
  });
}

// Parsing the whole source tree takes several seconds under a parallel suite.
it("keeps dictionary values behind async imports throughout the source tree", () => {
  const violations: string[] = [];
  for (const path of files(sourceRoot)) {
    if (path.includes(join("i18n", "dictionaries"))) continue;
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const target = specifier.startsWith("@/")
        ? resolve(sourceRoot, specifier.slice(2)) : resolve(dirname(path), specifier);
      if (!["ar", "en"].some((language) => target === join(sourceRoot, "i18n", "dictionaries", language))) continue;
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.every((element) => element.isTypeOnly)) continue;
      violations.push(`${path}: ${statement.getText(source)}`);
    }
  }
  expect(violations).toEqual([]);
}, 60_000);
