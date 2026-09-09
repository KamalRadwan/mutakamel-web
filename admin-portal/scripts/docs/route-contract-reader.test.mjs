import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRouteContracts } from "./route-contract-reader.mjs";

const temporary = [];
function fixture(source, child) {
  const directory = mkdtempSync(resolve(tmpdir(), "admin-route-reader-"));
  temporary.push(directory);
  const path = resolve(directory, "core.route-contracts.ts");
  writeFileSync(path, source);
  if (child) writeFileSync(resolve(directory, "child.route-contracts.ts"), child);
  return path;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) {
    if (!directory.startsWith(`${resolve(tmpdir())}${sep}admin-route-reader-`)) throw new Error("Unsafe fixture cleanup target.");
    rmSync(directory, { recursive: true });
  }
});

describe("static route-contract reader", () => {
  it("reads the actual current Gateway aggregate including all 23 Admin Addon contracts", () => {
    const path = resolve(import.meta.dirname, "../../../../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts");
    const { routes, sourceFiles } = readRouteContracts(path, "CORE_ROUTE_CONTRACTS");
    const scoped = routes.filter((route) => route.routeKey.startsWith("core.admin.applications.addons."));
    expect(scoped).toHaveLength(23);
    expect(scoped.every((route) => route.commercialContractVersion === 2 && route.requiredPermissionsMode === "ALL")).toBe(true);
    expect(sourceFiles.some((file) => file.endsWith("core-addon.route-contracts.ts"))).toBe(true);
  });
  it("follows imports/spreads and literal map functions without evaluating a module", () => {
    const path = fixture("import { CHILD as C } from './child.route-contracts'; export const ROOT = [...C];",
      "export const CHILD = Object.freeze([...rows()]); function rows() { return [['a','read']].map(([key,permission]) => ({routeKey:`x.${key}`,requiredPermissions:[`x.${permission}`],routeClass:RouteClass.AUTHENTICATED})); }");
    expect(readRouteContracts(path, "ROOT")).toEqual({
      routes: [{ routeKey: "x.a", requiredPermissions: ["x.read"], routeClass: "AUTHENTICATED" }],
      sourceFiles: [resolve(path, "../child.route-contracts.ts"), path].sort(),
    });
  });
  it.each([
    "export const ROOT = process.exit(0);",
    "export const ROOT = fetch('https://example.com');",
    "export const ROOT = run(); function run() { console.log('side effect'); return []; }",
    "export const ROOT = [{__proto__: {polluted:true}}];",
    "export const ROOT = [...ROOT];",
    "import { CHILD } from '../child.route-contracts'; export const ROOT = CHILD;",
  ])("rejects unsupported code without execution: %s", (source) => {
    expect(() => readRouteContracts(fixture(source), "ROOT")).toThrow();
  });
});
