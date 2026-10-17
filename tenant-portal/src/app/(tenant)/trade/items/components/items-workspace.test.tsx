// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TooltipProvider } from "@/design-system";
import { TradeScopeProvider } from "../../useTradeScope";
import { ItemsWorkspace } from "./items-workspace";

const { get, post, patch, auth, toast, write, push } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  auth: vi.fn(),
  toast: { success: vi.fn(), errorFromApi: vi.fn() },
  write: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => toast,
  useRealtimeResync: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/trade/items",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push }),
}));
vi.mock("@/i18n/useLanguage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/useLanguage")>()),
  useDictionary: () => en,
}));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: get,
  tradePost: post,
  tradePatch: patch,
  tradeIfMatch: (v: number) => `"${v}"`,
  CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id",
}));
vi.mock("../../useTradeWrite", () => ({ useTradeWrite: () => write }));

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";

const PRODUCT_ITEM = {
  id: "0192f3a0-0000-7000-8000-000000000011",
  canonicalCode: "SKU-10420",
  itemKind: "PRODUCT",
  baseUomId: "0192f3a0-0000-7000-8000-000000000004",
  localizedNames: {
    en: "Industrial Espresso Grinder Pro",
    ar: "طاحونة إسبريسو صناعية برو",
  },
  categoryId: "0192f3a0-0000-7000-8000-000000000021",
  categorySummary: {
    id: "0192f3a0-0000-7000-8000-000000000021",
    code: "CAT-COFFEE",
    name: "Coffee Equipment",
    effectiveActive: true,
    treeVersion: 1,
    path: [
      {
        id: "0192f3a0-0000-7000-8000-000000000021",
        code: "CAT-COFFEE",
        name: "Coffee Equipment",
      },
    ],
  },
  variantIdentity: { voltage: "220V", burr: "83mm" },
  barcode: "6281000492014",
  notes: "Flagship grinder",
  ownerUserId: null,
  weightKg: "18.4",
  volumeM3: "0.084",
  quotationDescription: "Commercial grinder",
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  comboComponents: [],
  optionalProducts: [],
  status: "ACTIVE",
  version: 4,
  updatedAt: "2026-10-16T09:00:00.000Z",
  eligibility: {
    companyProfileId: "0192f3a0-0000-7000-8000-000000000031",
    companyProfileVersion: 2,
    companyProfileStatus: "ACTIVE",
    canSell: true,
    canPurchase: true,
    canPos: true,
    baseUomId: "0192f3a0-0000-7000-8000-000000000004",
    defaultSalesUomId: "0192f3a0-0000-7000-8000-000000000004",
    defaultPurchaseUomId: "0192f3a0-0000-7000-8000-000000000004",
    branchProfileId: "0192f3a0-0000-7000-8000-000000000041",
    branchProfileVersion: 1,
    isAssorted: true,
  },
};

const SERVICE_ITEM = {
  id: "0192f3a0-0000-7000-8000-000000000012",
  canonicalCode: "SVC-INSTALL-PRO",
  itemKind: "SERVICE",
  baseUomId: "0192f3a0-0000-7000-8000-000000000004",
  localizedNames: {
    en: "On-Site Barista Calibration",
    ar: "خدمة التركيب والمعايرة",
  },
  categoryId: "0192f3a0-0000-7000-8000-000000000022",
  categorySummary: {
    id: "0192f3a0-0000-7000-8000-000000000022",
    code: "CAT-SVC",
    name: "Field Maintenance",
    effectiveActive: false,
    treeVersion: 1,
    path: [
      {
        id: "0192f3a0-0000-7000-8000-000000000022",
        code: "CAT-SVC",
        name: "Field Maintenance",
      },
    ],
  },
  variantIdentity: { tier: "SLA 4h" },
  barcode: null,
  notes: null,
  ownerUserId: null,
  weightKg: null,
  volumeM3: null,
  quotationDescription: null,
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  comboComponents: [],
  optionalProducts: [],
  status: "DRAFT",
  version: 2,
  updatedAt: "2026-10-15T09:00:00.000Z",
  eligibility: null,
};

const COMBO_ITEM = {
  id: "0192f3a0-0000-7000-8000-000000000013",
  canonicalCode: "CMB-CAFE-START",
  itemKind: "COMBO",
  baseUomId: "0192f3a0-0000-7000-8000-000000000004",
  localizedNames: {
    en: "Specialty Cafe Launch Bundle",
  },
  categoryId: null,
  categorySummary: null,
  variantIdentity: { edition: "2026 Q4" },
  barcode: null,
  notes: null,
  ownerUserId: null,
  weightKg: "74.5",
  volumeM3: null,
  quotationDescription: null,
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  comboComponents: [
    {
      componentItemId: "0192f3a0-0000-7000-8000-000000000011",
      quantity: "2",
      sortOrder: 0,
    },
  ],
  optionalProducts: [],
  status: "DISCONTINUED",
  version: 7,
  updatedAt: "2026-10-14T09:00:00.000Z",
  eligibility: null,
};

const page = (items: unknown[] = [PRODUCT_ITEM, SERVICE_ITEM, COMBO_ITEM]) => ({
  data: { items, total: items.length, page: 1, limit: 25 },
});

