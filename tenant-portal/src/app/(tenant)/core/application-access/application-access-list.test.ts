import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { parseApplicationAccessList, readApplicationAccessList, type ApplicationAccessListItem, type ApplicationAccessListRequest } from "./application-access-list";

const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const headers = new Headers();
const request: ApplicationAccessListRequest = { scope: "COMPANY", scopeId: id(1), page: 1, limit: 20 };
function fixture(branch = false) {
  const scope = branch ? { kind: "BRANCH" as const, companyId: id(1), branchId: id(2) } : { kind: "COMPANY" as const, companyId: id(1), branchId: null };
  const data: ApplicationAccessListItem[] = [{
     scope, target: { applicationId: id(3), applicationKey: "crm", addonId: null, addonKey: null }, resourceScope: "COMPANY",
    resource: { kind: "APPLICATION_ACTIVATION", state: "STORED", id: id(4), revision: "2", enabled: false }, observation: "LOCAL_PROJECTION", operationalUse: "NOT_EVALUATED",
  }, {
     scope, target: { applicationId: id(3), applicationKey: "crm", addonId: id(5), addonKey: "crm.logistics" }, resourceScope: branch ? "BRANCH" : "COMPANY",
    resource: branch ? { kind: "BRANCH_OVERRIDE", state: "NOT_CREATED", id: null, revision: "0", mode: null, definitionVersionId: null, configVersionId: null,
      companyApplicationEnabled: false, companyAddonEnabled: false }
      : { kind: "ADDON_ACTIVATION", state: "NOT_CREATED", id: null, revision: "0", enabled: null, definitionVersionId: null, configVersionId: null },
    observation: "LOCAL_PROJECTION", operationalUse: "NOT_EVALUATED",
  }];
  return { success: true, correlationId: "r1", timestamp: "2026-09-07T19:00:00.000Z", data,
    meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false } };
}
afterEach(() => vi.restoreAllMocks());
describe("scoped activation directory", () => {
  it("preserves Company base/Addons and absence without evaluating operational eligibility", () => {
    const body = fixture();
    expect(parseApplicationAccessList(body, request)).toEqual({ items: body.data, meta: body.meta });
  });
  it("keeps inherited Company base rows inside Branch scope without a Company grant", () => {
    const body = fixture(true);
    const result = parseApplicationAccessList(body, { ...request, scope: "BRANCH", scopeId: id(2) });
    expect(result.items[0].scope.kind).toBe("BRANCH");
    expect(result.items[0].resourceScope).toBe("COMPANY");
    expect(result.items[1].resourceScope).toBe("BRANCH");
  });
  it("accepts an honest empty page and an out-of-range empty page", () => {
    const body = fixture();
    body.data = [];
    body.meta = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
    expect(parseApplicationAccessList(body, request).items).toEqual([]);
    body.meta.page = 2; body.meta.hasPrev = true;
    expect(parseApplicationAccessList(body, { ...request, page: 2 }).items).toEqual([]);
  });
  it.each(["version", "scope", "resourceScope", "kind", "duplicate", "parent", "total", "page", "metadata", "config"])("rejects invalid %s", (kind) => {
    const body = fixture();
    if (kind === "version") Object.assign(body.data[0], { contractVersion: 1 });
    if (kind === "scope") body.data[0].scope.companyId = id(9);
    if (kind === "resourceScope") body.data[1].resourceScope = "BRANCH";
    if (kind === "kind") Object.assign(body.data[1].resource, { kind: "BRANCH_OVERRIDE" });
    if (kind === "duplicate") body.data[1] = body.data[0];
    if (kind === "parent") body.data[1].target.addonKey = "trade.inventory";
    if (kind === "total") body.meta.total = 3;
    if (kind === "page") body.meta.page = 2;
    if (kind === "metadata") Object.assign(body.meta, { cursor: "invented" });
    if (kind === "config") Object.assign(body.data[0], { values: { secret: "private" } });
    expect(() => parseApplicationAccessList(body, request)).toThrow("could not be verified");
  });
  it.each(["COMPANY", "BRANCH"] as const)("sends the exact canonical %s path and only pagination", async (scope) => {
    const body = fixture(scope === "BRANCH");
    const input = { ...request, scope, scopeId: scope === "BRANCH" ? id(2) : id(1) };
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: body, headers, status: 200, statusText: "OK" });
    await readApplicationAccessList(input);
    expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/${scope === "BRANCH" ? "branches" : "companies"}/${input.scopeId}/application-activations?page=1&limit=20`, {
      signal: undefined, cache: "no-store", maxResponseBytes: 1_048_576,
    });
  });
});
