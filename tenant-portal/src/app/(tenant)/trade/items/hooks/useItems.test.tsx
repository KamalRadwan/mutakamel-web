// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { TooltipProvider } from "@/design-system";
import { TradeScopeProvider, useTradeScope } from "../../useTradeScope";
import { useItems } from "./useItems";
import { ItemsWorkspace } from "../components/items-workspace";
import { EMPTY_ITEM_FORM } from "../item-contract";

const { get, post, auth, toast, write } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  auth: vi.fn(),
  toast: { success: vi.fn(), errorFromApi: vi.fn() },
  write: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => toast, useRealtimeResync: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/trade/items",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/i18n/useLanguage", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/i18n/useLanguage")>(), useDictionary: () => en,
}));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-api")>(),
  tradeGet: get, tradePost: post, tradePatch: vi.fn(), tradeIfMatch: vi.fn(),
  CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id",
}));
vi.mock("../../useTradeWrite", () => ({ useTradeWrite: () => write }));

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const ITEM = {
  id: "0192f3a0-0000-7000-8000-000000000003", canonicalCode: "SKU-1",
  itemKind: "PRODUCT", baseUomId: "0192f3a0-0000-7000-8000-000000000004",
  localizedNames: { en: "Unassigned item" }, categoryId: null, categorySummary: null, variantIdentity: null,
  barcode: null, notes: null, ownerUserId: null, weightKg: null, volumeM3: null,
  quotationDescription: null, salesOrderDescription: null, receiptDescription: null,
  deliveryOrderDescription: null, comboComponents: [], optionalProducts: [],
  status: "DRAFT", version: 1, updatedAt: "2026-09-27T09:00:00.000Z",
};
const page = (items: unknown[] = []) => ({ data: { items, total: items.length, page: 1, limit: 25 } });
const session = () => ({ user: {
  id: COMPANY, isTenantOwner: true, permissions: ["trade.items.read"],
  accessibleCompanies: [COMPANY], accessibleBranches: [BRANCH], teamMemberships: [],
} });
const mount = () => renderHook(() => ({ items: useItems(), scope: useTradeScope() }), {
  wrapper: TradeScopeProvider,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.mockReturnValue(session());
  get.mockImplementation(async (path: string, options: { headers: Record<string, string> }) => {
    if (path.includes("/channels?")) return { data: { items: [], total: 0, page: 1, limit: 100 } };
    return page(options.headers["x-mutakamel-company-id"] ? [] : [ITEM]);
  });
  post.mockResolvedValue(page());
  write.mockImplementation(async (request: () => Promise<unknown>) => {
    await request();
    return { ok: true, replayed: false, error: null };
  });
});
afterEach(cleanup);

