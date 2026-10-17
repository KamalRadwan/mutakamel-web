// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ItemIdentityDetails } from "./ItemIdentityDetails";
import type { Item } from "../item-contract";

const { tradePatchMock, toastSuccessMock } = vi.hoisted(() => ({
  tradePatchMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: vi.fn(),
    errorFromApi: vi.fn(),
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { isTenantOwner: true, permissions: [] },
  }),
}));

vi.mock("../../useTradeWrite", () => ({
  useTradeWrite: () => async (fn: () => Promise<unknown>) => ({
    ok: true,
    replayed: false,
    data: await fn(),
  }),
}));

vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradePatch: (...args: unknown[]) => tradePatchMock(...args),
}));

vi.mock("../hooks/useActiveUoms", () => ({
  useActiveUoms: () => ({
    options: [
      {
        id: "0192f3a0-0000-7000-8000-000000000004",
        code: "EA",
        displayName: "Each",
        localizedNames: { en: "Each", ar: "قطعة" },
        status: "ACTIVE",
        version: 1,
        updatedAt: "2026-09-27T09:00:00.000Z",
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../hooks/useItemReferenceData", () => ({
  useItemReferenceData: () => ({
    owners: [
      { id: "0192f3a0-0000-7000-8000-000000000099", label: "Sara Al-Mansoor · Merchandising" },
    ],
    taxes: [],
    loadingOwners: false,
    loadingTaxes: false,
  }),
}));

vi.mock("../hooks/useItemReferenceOptions", () => ({
  useItemReferenceOptions: () => ({
    options: [],
    isLoading: false,
  }),
}));

vi.mock("../../categories/components/CategoryPicker", () => ({
  CategoryPicker: () => <div data-testid="category-picker">Category Picker</div>,
}));

vi.mock("./ItemRelationsFields", () => ({
  ItemRelationsFields: () => <div data-testid="item-relations-fields">Relations Fields</div>,
}));

const sampleItem: Item = {
  id: "0192f3a0-0000-7000-8000-000000000003",
  canonicalCode: "SKU-10420",
  itemKind: "STOCKABLE",
  baseUomId: "0192f3a0-0000-7000-8000-000000000004",
  localizedNames: { en: "Industrial Espresso Grinder Pro", ar: "طاحونة إسبريسو صناعية برو" },
  categoryId: "0192f3a0-0000-7000-8000-000000000010",
  categorySummary: {
    id: "0192f3a0-0000-7000-8000-000000000010",
    code: "EQUIP-COFFEE",
    name: "Coffee Equipment",
    path: [
      {
        id: "0192f3a0-0000-7000-8000-000000000010",
        code: "EQUIP-COFFEE",
        name: "Coffee Equipment",
      },
    ],
    effectiveActive: true,
    treeVersion: 1,
  },
  variantIdentity: { voltage: "220V", burrSizeMm: "83" },
  barcode: "6281000492814",
  notes: "Commercial heavy-duty grinder.",
  ownerUserId: "0192f3a0-0000-7000-8000-000000000099",
  weightKg: "18.400",
  volumeM3: "0.084",
  quotationDescription: "Quotation copy",
  salesOrderDescription: "Sales order copy",
  receiptDescription: "Receipt copy",
  deliveryOrderDescription: "Delivery copy",
  comboComponents: [],
  optionalProducts: [],
  status: "ACTIVE",
  version: 4,
  updatedAt: "2026-09-27T09:00:00.000Z",
  eligibility: null,
  image: null,
};

afterEach(() => {
  cleanup();
  tradePatchMock.mockReset();
  toastSuccessMock.mockReset();
});

describe("ItemIdentityDetails simultaneous view & inline edit workspace", () => {
  it("renders resolved Base UoM, variant attribute chips, and interactive status stages", () => {
    render(<ItemIdentityDetails item={sampleItem} />);

    expect(screen.getByText("EA")).toBeInTheDocument();
    expect(screen.getByText("Each")).toBeInTheDocument();
    expect(screen.getByText("voltage: 220V")).toBeInTheDocument();
    expect(screen.getByText("burrSizeMm: 83")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Industrial Espresso Grinder Pro")).toBeInTheDocument();
    expect(screen.getByDisplayValue("6281000492814")).toBeInTheDocument();
  });

  it("tracks dirty fields inline, shows Save/Discard controls, and submits PATCH with If-Match", async () => {
    const onSaved = vi.fn();
    tradePatchMock.mockResolvedValueOnce(sampleItem);

    render(<ItemIdentityDetails item={sampleItem} onSaved={onSaved} />);

    // Initially not dirty: Save button should not be rendered
    expect(screen.queryByRole("button", { name: en.trade.save })).toBeNull();

    // Edit English name and Weight inline (18.400 normalizes to 18.40; >2 significant decimals like 0.084 stay 0.084)
    expect(screen.getByDisplayValue("0.084")).toBeInTheDocument();
    const enInput = screen.getByDisplayValue("Industrial Espresso Grinder Pro");
    fireEvent.change(enInput, { target: { value: "Industrial Espresso Grinder Pro X2" } });

    const weightInput = screen.getByDisplayValue("18.40");
    fireEvent.change(weightInput, { target: { value: "19.250" } });

    // Save button appears
    const saveBtn = screen.getByRole("button", { name: en.trade.save });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(tradePatchMock).toHaveBeenCalledTimes(1);
    });

    expect(tradePatchMock).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/items/${sampleItem.id}`,
      expect.objectContaining({
        localizedNames: {
          en: "Industrial Espresso Grinder Pro X2",
          ar: "طاحونة إسبريسو صناعية برو",
        },
        weightKg: "19.25",
      }),
      { headers: { "if-match": '"4"' } },
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith(en.trade.savedTitle, en.trade.savedDescription);
  });

  it("discards inline modifications when Cancel is clicked", () => {
    render(<ItemIdentityDetails item={sampleItem} />);

    const barcodeInput = screen.getByDisplayValue("6281000492814");
    fireEvent.change(barcodeInput, { target: { value: "9999999999999" } });
    expect(screen.getByDisplayValue("9999999999999")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: en.common.cancel });
    fireEvent.click(cancelBtn);

    expect(screen.getByDisplayValue("6281000492814")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.trade.save })).toBeNull();
  });
});
