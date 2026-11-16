import { beforeEach, describe, expect, it, vi } from "vitest";

const { readPage } = vi.hoisted(() => ({ readPage: vi.fn() }));
vi.mock("@/lib/api/envelope", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api/envelope")>("@/lib/api/envelope")),
  readCorePage: readPage,
}));
import { fetchOrgNodes } from "./organization-contract";

const companyId = "01900100-0000-7000-8000-000000000001";
const branchId = "01900100-0000-7000-8000-000000000002";
const departmentId = "01900100-0000-7000-8000-000000000003";
beforeEach(() => {
  readPage.mockReset().mockResolvedValue({
    data: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  });
});

describe("organization hierarchy API requests", () => {
  it("sends both ancestor predicates to the department endpoint", async () => {
    await fetchOrgNodes("departments", { page: 1, search: "", companyId, branchId });
    expect(readPage.mock.calls[0][0]).toBe("/api/tenant/core/v1/organization/departments");
    const query = new URLSearchParams(readPage.mock.calls[0][1] as string);
    expect(query.get("companyId")).toBe(companyId);
    expect(query.get("branchId")).toBe(branchId);
  });
  it("sends all three ancestor predicates to the team endpoint", async () => {
    await fetchOrgNodes("teams", { page: 1, search: "", companyId, branchId, departmentId });
    expect(readPage.mock.calls[0][0]).toBe("/api/tenant/core/v1/organization/teams");
    const query = new URLSearchParams(readPage.mock.calls[0][1] as string);
    expect(query.get("companyId")).toBe(companyId);
    expect(query.get("branchId")).toBe(branchId);
    expect(query.get("departmentId")).toBe(departmentId);
  });
  it("omits All choices rather than sending a sentinel or undefined text", async () => {
    await fetchOrgNodes("teams", { page: 1, search: "", companyId: undefined, branchId: undefined, departmentId: undefined });
    const query = new URLSearchParams(readPage.mock.calls[0][1] as string);
    expect(query.has("companyId")).toBe(false);
    expect(query.has("branchId")).toBe(false);
    expect(query.has("departmentId")).toBe(false);
    expect(query.toString()).not.toContain("undefined");
  });
});