describe("Items operating context", () => {
  it.each(["company", "master"])("shows a newly created identity after creation from %s scope", async (scope) => {
    if (scope === "master") localStorage.setItem("tenant_trade_company", "__tenant__");
    let created = false;
    get.mockImplementation(async (path: string, options: { headers: Record<string, string> }) => {
      if (path.includes("/channels?")) return { data: { items: [], total: 0, page: 1, limit: 100 } };
      return page(created && !options.headers["x-mutakamel-company-id"] ? [ITEM] : []);
    });
    post.mockImplementation(async (path: string) => {
      if (path.endsWith("/items")) created = true;
      return page();
    });
    const { result } = mount();
    await waitFor(() => expect(result.current.items.isRefreshing).toBe(false));
    expect(result.current.items.items).toEqual([]);
    act(() => {
      if (scope === "company") {
        result.current.scope.selectBranch(BRANCH);
        result.current.items.setSearch("OLD-CODE");
        result.current.items.setStatusFilter("ACTIVE");
      }
      result.current.items.openCreate();
    });
    await act(async () => {
      expect(await result.current.items.create({
        ...EMPTY_ITEM_FORM, category: { kind: "none" }, canonicalCode: ITEM.canonicalCode,
        nameEn: "Unassigned item", baseUomId: ITEM.baseUomId,
      })).toBe(true);
    });
    await waitFor(() => expect(result.current.items.items[0]?.id).toBe(ITEM.id));
    expect(result.current.scope.context.companyId).toBeNull();
    expect(result.current.items.search).toBe("");
    expect(result.current.items.statusFilter).toBeUndefined();
    expect(result.current.items.createOpen).toBe(false);
    expect(post).toHaveBeenCalledWith("/api/tenant/trade/v1/items", expect.objectContaining({ canonicalCode: ITEM.canonicalCode }), {});
  });

  it("retains company scope on cancelled or failed creation", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.scope.context.companyId).toBe(COMPANY));
    act(() => result.current.items.openCreate());
    act(() => result.current.items.closeCreate());
    expect(result.current.scope.context.companyId).toBe(COMPANY);
    write.mockResolvedValue({ ok: false });
    act(() => result.current.items.openCreate());
    await act(async () => {
      expect(await result.current.items.create({
        ...EMPTY_ITEM_FORM, category: { kind: "none" }, canonicalCode: ITEM.canonicalCode,
        nameEn: "Unassigned item", baseUomId: ITEM.baseUomId,
      })).toBe(false);
    });
    expect(result.current.scope.context.companyId).toBe(COMPANY);
    expect(result.current.items.createOpen).toBe(true);
  });

  it.each(["table", "card", "board"])("offers scope recovery and opens New item in the real %s view", async (view) => {
    localStorage.setItem("tenant_view_trade-items", view);
    get.mockImplementation(async (path: string) => path.includes("/channels?") ? { data: { items: [], total: 0, page: 1, limit: 100 } } : page());
    render(<TooltipProvider><TradeScopeProvider><ItemsWorkspace /></TradeScopeProvider></TooltipProvider>);
    await screen.findByText(en.trade.itemScopeEmpty);
    expect(screen.queryByText(en.trade.itemSearchNote)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.trade.scopeItemMaster }));
    const emptyTitle = await screen.findByText(en.trade.itemMasterEmpty);
    fireEvent.click(within(emptyTitle.parentElement!).getByRole("button", { name: en.trade.itemCreate }));
    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  it("lets an empty company view reach unassigned tenant items and retains that choice on reload", async () => {
    localStorage.setItem("tenant_trade_branch", BRANCH);
    localStorage.setItem("tenant_trade_channel", "0192f3a0-0000-7000-8000-000000000005");
    const first = mount();
    await waitFor(() => expect(first.result.current.scope.context.branchId).toBe(BRANCH));
    await waitFor(() => expect(first.result.current.items.isRefreshing).toBe(false));
    act(() => first.result.current.scope.selectChannel("0192f3a0-0000-7000-8000-000000000005"));
    expect(first.result.current.scope.context.channelId).not.toBeNull();
    expect(first.result.current.items.items).toEqual([]);
    expect(first.result.current.items.emptyTitle).toBe(en.trade.itemScopeEmpty);

    act(() => first.result.current.items.emptyAction?.onClick());
    await waitFor(() => expect(first.result.current.items.items[0]?.id).toBe(ITEM.id));
    expect(first.result.current.scope.context).toEqual({ companyId: null, branchId: null, channelId: null });
    expect(localStorage.getItem("tenant_trade_company")).toBe("__tenant__");
    expect(localStorage.getItem("tenant_trade_branch")).toBeNull();
    expect(localStorage.getItem("tenant_trade_channel")).toBeNull();
    expect(first.result.current.scope.headersFor("OPERATING_CONTEXT")).toEqual({});
    expect(first.result.current.scope.gapFor("COMPANY")).toBe("company-required");
    first.unmount();

    const second = mount();
    await waitFor(() => expect(second.result.current.items.items[0]?.id).toBe(ITEM.id));
    expect(second.result.current.scope.context.companyId).toBeNull();
    second.rerender();
    expect(second.result.current.scope.context.companyId).toBeNull();
  });

  it("resets pagination when company/branch scope changes", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.scope.context.companyId).toBe(COMPANY));
    act(() => result.current.items.setPage(4));
    await waitFor(() => expect(result.current.items.pageInfo.page).toBe(4));
    get.mockClear();
    act(() => result.current.scope.selectBranch(BRANCH));
    await waitFor(() => expect(get).toHaveBeenCalledWith(
      expect.stringContaining("items?page=1&"),
      expect.objectContaining({ headers: { "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH } }),
    ));
    expect(get.mock.calls.some(([path]) => path.includes("page=4"))).toBe(false);
  });

  it("loads authoritative detail before editing a list row with omitted relations", async () => {
    const componentItemId = "0192f3a0-0000-7000-8000-000000000006";
    const optionalProductItemId = "0192f3a0-0000-7000-8000-000000000007";
    const detailItem = {
      ...ITEM,
      itemKind: "COMBO",
      comboComponents: [{ componentItemId, quantity: "2", sortOrder: 0 }],
      optionalProducts: [{ optionalProductItemId, sortOrder: 0 }],
    };
    const { comboComponents: _combo, optionalProducts: _optional, ...listRow } = detailItem;
    get.mockImplementation(async (path: string) => {
      if (path.includes("/channels?")) return { data: { items: [], total: 0, page: 1, limit: 100 } };
      if (path === `/api/tenant/trade/v1/items/${ITEM.id}`) return { data: detailItem };
      return page([listRow]);
    });

    const { result } = mount();
    await waitFor(() => expect(result.current.items.items).toHaveLength(1));
    expect(result.current.items.items[0]?.comboComponents).toEqual([]);

    await act(async () => {
      await result.current.items.openEdit(result.current.items.items[0]!);
    });
    expect(result.current.items.editing?.comboComponents).toEqual([
      { componentItemId, quantity: "2", sortOrder: 0 },
    ]);
    expect(result.current.items.editing?.optionalProducts).toEqual([
      { optionalProductItemId, sortOrder: 0 },
    ]);
    expect(get).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/items/${ITEM.id}`,
      expect.objectContaining({ headers: {} }),
    );
  });

  it("keeps GET browsing and uses free-text POST search, then clears all filters for recovery", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.scope.context.companyId).toBe(COMPANY));
    act(() => {
      result.current.items.setSearch(" sku-1 ");
      result.current.items.setKindFilter("PRODUCT");
    });
    await waitFor(() => expect(post).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items/search",
      { page: 1, limit: 25, itemKind: "PRODUCT", search: "sku-1", filters: [] },
      expect.objectContaining({ headers: { "x-mutakamel-company-id": COMPANY } }),
    ));
    expect(result.current.items.emptyTitle).toBe(en.trade.itemEmpty);
    act(() => result.current.items.emptyAction?.onClick());
    await waitFor(() => expect(result.current.items.isRefreshing).toBe(false));
    expect(result.current.items.search).toBe("");
    expect(result.current.items.kindFilter).toBeUndefined();
    expect(result.current.items.emptyTitle).toBe(en.trade.itemScopeEmpty);
  });

  it("describes a genuinely empty master as a new catalog", async () => {
    get.mockImplementation(async (path: string) => path.includes("/channels?") ? { data: { items: [], total: 0, page: 1, limit: 100 } } : page());
    const { result } = mount();
    await waitFor(() => expect(result.current.scope.context.companyId).toBe(COMPANY));
    act(() => result.current.scope.selectCompany(null));
    await waitFor(() => expect(result.current.items.isRefreshing).toBe(false));
    expect(result.current.items.items).toEqual([]);
    expect(result.current.items.emptyTitle).toBe(en.trade.itemMasterEmpty);
    expect(result.current.items.queryError).toBeNull();
    expect(result.current.items.emptyAction?.label).toBe(en.trade.itemCreate);
    act(() => result.current.items.emptyAction?.onClick());
    expect(result.current.items.createOpen).toBe(true);
  });

  it("does not offer item creation to a reader without master management permission", async () => {
    auth.mockReturnValue({ user: { ...session().user, isTenantOwner: false, permissions: ["trade.items.read"] } });
    localStorage.setItem("tenant_trade_company", "__tenant__");
    get.mockImplementation(async (path: string) => path.includes("/channels?") ? { data: { items: [], total: 0, page: 1, limit: 100 } } : page());
    const { result } = mount();
    await waitFor(() => expect(result.current.items.isRefreshing).toBe(false));
    expect(result.current.items.canManage).toBe(false);
    expect(result.current.items.emptyAction).toBeUndefined();
  });

  it("does not let a late company request overwrite the master result", async () => {
    let finishCompany: (result: ReturnType<typeof page>) => void = () => {};
    get.mockImplementation((path: string, options: { headers: Record<string, string> }) => {
      if (path.includes("/channels?")) return Promise.resolve({ data: { items: [], total: 0, page: 1, limit: 100 } });
      if (options.headers["x-mutakamel-company-id"]) return new Promise((resolve) => { finishCompany = resolve; });
      return Promise.resolve(page([ITEM]));
    });
    const { result } = mount();
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("/items?"), expect.objectContaining({ headers: { "x-mutakamel-company-id": COMPANY } })));
    act(() => result.current.scope.selectCompany(null));
    await waitFor(() => expect(result.current.items.isRefreshing).toBe(false));
    await act(async () => finishCompany(page()));
    expect(result.current.items.items[0]?.id).toBe(ITEM.id);
  });

  it("preserves authorization errors instead of presenting them as an empty catalog", async () => {
    get.mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { code: "TRADE.AUTH.TARGET_DENIED" },
    }));
    const { result } = mount();
    await waitFor(() => expect(result.current.items.queryError).toMatchObject({
      status: 403, code: "TRADE.AUTH.TARGET_DENIED",
    }));
    expect(result.current.items.items).toEqual([]);
  });
});
