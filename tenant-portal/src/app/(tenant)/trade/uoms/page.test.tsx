// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { I18nProvider } from "@/i18n/I18nContext";
import type { Uom } from "./uom-contract";

const SAMPLE_ITEMS: Uom[] = [
  {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    code: "PCS",
    displayName: "Piece",
    localizedNames: { ar: "قطعة", en: "Piece" },
    status: "ACTIVE",
    version: 1,
    updatedAt: "2026-08-31T09:00:00.000Z",
  },
  {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    code: "CTN-24",
    displayName: "Carton of 24",
    localizedNames: { ar: "كرتونة 24", en: "Carton of 24", fr: "Carton de 24" },
    status: "RETIRED",
    version: 2,
    updatedAt: "2026-08-31T10:00:00.000Z",
  },
];

const mockUseUoms = vi.fn();

vi.mock("./hooks/useUoms", () => ({
  useUoms: () => mockUseUoms(),
}));

vi.mock("../TradeScopeBar", () => ({
  TradeScopeBar: () => <div data-testid="trade-scope-bar" />,
}));

vi.mock("@/design-system", async () => {
  const actual = await vi.importActual<typeof import("@/design-system")>(
    "@/design-system",
  );
  return {
    ...actual,
    PermissionGate: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

import TradeUomsPage from "./page";

afterEach(cleanup);

function buildHookState(overrides: Record<string, unknown> = {}) {
  return {
    t: ar,
    lang: "ar" as const,
    canManage: true,
    operatingScopeGap: null,
    items: SAMPLE_ITEMS,
    pageInfo: { page: 1, limit: 50, total: 2 },
    statusFilter: undefined,
    search: "",
    isLoading: false,
    isRefreshing: false,
    isSubmitting: false,
    queryError: null,
    formError: null,
    isCodeTaken: false,
    createOpen: false,
    createInitialMode: "custom" as const,
    editing: null,
    retiring: null,
    reactivating: null,
    retireBlocked: null,
    conflict: null,
    operatingPurpose: "ANY" as const,
    operatingItems: [
      {
        id: "01890a5d-ac96-774b-bcce-b302099a8057",
        code: "PCS",
        displayName: "Piece",
        isBaseUom: true,
        isDefaultSalesUom: true,
        canSell: true,
        canPurchase: true,
        sourceItemCount: 8,
      },
    ],
    isOperatingLoading: false,
    operatingError: null,
    setPage: vi.fn(),
    setStatusFilter: vi.fn(),
    setSearch: vi.fn(),
    setOperatingPurpose: vi.fn(),
    loadOperating: vi.fn(),
    openCreate: vi.fn(),
    closeCreate: vi.fn(),
    openEdit: vi.fn(),
    closeEdit: vi.fn(),
    openRetire: vi.fn(),
    closeRetire: vi.fn(),
    openReactivate: vi.fn(),
    closeReactivate: vi.fn(),
    dismissRetireBlocked: vi.fn(),
    dismissConflict: vi.fn(),
    resolveConflict: vi.fn(),
    create: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    retire: vi.fn().mockResolvedValue(undefined),
    reactivate: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <I18nProvider>
      <TooltipProvider>
        <TradeUomsPage />
      </TooltipProvider>
    </I18nProvider>,
  );
}

describe("TradeUomsPage", () => {
  it("keeps the master directory available when the operating catalogue needs a company", () => {
    mockUseUoms.mockReturnValue(buildHookState({ operatingScopeGap: "company-required" }));
    renderPage();

    expect(screen.getAllByText("PCS").length).toBeGreaterThan(0);
    expect(screen.queryByText(ar.trade.scopeRequiredTitle)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.trade.uomViewOperating }));
    expect(screen.getByText(ar.trade.scopeRequiredTitle)).toBeInTheDocument();
    expect(screen.queryByText(ar.trade.uomOperatingBaseBadge)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.trade.uomViewTable }));
    expect(screen.getAllByText("PCS").length).toBeGreaterThan(0);
  });

  it("renders KPI strip, 9-category filter pills, and full-width directory table", () => {
    mockUseUoms.mockReturnValue(buildHookState());
    renderPage();

    expect(screen.getByText(ar.trade.uomKpiTotalTitle)).toBeInTheDocument();
    expect(screen.getByText(ar.trade.uomKpiActiveTitle)).toBeInTheDocument();
    expect(screen.queryByText(ar.trade.uomInspectorTitle)).not.toBeInTheDocument();
    expect(screen.getAllByText("PCS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CTN-24").length).toBeGreaterThan(0);
  });

  it("switches between Directory Table, Category Cards Grid, and Operating Catalogue views", () => {
    mockUseUoms.mockReturnValue(buildHookState());
    renderPage();

    // Switch to Category Cards view
    fireEvent.click(screen.getByRole("button", { name: ar.trade.uomViewCards }));
    expect(screen.getAllByText("CTN-24").length).toBeGreaterThan(0);

    // Switch to Operating Catalogue view
    fireEvent.click(
      screen.getByRole("button", { name: ar.trade.uomViewOperating }),
    );
    expect(screen.getByText(ar.trade.uomOperatingBaseBadge)).toBeInTheDocument();
    expect(screen.getByText(ar.trade.uomOperatingSalesBadge)).toBeInTheDocument();
  });

  it("renders the Retire Blocked reference protection alert when a 409 UOM_RETIRE_REFERENCED occurs", () => {
    mockUseUoms.mockReturnValue(
      buildHookState({ retireBlocked: SAMPLE_ITEMS[0] }),
    );
    renderPage();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(ar.trade.uomRetireBlockedTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(ar.trade.uomRetireBlockedItemMaster),
    ).toBeInTheDocument();
  });
});
