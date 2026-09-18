import { beforeEach, describe, expect, it, vi } from "vitest";
const { core, crm } = vi.hoisted(() => ({ core: vi.fn(), crm: vi.fn() }));
vi.mock("@/lib/api/envelope", () => ({ readCoreData: core, readCrmBody: crm }));
import { readAuditReferenceLabel, auditReferencePermission } from "./reference-labels";
const ID = "01900100-0000-7000-8000-000000000011";
const signal = new AbortController().signal;
beforeEach(() => vi.resetAllMocks());

describe("audit reference names", () => {
  it.each([
    { field: "companyId", resource: "companies", permission: "org.company.read" },
    { field: "branchId", resource: "branches", permission: "org.branch.read" },
    { field: "departmentId", resource: "departments", permission: "org.department.read" },
    { field: "teamId", resource: "teams", permission: "org.team.read" },
  ])("uses the verified $field read contract", async ({ field, resource, permission }) => {
    core.mockResolvedValue({ id: ID, name: "Sales" });
    expect(auditReferencePermission(field)).toBe(permission);
    expect(await readAuditReferenceLabel(field, ID, "en", signal)).toBe("Sales");
    expect(core).toHaveBeenCalledWith(`/api/tenant/core/v1/organization/${resource}/${ID}`, expect.objectContaining({ signal }));
    expect(crm).not.toHaveBeenCalled();
  });
  it("reads a source's localized name without a Core unwrap or active filter", async () => {
    crm.mockResolvedValue({ id: ID, nameAr: "الموقع", nameEn: "Website", isActive: false });
    expect(await readAuditReferenceLabel("acquisitionSourceId", ID, "ar", signal)).toBe("الموقع");
    expect(crm).toHaveBeenCalledWith(`/api/tenant/crm/v1/acquisition-sources/${ID}`, expect.objectContaining({ signal }));
    expect(core).not.toHaveBeenCalled();
  });
  it.each([{ id: "wrong", name: "Sales" }, { id: ID, name: "" }, { id: ID, name: ID }, { id: ID, name: 5 }])("rejects a mismatched or unusable name: %j", async (payload) => {
    core.mockResolvedValue(payload);
    await expect(readAuditReferenceLabel("branchId", ID, "en", signal)).rejects.toThrow();
  });
  it("never guesses an endpoint for an unknown field", async () => {
    expect(auditReferencePermission("sourceId")).toBeUndefined();
    await expect(readAuditReferenceLabel("sourceId", ID, "en", signal)).rejects.toThrow();
    expect(core).not.toHaveBeenCalled(); expect(crm).not.toHaveBeenCalled();
  });
});
