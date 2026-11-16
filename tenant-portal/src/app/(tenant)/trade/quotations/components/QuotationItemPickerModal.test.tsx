// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { normalizeApiError } from "@/lib/api/errors";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import type { TradeItemOption } from "../../documents/trade-lookup-contract";
import { CATALOG_ITEM, CATALOG_UNIT, ITEM_ID } from "../hooks/quotation-composer.test-fixtures";
import type { QuotationItemPickerState } from "../hooks/useQuotationItemPicker";
import { QuotationItemPickerModal } from "./QuotationItemPickerModal";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);

function draft(): TradeLineDraftState {
  return {
    lines: [],
    items: [],
    itemsById: {},
    uomsByItem: {},
    lookupError: null,
    isLoadingItems: false,
    runningTotal: null,
    invalidLineIndex: null,
    lineErrors: [],
    purpose: "SALES",
    searchItems: vi.fn(),
    addLine: vi.fn(),
    removeLine: vi.fn(),
    setItem: vi.fn(),
    setUom: vi.fn(),
    setQuantity: vi.fn(),
    commitQuantity: vi.fn(),
    reset: vi.fn(),
    appendItems: vi.fn(),
    ensureItemUoms: vi.fn(async () => []),
    retryLookups: vi.fn(),
    restore: vi.fn(),
  };
}

function picker(): QuotationItemPickerState {
  return {
    open: true,
    setOpen: vi.fn(),
    rows: [],
    pricing: { ready: false, prices: [] },
    total: null,
    search: "",
    canAdd: false,
    capacity: true,
    searchItems: vi.fn(),
    retry: vi.fn(),
    toggle: vi.fn(),
    update: vi.fn(),
    add: vi.fn(),
    reviewSelection: false,
    toggleReview: vi.fn(),
    toggleVisible: vi.fn(),
  };
}

