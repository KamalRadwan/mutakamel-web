// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { SerialsWorkspace } from "./SerialsWorkspace";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
const openSerial = vi.fn();
let forbidden = false;
let stale = false;
const id = (value: number) => `019f2200-0000-7000-8000-${String(value).padStart(12, "0")}`;
const items = ["ON_HAND", "RESERVED", "DELIVERED", "VOIDED"].map((state, index) => ({
  id: id(index + 1), itemId: id(50), itemCompanyProfileId: id(51), serialKey: `DS22-014${index}`,
  state, currentFulfillmentNodeId: index < 2 ? id(52) : null, currentUomId: id(53), currentReservationId: null,
  lastTransitionAt: "2026-11-03T08:42:00Z", version: 1,
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: ["trade.inventory.read"] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }) }));
vi.mock("@/design-system", async (importOriginal) => ({ ...await importOriginal<typeof import("@/design-system")>(), PageHeader: () => null }));
vi.mock("@/components/tenant/TenantBranchSelect", () => ({ TenantBranchSelect: () => null }));
vi.mock("../../components/InventoryModuleSubnav", () => ({ InventoryModuleSubnav: () => null }));
vi.mock("../../components/InventoryListPagination", () => ({ InventoryListPagination: () => null }));
vi.mock("./SerialLifecycleModal", () => ({ SerialLifecycleModal: () => null }));
vi.mock("../hooks/useInventorySerials", () => ({ useInventorySerials: () => ({
  t: dictionaries[language], lang: language, canRead: true, isScopeResolved: true, branchIds: [], branchId: null,
  selectBranch: vi.fn(), items, draft: { serialKey: "", itemId: "", profileId: "", state: undefined }, filters: {},
  view: "table", setView: vi.fn(), setFilter: vi.fn(), applyFilters: vi.fn(), clearFilters: vi.fn(),
  validationError: null, isLoading: false, isRefreshing: false, isStale: stale,
  errorMessage: dictionaries[language].tradeInventory.serialsLoadFailed,
  queryError: forbidden ? { status: 403, message: "Forbidden" } : stale ? { status: 500, message: "Private server diagnostic" } : null,
  pagination: { page: 1, limit: 50, total: 4 }, setPage: vi.fn(), reload: vi.fn(), openSerial, closeSerial: vi.fn(),
  references: { items: [], canCatalog: true, isLoading: false, error: null, searchItems: vi.fn(),
    itemLabel: () => "Zebra DS2208 Scanner · SCN-DS2208", nodeLabel: () => "Cairo Main Warehouse · CAI-WH-01", uomLabel: () => "Piece · PCE" },
}) }));

afterEach(() => { cleanup(); language = "en"; forbidden = false; stale = false; openSerial.mockReset(); });

describe.each(["ar", "en"] as const)("serial registry (%s)", (locale) => {
  it("keeps rows with a localized stale notice after refresh fails", () => {
    language = locale; stale = true;
    render(<TooltipProvider><SerialsWorkspace /></TooltipProvider>);
    expect(screen.getByText(dictionaries[locale].tradeInventory.readViews.staleResults)).toBeInTheDocument();
    expect(screen.getByText("DS22-0140")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: dictionaries[locale].common.retry })).toBeInTheDocument();
    expect(screen.queryByText("Private server diagnostic")).not.toBeInTheDocument();
  });
  it("shows human names and no current custody for delivered or voided units", () => {
    language = locale;
    const { container } = render(<TooltipProvider><SerialsWorkspace /></TooltipProvider>);
    expect(screen.getAllByText(dictionaries[locale].tradeInventory.serialNoCustody)).toHaveLength(2);
    expect(screen.getAllByText("Cairo Main Warehouse · CAI-WH-01")).toHaveLength(2);
    expect(screen.getAllByText("Zebra DS2208 Scanner · SCN-DS2208")).toHaveLength(4);
    expect(container.textContent).not.toContain(id(50));
    expect(container.querySelector("aside")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: dictionaries[locale].tradeInventory.readViews.viewLifecycle })[2]);
    expect(openSerial).toHaveBeenCalledWith(id(3));
  });

  it("renders server permission refusal as an access boundary, not an empty registry", () => {
    language = locale;
    forbidden = true;
    render(<TooltipProvider><SerialsWorkspace /></TooltipProvider>);
    expect(screen.getByText(dictionaries[locale].permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText("DS22-0140")).not.toBeInTheDocument();
  });
});
