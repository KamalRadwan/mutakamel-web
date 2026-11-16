// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import type { TradeLineDraftState } from "../hooks/useTradeLineDraft";
import { useTradeLineDraft } from "../hooks/useTradeLineDraft";
import { TradeLineEditor } from "./TradeLineEditor";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));

const ITEM_ID = "0192f3a0-0000-7000-8000-000000000001";
const UOM_ID = "0192f3a0-0000-7000-8000-000000000002";
const DESCRIPTION = "Quotation-only catalogue description";

const item = {
  id: ITEM_ID,
  canonicalCode: "SKU-001",
  barcode: "6221234567890",
  localizedNames: { en: "Blue widget" },
  quotationDescription: DESCRIPTION,
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  status: "ACTIVE",
  eligibility: {
    companyProfileId: "0192f3a0-0000-7000-8000-000000000003",
    companyProfileVersion: 1,
    companyProfileStatus: "ACTIVE",
    canSell: true,
    canPurchase: false,
    canPos: false,
    baseUomId: UOM_ID,
    defaultSalesUomId: UOM_ID,
    defaultPurchaseUomId: UOM_ID,
    branchProfileId: null,
    branchProfileVersion: null,
    isAssorted: null,
  },
};

function state(): TradeLineDraftState {
  return {
    lines: [
      {
        clientLineId: "0192f3a0-0000-7000-8000-000000000004",
        itemId: ITEM_ID,
        uomId: UOM_ID,
        quantity: "1",
        unitPrice: null,
        isPricing: false,
        priceError: null,
      },
      {
        clientLineId: "0192f3a0-0000-7000-8000-000000000005",
        itemId: "",
        uomId: "",
        quantity: "1",
        unitPrice: null,
        isPricing: false,
        priceError: null,
      },
    ],
    items: [item],
    itemsById: { [ITEM_ID]: item },
    uomsByItem: {
      [ITEM_ID]: [
        {
          id: UOM_ID,
          code: "EA",
          displayName: "Each",
          isBaseUom: true,
          canSell: true,
          canPurchase: true,
        },
      ],
    },
    lookupError: null,
    isLoadingItems: false,
    runningTotal: null,
    invalidLineIndex: null,
    lineErrors: [{}, { item: "ITEM_REQUIRED", uom: "UOM_REQUIRED" }],
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

afterEach(cleanup);

describe("TradeLineEditor", () => {
  it.each(["0.5", "1.25", "10.05", "0.05"])(
    "preserves each typed character of %s and commits the decimal on blur",
    (quantity) => {
      const submitted = vi.fn();
      function Editor() {
        const draft = useTradeLineDraft({}, "EGP", null, "SALES", false);
        return (
          <TooltipProvider>
            <TradeLineEditor state={draft} currencyCode="EGP" disabled={false} />
            <button onClick={() => submitted(draft.lines[0]?.quantity)}>Submit</button>
          </TooltipProvider>
        );
      }
      render(<Editor />);
      const input = screen.getByRole("textbox", { name: en.tradeDocuments.quantity });
      fireEvent.change(input, { target: { value: "" } });
      let typed = "";
      for (const character of quantity) {
        typed += character;
        fireEvent.change(input, { target: { value: (input as HTMLInputElement).value + character } });
        expect(input).toHaveValue(typed);
      }
      fireEvent.blur(input);
      expect(input).toHaveValue(quantity);
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(submitted).toHaveBeenCalledWith(quantity);
    },
  );

  it("renders catalogue description as read-only preview and names the icon action twice", async () => {
    const draft = state();
    render(
      <TooltipProvider delayDuration={0}>
        <TradeLineEditor state={draft} currencyCode="EGP" disabled={false} />
      </TooltipProvider>,
    );

    expect(screen.getByText(DESCRIPTION)).toBeVisible();
    expect(screen.queryByDisplayValue(DESCRIPTION)).toBeNull();

    const removeButtons = screen.getAllByRole("button", {
      name: en.tradeDocuments.lineEditor.removeLine,
    });
    fireEvent.focus(removeButtons[0]);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      en.tradeDocuments.lineEditor.removeLine,
    );
  });

  it("opens the governed price breakdown popover when a line has a resolved server price", async () => {
    const priced = state();
    priced.lines[0] = {
      ...priced.lines[0]!,
      quantity: "2",
      unitPrice: "90.00",
      priceBreakdown: {
        unitPrice: "90.00",
        baselineUnitPrice: "100.00",
        currencyCode: "EGP",
        priceBookId: "0192f3a0-0000-7000-8000-000000000099",
        priceBookVersion: 2,
        minimumAllowedPrice: "80.00",
        matchedPromotions: [{ code: "VIP_10", discountAmount: "10.00" }],
      },
    };
    render(
      <TooltipProvider delayDuration={0}>
        <TradeLineEditor state={priced} currencyCode="EGP" disabled={false} />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: en.tradePricing.linePriceBreakdownTitle,
    });
    fireEvent.click(trigger);

    expect(await screen.findByText(en.tradePricing.linePriceBreakdownTitle)).toBeVisible();
    expect(screen.getByText("VIP_10")).toBeVisible();
    expect(screen.getByText(en.tradePricing.floorGuardSafe)).toBeVisible();
    expect(
      screen.getByRole("link", { name: en.tradePricing.lineOpenSimulator }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/trade/pricing?purpose=SALES&currencyCode=EGP"),
    );
  });
});
