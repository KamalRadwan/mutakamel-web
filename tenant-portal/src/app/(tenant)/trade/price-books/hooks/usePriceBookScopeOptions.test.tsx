// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOrgNodes } from "@/app/(tenant)/core/contracts/organization-contract";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TradeScopeProvider } from "../../useTradeScope";
import { useTradeScope as useRequestScope } from "../../trade-advanced-scope";
import { PriceBookScopeBar } from "../components/PriceBookScopeBar";
import { usePriceBookScopeOptions } from "./usePriceBookScopeOptions";

const COMPANY_A = "0192f3a0-0000-7000-8000-000000000001";
const COMPANY_B = "0192f3a0-0000-7000-8000-000000000002";
const BRANCH_A = "0192f3a0-0000-7000-8000-000000000003";
const BRANCH_B = "0192f3a0-0000-7000-8000-000000000004";
const fixture = vi.hoisted(() => ({
  t: null as unknown,
  lang: "en",
  generation: "session-1",
  owner: true,
  companies: [] as string[],
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/trade/price-books" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: fixture.t, lang: fixture.lang, dir: fixture.lang === "ar" ? "rtl" : "ltr" }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    realtimeAuthGeneration: fixture.generation,
    user: {
      id: "actor", isTenantOwner: fixture.owner, permissions: [],
      accessibleCompanies: fixture.companies,
      accessibleBranches: [BRANCH_A, BRANCH_B], teamMemberships: [],
    },
  }),
}));
vi.mock("@/app/(tenant)/core/contracts/organization-contract", async (original) => ({
  ...await original<typeof import("@/app/(tenant)/core/contracts/organization-contract")>(), fetchOrgNodes: vi.fn(),
}));
vi.mock("../../trade-api", () => ({
  CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id",
  tradeGet: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 100 } }),
}));

