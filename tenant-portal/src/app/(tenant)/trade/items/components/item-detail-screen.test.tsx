// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ItemDetailScreen } from "./item-detail-screen";

const { standardCost } = vi.hoisted(() => ({ standardCost: vi.fn() }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../TradeScopeBar", () => ({ TradeScopeBar: () => null }));
vi.mock("./ItemIdentityDetails", () => ({ ItemIdentityDetails: () => <div>Identity</div> }));
vi.mock("./ItemImageManager", () => ({ ItemImageManager: () => null }));
vi.mock("./ItemStandardCostSection", () => ({
  ItemStandardCostSection: (props: unknown) => {
    standardCost(props);
    return <div>Protected cost</div>;
  },
}));
vi.mock("./ItemProfileDrawers", () => ({
  CompanyProfileDrawer: () => null,
  BranchProfileDrawer: () => null,
  ListingDrawer: () => null,
}));

const ITEM_ID = "0192f3a0-0000-7000-8000-000000000003";
const item = {
  id: ITEM_ID,
  canonicalCode: "SKU-1",
  itemKind: "SERVICE",
  baseUomId: "0192f3a0-0000-7000-8000-000000000004",
  localizedNames: { en: "Service" },
  categoryId: null,
  categorySummary: null,
  variantIdentity: null,
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
  version: 1,
  updatedAt: "2026-09-27T09:00:00.000Z",
  eligibility: null,
};

vi.mock("../hooks/useItemDetail", () => ({
  useItemDetail: () => ({
    t: en,
    lang: "en",
    detail: { item, companyProfile: null, branchProfile: null },
    isLoading: false,
    error: null,
    isGone: false,
    reload: vi.fn(),
  }),
}));

vi.mock("../hooks/useItemProfiles", () => ({
  useItemProfiles: () => ({
    canManage: true,
    companyScopeGap: false,
    branchScopeGap: false,
    companyOpen: false,
    branchOpen: false,
    isSubmitting: false,
    companyFormError: null,
    branchFormError: null,
    openCompany: vi.fn(),
    openBranch: vi.fn(),
    closeCompany: vi.fn(),
    closeBranch: vi.fn(),
    saveCompanyProfile: vi.fn(),
    saveBranchProfile: vi.fn(),
  }),
}));

vi.mock("../hooks/useItemListings", () => ({
  useItemListings: () => ({
    canManage: false,
    scopeGap: true,
    isLoading: false,
    error: null,
    listings: [],
    pageInfo: { page: 1, limit: 50, total: 0 },
    editing: null,
    createOpen: false,
    isSubmitting: false,
    formError: null,
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    closeCreate: vi.fn(),
    closeEdit: vi.fn(),
    save: vi.fn(),
    reload: vi.fn(),
    setPage: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  standardCost.mockClear();
});

describe("ItemDetailScreen company bootstrap", () => {
  it("offers the first company profile while withholding branch profile and protected cost", () => {
    render(<ItemDetailScreen id={ITEM_ID} />);

    expect(screen.getByRole("button", { name: en.trade.companyProfileCreate })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.trade.branchProfileCreate })).toBeNull();
    expect(screen.getByText(en.trade.branchProfileRequiresCompany)).toBeInTheDocument();
    expect(standardCost).not.toHaveBeenCalled();
  });
});
