import { describe, expect, it } from "vitest";
import { parseOrganizationHierarchyFilters } from "./useOrganizationFilters";

const companyId = "01900100-0000-7000-8000-000000000001";
const otherCompany = "01900100-0000-7000-8000-000000000002";
const branchId = "01900100-0000-7000-8000-000000000003";
const departmentId = "01900100-0000-7000-8000-000000000004";
const current = { companyId, branchId, departmentId };
const selected = {
  companyId: { kind: "select" as const, value: companyId },
  branchId: { kind: "select" as const, value: branchId },
  departmentId: { kind: "select" as const, value: departmentId },
};

describe("organization hierarchy list filters", () => {
  it("clears both descendants when the company changes", () => {
    expect(parseOrganizationHierarchyFilters({ ...selected, companyId: { kind: "select", value: otherCompany } }, current))
      .toEqual({ companyId: otherCompany, branchId: undefined, departmentId: undefined });
  });
  it("resets descendants when All companies is selected", () => {
    expect(parseOrganizationHierarchyFilters({ ...selected, companyId: undefined }, current))
      .toEqual({ companyId: undefined, branchId: undefined, departmentId: undefined });
  });
  it("keeps company scope and clears the department for All branches", () => {
    expect(parseOrganizationHierarchyFilters({ ...selected, branchId: undefined }, current))
      .toEqual({ companyId, branchId: undefined, departmentId: undefined });
  });
  it("retains compatible filters and rejects non-ID sentinels", () => {
    expect(parseOrganizationHierarchyFilters(selected, current)).toEqual(current);
    expect(parseOrganizationHierarchyFilters({ companyId: { kind: "select", value: "__filter_all__" } }, {}))
      .toEqual({ companyId: undefined, branchId: undefined, departmentId: undefined });
  });
});
