// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOrgNodes } from "@/app/(tenant)/core/contracts/organization-contract";
import { en } from "@/i18n/dictionaries/en";
import { useTradeBranchChoices } from "./useTradeBranchChoices";

const fixture = vi.hoisted(() => ({ user: {
  id: "0192f3a0-0000-7000-8000-000000000010", isTenantOwner: true, permissions: [] as string[],
  accessibleBranches: ["0192f3a0-0000-7000-8000-000000000002", "0192f3a0-0000-7000-8000-000000000003"],
  teamMemberships: [] as Array<{ companyId: string; branchId: string | null }>,
} }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: fixture.user, realtimeAuthGeneration: 1 }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/app/(tenant)/core/contracts/organization-contract", async (original) => ({
  ...await original<typeof import("@/app/(tenant)/core/contracts/organization-contract")>(), fetchOrgNodes: vi.fn(),
}));
const get = vi.mocked(fetchOrgNodes);
const id = (value: number) => `0192f3a0-0000-7000-8000-${String(value).padStart(12, "0")}`;
const branch = (value: number, companyId = id(1)) => ({ id: id(value), companyId, code: `B${value}`, name: `Branch ${value}`,
  status: "ACTIVE" as const, createdAt: "2026-11-04T00:00:00.000Z", updatedAt: "2026-11-04T00:00:00.000Z",
  address: null, phone: null, isHeadquarters: false });
const page = (items: ReturnType<typeof branch>[]) => ({ items, total: items.length, page: 1, limit: 100,
  totalPages: 1, hasNext: false, hasPrev: false });

beforeEach(() => { get.mockReset(); fixture.user.isTenantOwner = true; fixture.user.teamMemberships = []; });
afterEach(cleanup);

describe("Trade company branch ownership", () => {
  it("intersects actual Core company ownership with accessible IDs", async () => {
    get.mockResolvedValueOnce(page([branch(2), branch(3, id(99)), branch(4)]));
    const { result } = renderHook(() => useTradeBranchChoices(id(1)));
    await waitFor(() => expect(result.current.isLoadingBranches).toBe(false));
    expect(result.current.branchIds).toEqual([id(2)]);
    expect(get).toHaveBeenCalledWith("branches", expect.objectContaining({ parentId: id(1), status: "ACTIVE" }));
  });

  it("does not treat flat accessible branch IDs as company ownership evidence", () => {
    fixture.user.isTenantOwner = false;
    const { result } = renderHook(() => useTradeBranchChoices(id(1)));
    expect(result.current.branchIds).toEqual([]);
    expect(result.current.branchesError).not.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("uses only proven membership pairs when organization read access is unavailable", () => {
    fixture.user.isTenantOwner = false;
    fixture.user.teamMemberships = [{ companyId: id(1), branchId: id(2) }, { companyId: id(99), branchId: id(3) }];
    const { result, rerender } = renderHook(({ company }) => useTradeBranchChoices(company), { initialProps: { company: id(1) } });
    expect(result.current.branchIds).toEqual([id(2)]);
    rerender({ company: id(99) });
    expect(result.current.branchIds).toEqual([id(3)]);
  });

  it("keeps verified fallback on dependency failure and supports real retry", async () => {
    fixture.user.teamMemberships = [{ companyId: id(1), branchId: id(2) }];
    get.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce(page([branch(2), branch(3)]));
    const { result } = renderHook(() => useTradeBranchChoices(id(1)));
    await waitFor(() => expect(result.current.branchesError).not.toBeNull());
    expect(result.current.branchIds).toEqual([id(2)]);
    act(() => result.current.refreshBranches());
    await waitFor(() => expect(result.current.branchIds).toEqual([id(2), id(3)]));
    expect(result.current.branchesError).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
