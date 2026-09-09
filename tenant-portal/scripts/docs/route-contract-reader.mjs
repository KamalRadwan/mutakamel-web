import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import ts from "typescript";

/** Restricted AST interpretation, never import/execute the backend or its dependencies. */
export function readRouteContracts(filePath, exportName) {
  const root = dirname(resolve(filePath));
  const files = new Map();
  const active = new Set();
  let budget = 500_000;
  const fail = (node) => { throw new Error(`Unsupported route-contract expression: ${node.getText()}`); };
  function load(path) {
    path = resolve(path);
    if (!path.startsWith(`${root}${sep}`)) throw new Error("Route-contract import escaped its directory.");
    if (files.has(path)) return files.get(path);
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const bindings = new Map();
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const item of statement.declarationList.declarations) {
          if (ts.isIdentifier(item.name) && item.initializer) bindings.set(item.name.text, item.initializer);
        }
      } else if (ts.isFunctionDeclaration(statement) && statement.name) bindings.set(statement.name.text, statement);
      else if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const imports = statement.importClause?.namedBindings;
        const specifier = statement.moduleSpecifier.text;
        if (imports && ts.isNamedImports(imports) && /^\.\/[a-z0-9.-]+\.route-contracts$/u.test(specifier)) {
          for (const item of imports.elements) bindings.set(item.name.text, {
            path: resolve(dirname(path), `${specifier}.ts`), name: item.propertyName?.text ?? item.name.text,
          });
        }
      }
    }
    const context = { source, bindings };
    files.set(path, context);
    return context;
  }
  function named(module, name, locals, depth) {
    if (locals.has(name)) return locals.get(name);
    const binding = module.bindings.get(name);
    if (!binding) throw new Error(`Unknown route-contract binding: ${name}`);
    const key = `${module.source.fileName}:${name}`;
    if (active.has(key)) throw new Error(`Circular route-contract binding: ${name}`);
    active.add(key);
    try {
      if (binding.path) return named(load(binding.path), binding.name, new Map(), depth + 1);
      if (ts.isFunctionDeclaration(binding)) return binding;
      return evaluate(binding, module, locals, depth + 1);
    } finally { active.delete(key); }
  }
  function evaluate(node, module, locals = new Map(), depth = 0) {
    if (--budget < 0 || depth > 100) throw new Error("Route-contract evaluation limit exceeded.");
    const value = (child, scope = locals) => evaluate(child, module, scope, depth + 1);
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression(node)) return value(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) return named(module, node.text, locals, depth + 1);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "RouteClass") return node.name.text;
    if (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(node.operator)) {
      const operand = value(node.operand);
      if (typeof operand !== "number") return fail(node);
      return node.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
    }
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        const item = value(span.expression);
        if (!["string", "number", "boolean"].includes(typeof item)) return fail(node);
        result += String(item) + span.literal.text;
      }
      return result;
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((element) => {
      if (!ts.isSpreadElement(element)) return [value(element)];
      const spread = value(element.expression);
      if (!Array.isArray(spread)) return fail(element);
      return spread;
    });
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const member of node.properties) {
        if (ts.isSpreadAssignment(member)) {
          const spread = value(member.expression);
          if (!spread || typeof spread !== "object" || Array.isArray(spread)) return fail(member);
          Object.assign(result, spread);
        } else if (ts.isPropertyAssignment(member)) {
          const name = member.name;
          if (!ts.isIdentifier(name) && !ts.isStringLiteral(name) && !ts.isNumericLiteral(name)) return fail(member);
          if (["__proto__", "constructor", "prototype"].includes(name.text)) return fail(member);
          result[name.text] = value(member.initializer);
        } else if (ts.isShorthandPropertyAssignment(member)) result[member.name.text] = named(module, member.name.text, locals, depth + 1);
        else return fail(member);
      }
      return result;
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression;
      if (ts.isPropertyAccessExpression(call) && ts.isIdentifier(call.expression)
        && call.expression.text === "Object" && call.name.text === "freeze" && node.arguments.length === 1) return value(node.arguments[0]);
      if (ts.isPropertyAccessExpression(call) && call.name.text === "map" && node.arguments.length === 1) {
        const rows = value(call.expression), callback = node.arguments[0];
        if (!Array.isArray(rows) || rows.length > 10_000 || !ts.isArrowFunction(callback) || callback.parameters.length !== 1 || ts.isBlock(callback.body)) return fail(node);
        return rows.map((row) => {
          const scope = new Map(locals), name = callback.parameters[0].name;
          if (ts.isIdentifier(name)) scope.set(name.text, row);
          else if (ts.isArrayBindingPattern(name) && Array.isArray(row)) {
            name.elements.forEach((element, index) => {
              if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name) || element.initializer || element.dotDotDotToken) fail(element);
              scope.set(element.name.text, row[index]);
            });
          } else return fail(name);
          return value(callback.body, scope);
        });
      }
      if (ts.isIdentifier(call) && node.arguments.length === 0) {
        const fn = named(module, call.text, locals, depth + 1);
        if (!fn || !ts.isFunctionDeclaration(fn) || fn.parameters.length || fn.body?.statements.length !== 1) return fail(node);
        const statement = fn.body.statements[0];
        if (!ts.isReturnStatement(statement) || !statement.expression) return fail(node);
        return value(statement.expression);
      }
    }
    return fail(node);
  }
  const routes = named(load(filePath), exportName, new Map(), 0);
  if (!Array.isArray(routes)) throw new Error(`${exportName} is not an array.`);
  return { routes, sourceFiles: [...files.keys()].sort() };
}