const fetchNodes = vi.mocked(fetchOrgNodes);
// The shared provider separately verifies ownership with a company-filtered read.
const directoryReads = () => fetchNodes.mock.calls.filter(([, options]) => options.parentId === undefined);
const companies = [
  { id: COMPANY_B, name: "Beta Trading" },
  { id: COMPANY_A, name: "Alpha Trading" },
];
const branches = [
  { id: BRANCH_A, name: "Cairo", companyId: COMPANY_A, status: "ACTIVE" },
  { id: BRANCH_B, name: "Alexandria", companyId: COMPANY_B, status: "ACTIVE" },
];
function useSubject() {
  return {
    ...usePriceBookScopeOptions(),
    request: useRequestScope("COMPANY", null, { autoSelectCompany: false }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fixture.t = en;
  fixture.lang = "en";
  fixture.generation = "session-1";
  fixture.owner = true;
  fixture.companies = [COMPANY_A, COMPANY_B];
  fetchNodes.mockImplementation(async (level) => ({
    items: level === "companies" ? companies : branches,
    page: 1, limit: 100, total: 2, totalPages: 1, hasNext: false, hasPrev: false,
  }) as Awaited<ReturnType<typeof fetchOrgNodes>>);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("Price book organization options", () => {
  it("selects the available company and defaults branches to All", async () => {
    fixture.companies = [COMPANY_A];
    localStorage.setItem("tenant_trade_company", COMPANY_A);
    localStorage.setItem("tenant_trade_branch", BRANCH_B);
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.context).toEqual({ companyId: COMPANY_A, branchId: null, channelId: null });
    expect(result.current.companyLabel).toBe("Alpha Trading");
    expect(result.current.branchLabel).toBe(en.trade.scopeAllBranches);
    expect(result.current.request.isResolved).toBe(true);
    expect(result.current.request.headers).toEqual({ "x-mutakamel-company-id": COMPANY_A });
    expect(result.current.companyOptions.map((option) => option.label)).toEqual([
      "Alpha Trading",
    ]);
  });

  it.each([null, "__tenant__"])("selects the first available company when saved scope is %s", async (saved) => {
    if (saved) localStorage.setItem("tenant_trade_company", saved);
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.context.companyId).toBe(COMPANY_A);
    expect(result.current.companyOptions.map((option) => option.value)).toEqual([COMPANY_A, COMPANY_B]);
    act(() => result.current.changeCompany("__all__"));
    expect(result.current.context.companyId).toBe(COMPANY_A);
  });

  it("restores the saved company while clearing the saved branch", async () => {
    localStorage.setItem("tenant_trade_company", COMPANY_B);
    localStorage.setItem("tenant_trade_branch", BRANCH_A);
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.companyLabel).toBe("Beta Trading");
    expect(result.current.context.branchId).toBeNull();
  });

  it("searches locally by name and keeps the selected label", async () => {
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.changeCompany(COMPANY_A));
    act(() => result.current.setCompanySearch("  BETA "));
    expect(result.current.companyOptions.map((option) => option.label)).toEqual([
      "Beta Trading",
    ]);
    expect(result.current.companyLabel).toBe("Alpha Trading");
    act(() => result.current.setCompanySearch("missing"));
    expect(result.current.companyOptions).toEqual([]);
    expect(directoryReads()).toHaveLength(2);
    expect(fetchNodes).toHaveBeenCalledWith("branches", expect.objectContaining({ parentId: COMPANY_A }));
    expect(fetchNodes.mock.calls.every(([, options]) => options.search === "")).toBe(true);
  });

  it("narrows branches by their actual company, including owners with no memberships", async () => {
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.changeCompany(COMPANY_A));
    expect(result.current.branchOptions.map((option) => option.label)).toEqual([
      en.trade.scopeAllBranches, "Cairo",
    ]);
    act(() => result.current.changeBranch(BRANCH_B));
    expect(result.current.context.branchId).toBeNull();
    act(() => result.current.changeBranch(BRANCH_A));
    expect(result.current.branchLabel).toBe("Cairo");
    act(() => result.current.setBranchSearch(" CAI "));
    expect(result.current.branchOptions).toHaveLength(2);
    await act(async () => result.current.changeCompany(COMPANY_B));
    expect(result.current.context.branchId).toBeNull();
    expect(result.current.branchOptions.map((option) => option.label)).toEqual([
      en.trade.scopeAllBranches, "Alexandria",
    ]);
    expect(directoryReads()).toHaveLength(2);
    expect(fetchNodes).toHaveBeenCalledWith("branches", expect.objectContaining({ parentId: COMPANY_B }));
  });

  it("loads pages after the first before offering local search results", async () => {
    fetchNodes.mockImplementation(async (level, options) => ({
      items: level === "branches" ? branches : options.page === 1 ? [companies[0]] : [companies[1]],
      page: options.page, limit: 100, total: 2, totalPages: level === "companies" ? 2 : 1,
      hasNext: level === "companies" && options.page === 1, hasPrev: options.page > 1,
    }) as Awaited<ReturnType<typeof fetchOrgNodes>>);
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setCompanySearch("Alpha"));
    expect(result.current.companyOptions[0]?.label).toBe("Alpha Trading");
    expect(directoryReads()).toHaveLength(3);
    expect(fetchNodes).toHaveBeenCalledWith("companies", expect.objectContaining({ page: 2, search: "" }));
  });

  it("drops cached names as soon as the authenticated session changes", async () => {
    const { result, rerender } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    fetchNodes.mockImplementation(() => new Promise(() => {}));
    fixture.generation = "session-2";
    rerender();
    expect(result.current.companyOptions).toHaveLength(0);
    expect(result.current.branchOptions).toHaveLength(1);
    expect(result.current.isLoading).toBe(true);
  });

  it("does not request organization lists without their read permissions", async () => {
    fixture.owner = false;
    const { result } = renderHook(useSubject, { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canReadCompanies).toBe(false);
    expect(result.current.canReadBranches).toBe(false);
    expect(fetchNodes).not.toHaveBeenCalled();
  });

  it.each([{ lang: "en", t: en }, { lang: "ar", t: ar }])(
    "renders named, searchable selectors with keyboard selection in $lang", async ({ lang, t }) => {
      fixture.t = t;
      fixture.lang = lang;
      render(<TradeScopeProvider><PriceBookScopeBar /></TradeScopeProvider>);
      const company = screen.getByRole("button", { name: t.trade.scopeCompany });
      expect(company).not.toHaveClass("font-mono");
      await waitFor(() => expect(company).toHaveTextContent("Alpha Trading"));
      fireEvent.click(company);
      await screen.findByRole("option", { name: "Alpha Trading" });
      expect(screen.queryByRole("option", { name: /All companies|كل الشركات/ })).toBeNull();
      const search = screen.getByRole("combobox", { name: t.trade.scopeSearchCompanies });
      fireEvent.change(search, { target: { value: "Alpha" } });
      await waitFor(() => expect(screen.queryByRole("option", { name: "Beta Trading" })).toBeNull());
      fireEvent.keyDown(search, { key: "ArrowDown" });
      fireEvent.keyDown(search, { key: "Enter" });
      expect(company).toHaveTextContent("Alpha Trading");
      const branch = screen.getByRole("button", { name: t.trade.scopeBranch });
      expect(branch).toHaveTextContent(t.trade.scopeAllBranches);
      fireEvent.click(branch);
      await screen.findByRole("option", { name: "Cairo" });
      expect(screen.queryByRole("option", { name: "Alexandria" })).toBeNull();
      expect(screen.getAllByRole("option")[0]).toHaveTextContent(t.trade.scopeAllBranches);
      expect(directoryReads()).toHaveLength(2);
    },
  );
});