describe("quotation catalogue read boundary and dense picker", () => {
  it("distinguishes an unavailable catalogue from unavailable prices and a successful empty search", () => {
    const state = { ...draft(), lookupError: normalizeApiError(new Error("catalogue lookup failed")) };
    const selection = { ...picker(), search: "valve" };
    render(<QuotationItemPickerModal picker={selection} draft={state} currencyCode="EGP" />);
    expect(screen.getByText(en.tradeDocuments.lineEditor.lookupUnavailable)).toBeVisible();
    expect(screen.getByDisplayValue("valve")).toBeVisible();
    expect(screen.queryByText(en.quotationExperience.priceUnavailable)).toBeNull();
    expect(screen.queryByText(en.quotationExperience.itemNoResults)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(selection.retry).toHaveBeenCalledOnce();
  });

  it("shows the no-results message only after a successful empty catalogue read", () => {
    render(<QuotationItemPickerModal picker={picker()} draft={draft()} currencyCode="EGP" />);
    expect(screen.getByText(en.quotationExperience.itemNoResults)).toBeVisible();
    expect(screen.queryByText(en.tradeDocuments.lineEditor.lookupUnavailable)).toBeNull();
  });

  it("renders dense rows with independent Description column and closes full description popover on Escape without closing the modal", () => {
    const secondId = "01890000-0000-7000-8000-000000000025";
    const longDesc = `Heavy-duty ${"stainless manifold assembly ".repeat(14)}verified`.slice(0, 360);
    const firstItem: TradeItemOption = {
      ...CATALOG_ITEM,
      localizedNames: { en: "Control Valve" },
      quotationDescription: longDesc,
    };
    const secondItem: TradeItemOption = {
      ...CATALOG_ITEM,
      id: secondId,
      canonicalCode: "SVC-INSTALL",
      itemKind: "SERVICE",
      localizedNames: { en: "On-site Commissioning" },
      quotationDescription: null,
    };
    const state = {
      ...draft(),
      items: [firstItem, secondItem],
      itemsById: { [ITEM_ID]: firstItem, [secondId]: secondItem },
      uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] },
    };
    const selection = picker();

    render(<QuotationItemPickerModal picker={selection} draft={state} currencyCode="EGP" />);

    const table = within(screen.getByRole("table"));
    const headers = table.getAllByRole("columnheader");
    expect(headers.map((cell) => cell.textContent)).toContain(en.coreOperations.templates.description);
    expect(table.queryByRole("columnheader", { name: en.quotationExperience.itemType })).toBeNull();

    expect(table.getByText("Control Valve")).toBeTruthy();
    expect(table.getByText("VALVE-1")).toBeTruthy();
    expect(table.getAllByText("On-site Commissioning")).toHaveLength(2);

    const descTrigger = table.getByRole("button", {
      name: `${en.coreOperations.templates.description}: ${longDesc}`,
    });
    fireEvent.click(descTrigger);

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    const popoverDialog = dialogs.find((node) => node.textContent === longDesc)!;
    expect(popoverDialog).toBeTruthy();

    fireEvent.keyDown(popoverDialog, { key: "Escape" });
    expect(selection.setOpen).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("retains selected items in review mode on lookup error and surfaces UOM, quantity, capacity, and failed-price states without promo claims", () => {
    const noUomItemId = "01890000-0000-7000-8000-000000000026";
    const noUomItem: TradeItemOption = {
      ...CATALOG_ITEM,
      id: noUomItemId,
      canonicalCode: "NO-UOM-1",
      localizedNames: { en: "Unconfigured Sensor" },
      quotationDescription: "Sensor awaiting sales unit setup",
    };
    const state: TradeLineDraftState = {
      ...draft(),
      lookupError: normalizeApiError(new Error("search timeout")),
      itemsById: { [ITEM_ID]: CATALOG_ITEM, [noUomItemId]: noUomItem },
      uomsByItem: { [ITEM_ID]: [CATALOG_UNIT], [noUomItemId]: [] },
    };
    const selection: QuotationItemPickerState = {
      ...picker(),
      reviewSelection: true,
      capacity: false,
      rows: [
        { itemId: ITEM_ID, uomId: CATALOG_UNIT.id, quantity: "2" },
        { itemId: noUomItemId, uomId: "", quantity: "0" },
      ],
      pricing: {
        ready: false,
        prices: [
          { unitPrice: null, isPricing: false },
          { unitPrice: null, isPricing: false },
        ],
      },
    };

    render(<QuotationItemPickerModal picker={selection} draft={state} currencyCode="EGP" />);

    const table = within(screen.getByRole("table"));
    expect(table.getByText("VALVE-1")).toBeTruthy();
    expect(table.getByText("NO-UOM-1")).toBeTruthy();
    expect(table.getByText(en.quotationExperience.priceUnavailable)).toBeTruthy();
    expect(table.getByText(en.quotationExperience.noUnits)).toBeTruthy();
    expect(table.getByText(en.quotationExperience.quantityInvalid)).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationExperience.maxLines);

    expect(screen.queryAllByText(en.quotationDiscount.promotionSavings)).toHaveLength(0);
    expect(screen.queryAllByText(/promotion|promo\b/i)).toHaveLength(0);
  });

  it("shows the live unit price for a pending selection", () => {
    const state = {
      ...draft(),
      items: [CATALOG_ITEM],
      itemsById: { [ITEM_ID]: CATALOG_ITEM },
      uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] },
    };
    const selection: QuotationItemPickerState = {
      ...picker(),
      canAdd: true,
      rows: [{ itemId: ITEM_ID, uomId: CATALOG_UNIT.id, quantity: "3" }],
      pricing: { ready: true, prices: [{ unitPrice: "17.5", isPricing: false }] },
    };

    render(<QuotationItemPickerModal picker={selection} draft={state} currencyCode="EGP" />);

    expect(screen.getByText(en.quotationExperience.previewNote)).toBeVisible();
    expect(within(screen.getByRole("table")).getByText(/17\.50/)).toBeVisible();
    expect(screen.queryByText(en.quotationExperience.priceUnavailable)).toBeNull();
    const addBtn = screen.getByRole("button", { name: "Add 1 items" });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);
    expect(selection.add).toHaveBeenCalledOnce();
  });
});
