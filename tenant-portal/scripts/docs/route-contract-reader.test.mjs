import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRouteContracts } from "./route-contract-reader.mjs";

const temporary = [];
function fixture(source, child) {
  const directory = mkdtempSync(resolve(tmpdir(), "tenant-route-reader-"));
  temporary.push(directory);
  const path = resolve(directory, "core.route-contracts.ts");
  writeFileSync(path, source);
  if (child) writeFileSync(resolve(directory, "child.route-contracts.ts"), child);
  return path;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) {
    if (!directory.startsWith(`${resolve(tmpdir())}${sep}tenant-route-reader-`)) throw new Error("Unsafe fixture cleanup target.");
    rmSync(directory, { recursive: true });
  }
});

describe("static route-contract reader", () => {
  /** The `.get` suffix selects the single-resource scoped reads under application-access — the `.list`
   * collections and the PATCH/POST/DELETE writes carry other suffixes. Core owns nine of them:
   *   1. company-application.get                     application-access-read.controller.ts
   *   2. company-addon.get                           application-access-read.controller.ts
   *   3. branch-addon.get                            application-access-read.controller.ts
   *   4. company-configuration.get                   application-access-read.controller.ts
   *   5. branch-configuration.get                    application-access-read.controller.ts
   *   6. company-addon-activation-command.get        activation-continuation/company-addon-activation-status.controller.ts
   *   7. company-addon-configuration-command.get     configuration/continuation/company-addon-configuration-status.controller.ts
   *   8. company-configuration-input.get             configuration/addon-configuration-input.controller.ts
   *   9. branch-configuration-input.get              configuration/addon-configuration-input.controller.ts
   * Rows 6-9 arrived with the `activation-continuation/` and `configuration/` trees: the two 202-command
   * status polls and the two input-schema descriptors. All nine are AUTHENTICATED GETs whose alternative
   * read-or-manage grants make `requiredPermissionsMode` ANY, and all carry route-contract `version` 1 —
   * the Gateway's single contract version, which replaced the V1/V2 `commercialContractVersion` field. */
  it("reads the actual current Gateway aggregate including nine canonical scoped reads", () => {
    const path = resolve(import.meta.dirname, "../../../../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts");
    const { routes, sourceFiles } = readRouteContracts(path, "CORE_ROUTE_CONTRACTS");
    const scoped = routes.filter((route) => route.routeKey.startsWith("core.tenant.application-access.") && route.routeKey.endsWith(".get"));
    expect(scoped).toHaveLength(9);
    expect(scoped.every((route) => route.version === 1 && route.requiredPermissionsMode === "ANY")).toBe(true);
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
