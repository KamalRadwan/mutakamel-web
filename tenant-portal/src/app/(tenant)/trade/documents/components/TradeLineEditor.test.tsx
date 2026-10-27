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
    purpose: "SALES",
    searchItems: vi.fn(),
    addLine: vi.fn(),
    removeLine: vi.fn(),
    setItem: vi.fn(),
    setUom: vi.fn(),
    setQuantity: vi.fn(),
    commitQuantity: vi.fn(),
    reset: vi.fn(),
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
});