const session = () => ({
  user: {
    id: COMPANY,
    isTenantOwner: true,
    permissions: ["trade.items.read", "trade.catalog_master.manage"],
    accessibleCompanies: [COMPANY],
    accessibleBranches: [BRANCH],
    teamMemberships: [],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.mockReturnValue(session());
  get.mockImplementation(async (path: string) => {
    if (path.endsWith("/channels")) return { data: [] };
    if (path.endsWith(`/items/${PRODUCT_ITEM.id}`)) return { data: PRODUCT_ITEM };
    return page();
  });
  post.mockResolvedValue(page());
  write.mockImplementation(async (request: () => Promise<unknown>) => {
    await request();
    return { ok: true, replayed: false, error: null };
  });
});

afterEach(cleanup);

describe("ItemsWorkspace compact Start Pic + Content design", () => {
  it("renders compact Start Pic + Content cards by default with dual-language names, micro badges, Key-Value variant chips, and eligibility", async () => {
    render(
      <TooltipProvider>
        <TradeScopeProvider>
          <ItemsWorkspace />
        </TradeScopeProvider>
      </TooltipProvider>,
    );

    expect(await screen.findByText("Industrial Espresso Grinder Pro")).toBeVisible();
    expect(screen.getByText("طاحونة إسبريسو صناعية برو")).toBeVisible();
    expect(screen.queryByText("SKU-10420")).toBeNull();
    expect(screen.queryByText("v4")).toBeNull();

    // Key-Value variant chips (never raw JSON)
    expect(screen.getByText("voltage: 220V")).toBeVisible();
    expect(screen.getByText("burr: 83mm")).toBeVisible();
    expect(screen.getByText("tier: SLA 4h")).toBeVisible();
    expect(screen.getByText("edition: 2026 Q4")).toBeVisible();
    expect(screen.getByText("1 SKU")).toBeVisible();

    // Category summary and No category fallback
    expect(screen.getByText("Coffee Equipment")).toBeVisible();
    expect(screen.getByText("Field Maintenance")).toBeVisible();
    expect(screen.getByText(en.trade.categories.none)).toBeVisible();

    // Eligibility & branch assortment badges
    expect(screen.getByText(en.trade.canSell)).toBeVisible();
    expect(screen.getByText(en.trade.canPurchase)).toBeVisible();
    expect(screen.getByText(en.trade.canPos)).toBeVisible();
    expect(screen.getByText(en.trade.isAssorted)).toBeVisible();
  });

  it("filters by itemKind and status when clicking the interactive KPI summary cards", async () => {
    render(
      <TooltipProvider>
        <TradeScopeProvider>
          <ItemsWorkspace />
        </TradeScopeProvider>
      </TooltipProvider>,
    );

    await screen.findByText("Industrial Espresso Grinder Pro");
    get.mockClear();

    // Click the Service KPI card
    const serviceKpi = screen
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-pressed") !== null && el.textContent?.includes(en.trade.itemKind_SERVICE));
    expect(serviceKpi).toBeDefined();
    fireEvent.click(serviceKpi!);

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        expect.stringContaining("itemKind=SERVICE"),
        expect.anything(),
      ),
    );
  });

  it("renders Table view with thumbnails, Key-Value variant chips, and opens EditItemDrawer on quick edit", async () => {
    localStorage.setItem("tenant_view_trade-items", "table");
    render(
      <TooltipProvider>
        <TradeScopeProvider>
          <ItemsWorkspace />
        </TradeScopeProvider>
      </TooltipProvider>,
    );

    expect(await screen.findByText("Industrial Espresso Grinder Pro")).toBeVisible();
    expect(screen.getByText("SKU-10420")).toBeVisible();
    expect(screen.getByText("voltage: 220V")).toBeVisible();

    const editButtons = screen.getAllByRole("button", { name: en.trade.itemEditTitle });
    fireEvent.click(editButtons[0]!);

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByDisplayValue("Industrial Espresso Grinder Pro")).toBeVisible();
  });

  it("omits verbose descriptions, V2 badge, Active badge, and fallback footer on minimal active cards while styling deactivated cards distinctly", async () => {
    const minimalActiveItem = {
      ...PRODUCT_ITEM,
      id: "0192f3a0-0000-7000-8000-000000000099",
      canonicalCode: "HP-Z220-D-WS",
      localizedNames: { en: "HP Z220 Desktop Workstation" },
      variantIdentity: null,
      barcode: null,
      notes: null,
      quotationDescription: null,
      eligibility: null,
      status: "ACTIVE",
      version: 2,
    };
    const deactivatedItem = {
      ...PRODUCT_ITEM,
      id: "0192f3a0-0000-7000-8000-000000000098",
      canonicalCode: "HP-LEGACY-01",
      localizedNames: { en: "Legacy Server Node" },
      variantIdentity: null,
      barcode: null,
      notes: null,
      quotationDescription: null,
      eligibility: null,
      status: "INACTIVE",
      version: 3,
    };
    get.mockImplementation(async (path: string) =>
      path.endsWith("/channels") ? { data: [] } : page([minimalActiveItem, deactivatedItem]),
    );

    render(
      <TooltipProvider>
        <TradeScopeProvider>
          <ItemsWorkspace />
        </TradeScopeProvider>
      </TooltipProvider>,
    );

    expect(await screen.findByText("HP Z220 Desktop Workstation")).toBeVisible();
    expect(screen.queryByText("HP-Z220-D-WS")).toBeNull();
    expect(screen.queryByText(en.trade.itemKindDesc_PRODUCT)).toBeNull();
    expect(screen.queryByText("v2")).toBeNull();
    expect(screen.queryByText("sku: HP-Z220-D-WS")).toBeNull();
    expect(screen.queryByText("lang: EN")).toBeNull();
    expect(screen.getByText(en.trade.itemStatus_INACTIVE)).toBeVisible();
  });
});


