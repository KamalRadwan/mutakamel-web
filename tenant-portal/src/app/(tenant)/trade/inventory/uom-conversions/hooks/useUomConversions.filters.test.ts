// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useUomConversions } from "./useUomConversions";

const mock = vi.hoisted(() => ({ get: vi.fn(), headers: { "x-mutakamel-company-id": "company-a" }, ensureProfiles: vi.fn(), ensureUom: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "actor", permissions: [] }, realtimeAuthGeneration: "session" }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchIds: [], branchId: null, selectBranch: vi.fn() }),
  useTradeScope: () => ({ headers: mock.headers, permissions: [], isTenantOwner: true, isResolved: true }), hasTradePermission: () => true,
}));
vi.mock("../../../trade-api", () => ({ tradeGet: mock.get, tradePost: vi.fn(), tradePatch: vi.fn(), tradeIfMatch: (value: number) => `"${value}"`, isTradeReplay: () => false }));
vi.mock("../../hooks/useInventoryReferences", () => ({ useInventoryReferences: () => ({ canCatalog: true, ensureProfiles: mock.ensureProfiles, ensureUom: mock.ensureUom }) }));
beforeEach(() => {
  mock.get.mockReset(); mock.ensureProfiles.mockResolvedValue([]); mock.ensureUom.mockResolvedValue(undefined);
  mock.get.mockResolvedValue({ data: { items: [], total: 151, page: 1, limit: 50 }, headers: new Headers() });
});
afterEach(cleanup);

it("does not request while supported filters are edited, applies together at page one, and Clear removes them", async () => {
  const { result } = renderHook(useUomConversions);
  await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => result.current.setPage(2));
  await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
  const unit = "01902001-3000-7000-8000-000000000003";
  const profile = "01902001-3000-7000-8000-000000000002";
  act(() => { result.current.setStatusFilter("PUBLISHED"); result.current.setFilters({ itemCompanyProfileId: profile, fromUomId: unit }); });
  expect(mock.get).toHaveBeenCalledTimes(2);
  expect(result.current.pagination.page).toBe(2);
  act(() => result.current.applyFilters());
  await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(3));
  const applied = mock.get.mock.calls[2][0];
  expect(applied).toContain("status=PUBLISHED"); expect(applied).toContain(`itemCompanyProfileId=${profile}`); expect(applied).toContain(`fromUomId=${unit}`);
  expect(applied).toContain("page=1"); expect(result.current.pagination.page).toBe(1);
  act(() => result.current.clearFilters());
  await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(4));
  expect(mock.get.mock.calls[3][0]).not.toContain("status="); expect(mock.get.mock.calls[3][0]).not.toContain("itemCompanyProfileId=");
  expect(result.current.filters).toEqual({}); expect(result.current.statusFilter).toBeUndefined(); expect(result.current.pagination.page).toBe(1);
});
