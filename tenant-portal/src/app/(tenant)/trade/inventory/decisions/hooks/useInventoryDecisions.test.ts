// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useInventoryDecisions } from "./useInventoryDecisions";

const mocks = vi.hoisted(() => ({ get: vi.fn(), headers: { "x-mutakamel-company-id": "company-1" } }));
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/hooks/useTenantOrganizationOptions", () => ({ useTenantOrganizationOptions: () => [] }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchIds: [], branchId: null, selectBranch: vi.fn() }),
  hasTradePermission: () => true,
  useTradeScope: () => ({ isResolved: true, headers: mocks.headers, permissions: [], isTenantOwner: true }),
}));
vi.mock("../../../trade-api", () => ({ tradeGet: mocks.get }));

const id = (value: number) => `019f2200-0000-7000-8000-${String(value).padStart(12, "0")}`;
const receipt = (value = 1) => ({
  id: id(value), decisionType: "INVENTORY_RESERVATION", aggregateType: "INVENTORY_RESERVATION", aggregateId: id(50),
  result: { outcome: "PARTIAL", selectedValue: "PARTIAL", explanationCode: "PARTIAL_ALLOWED" },
  evaluatedAt: "2026-11-03T08:42:00Z", explanation: "Available stock was reserved.",
  companyId: id(90), branchId: null, correlationId: id(91), policyVersions: [], matchedRules: ["RESERVE_AVAILABLE"],
});

beforeEach(() => {
  window.history.replaceState(null, "", "/trade/inventory/decisions");
  mocks.headers = { "x-mutakamel-company-id": "company-1" };
  mocks.get.mockReset();
  mocks.get.mockImplementation(async (path: string) => {
    const page = Number(new URL(path, "https://example.test").searchParams.get("page"));
    return { data: { items: [receipt(page)], total: 100, page, limit: 50 } };
  });
});
afterEach(cleanup);

describe("inventory decision read controls", () => {
  it("keeps same-query rows after failed refresh and clears them when an applied filter changes", async () => {
    const { result } = renderHook(useInventoryDecisions);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.get.mockRejectedValue(new Error("Private transport diagnostic"));
    await act(async () => result.current.reload());
    expect(result.current.items[0].id).toBe(id(1));
    expect(result.current.isStale).toBe(true);
    expect(result.current.errorMessage).toBe(en.tradeInventory.decisionsLoadFailed);
    act(() => result.current.setFilter("policyKind", "INVENTORY_NEGATIVE"));
    act(() => result.current.applyFilters());
    await waitFor(() => expect(result.current.queryError).not.toBeNull());
    expect(result.current.items).toEqual([]);
    expect(result.current.isStale).toBe(false);
  });
  it("validates exact references and sends only supported filters after Apply", async () => {
    const { result } = renderHook(useInventoryDecisions);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const calls = mocks.get.mock.calls.length;
    act(() => result.current.setFilter("aggregateId", "invalid-reference"));
    act(() => result.current.applyFilters());
    expect(result.current.referenceError).toBe(en.tradeInventory.readViews.referenceInvalid);
    expect(mocks.get).toHaveBeenCalledTimes(calls);
    act(() => {
      result.current.setFilter("aggregateId", id(50));
      result.current.setFilter("policyKind", "INVENTORY_RESERVATION");
    });
    act(() => result.current.applyFilters());
    await waitFor(() => expect(mocks.get.mock.lastCall?.[0]).toContain("aggregateId="));
    const path = new URL(mocks.get.mock.lastCall?.[0], "https://example.test");
    expect([...path.searchParams.keys()].sort()).toEqual(["aggregateId", "limit", "page", "policyKind"]);
    expect(path.searchParams.get("aggregateId")).toBe(id(50));
    expect(result.current.sourceOptions[0].label).not.toContain(id(50));
  });

  it("resets page and source selections on company change and ignores an old company response", async () => {
    const { result, rerender } = renderHook(useInventoryDecisions);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    let finish!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(mocks.get.mock.lastCall?.[0]).toContain("page=2"));
    mocks.headers = { "x-mutakamel-company-id": "company-2" };
    rerender();
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    await act(async () => finish({ data: { items: [receipt(77)], total: 100, page: 2, limit: 50 } }));
    expect(result.current.items[0].id).toBe(id(1));
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.filters.aggregateId).toBe("");
  });
});
