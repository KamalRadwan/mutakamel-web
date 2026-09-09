import { describe, expect, it } from "vitest";
import { isSupportedCorePath } from "@/lib/navigation/tenant-routes";
import { applicationAccessRoute } from "./application-access-route";

const id = "018ef54e-2222-7777-8888-000000000001";
describe("scoped Application deep links", () => {
  it.each([
    [`companies/${id}/application-activations/crm`, "APPLICATION_ACTIVATION"],
    [`companies/${id}/application-activations/crm/addons/crm.logistics`, "ADDON_ACTIVATION"],
    [`companies/${id}/application-activations/crm/addons/crm.logistics/configuration`, "COMPANY_CONFIGURATION"],
    [`branches/${id}/application-activations/crm/addons/crm.logistics`, "BRANCH_OVERRIDE"],
    [`branches/${id}/application-activations/crm/addons/crm.logistics/configuration`, "BRANCH_CONFIGURATION"],
  ])("admits only a supported exact deep link %s", (path, kind) => {
    expect(isSupportedCorePath(`/core/application-access/${path}`)).toBe(true);
    expect(applicationAccessRoute(path.split("/"))?.kind).toBe(kind);
  });
  it.each([
    `branches/${id}/application-activations/crm`,
    `companies/${id}/application-activations/crm/configuration`,
    `companies/${id}/application-activations/crm/addons`,
    `companies/${id}/application-activations/crm/addons/crm.logistics/configuration/extra`,
    `tenants/${id}/application-activations/crm`,
  ])("rejects unsupported path %s", (path) => {
    expect(isSupportedCorePath(`/core/application-access/${path}`)).toBe(false);
    expect(applicationAccessRoute(path.split("/"))).toBeNull();
  });
  it("does not accept a valid-looking Addon under the wrong parent", () => {
    expect(applicationAccessRoute(`companies/${id}/application-activations/crm/addons/trade.logistics`.split("/"))).toBeNull();
  });
});
