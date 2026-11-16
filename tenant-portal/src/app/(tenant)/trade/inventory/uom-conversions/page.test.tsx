// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import UomConversionsPage from "./page";
let language: "ar" | "en" = "en";
let queryFailure: NormalizedApiError | null = null;
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: "ltr" }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(), PageHeader: () => null,
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/tenant/TenantBranchSelect", () => ({ TenantBranchSelect: () => null }));
vi.mock("../components/InventoryModuleSubnav", () => ({ InventoryModuleSubnav: () => null }));
vi.mock("../components/InventoryListPagination", () => ({ InventoryListPagination: () => null }));
vi.mock("./components/CreateUomConversionModal", () => ({ CreateUomConversionModal: () => null }));
vi.mock("./hooks/useUomConversions", () => ({ useUomConversions: () => ({
  t: dictionaries[language], lang: language, canRead: true, canManage: false, isScopeResolved: true, actorLabel: () => "—",
  branchIds: [], branchId: null, selectBranch: vi.fn(),
  references: { items: [], uoms: [], canCatalog: true, isLoading: false, searchItems: vi.fn(), profileLabel: () => "USB cable", uomLabel: () => "Pieces" },
  filters: {}, setFilters: vi.fn(), items: [{ id: "01902001-3000-7000-8000-000000000001", itemCompanyProfileId: "01902001-3000-7000-8000-000000000002",
    fromUomId: "01902001-3000-7000-8000-000000000003", toUomId: "01902001-3000-7000-8000-000000000004", factorNumerator: "7", factorDenominator: "9", status: "PUBLISHED", revisionNumber: 1, version: 1, effectiveFrom: "2026-10-31T00:00:00Z" }],
  pagination: { page: 1, limit: 50, total: 1 }, setPage: vi.fn(), statusFilter: undefined, isLoading: false, isRefreshing: false,
  queryError: queryFailure, hasLoaded: true, createOpen: false, isSubmitting: false, formError: null, pending: null, transition: null, transitionError: null,
  setStatusFilter: vi.fn(), openCreate: vi.fn(), closeCreate: vi.fn(), openTransition: vi.fn(), closeTransition: vi.fn(), create: vi.fn(), runTransition: vi.fn(), reload: vi.fn(),
}) }));
afterEach(() => { cleanup(); language = "en"; queryFailure = null; });
describe.each(["ar", "en"] as const)("Exact inventory quantity preview (%s)", (lang) => {
  it("rejects nonrepresentable and invalid quantities, then recovers without rounding", () => {
    language = lang;
    render(<TooltipProvider><UomConversionsPage /></TooltipProvider>);
    const copy = dictionaries[lang].tradeInventory;
    fireEvent.click(screen.getByRole("button", { name: copy.conversionInspect }));
    const input = screen.getByLabelText(copy.conversionInputQuantity);
    expect(screen.getByText(copy.conversionExactPrecision)).toHaveTextContent(copy.conversionExactPrecision);
    expect(screen.queryByText("7.7778")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "9" } });
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(copy.conversionExactPrecision)).not.toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});

it("keeps the last successful rows with a localized stale notice after a refresh failure", () => {
  language = "ar"; queryFailure = normalizeApiError(new Error("RAW TRANSPORT ENGLISH"));
  render(<TooltipProvider><UomConversionsPage /></TooltipProvider>);
  expect(screen.getByText("USB cable")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(ar.tradeInventory.governanceStaleList);
  expect(screen.queryByText("RAW TRANSPORT ENGLISH")).not.toBeInTheDocument();
});

