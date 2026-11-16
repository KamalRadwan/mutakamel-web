// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  CATALOG_ITEM,
  CATALOG_UNIT,
  DETAIL_WITH_REVISION,
  ITEM_ID,
  draftLine,
} from "../hooks/quotation-composer.test-fixtures";
import { quotationSavedLines } from "../quotation-saved-presentation";
import { QuotationSavedLines } from "./QuotationSavedLines";

let localeState: { t: typeof en; lang: "en" | "ar"; dir: "ltr" | "rtl" } = {
  t: en,
  lang: "en",
  dir: "ltr",
};

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => localeState,
}));

describe("QuotationSavedLines", () => {
  beforeEach(() => {
    localeState = { t: en, lang: "en", dir: "ltr" };
  });
  afterEach(cleanup);

  it("renders separate Item and frozen Description columns while ignoring mutable catalogue names and descriptions", () => {
    const savedLine = {
      ...DETAIL_WITH_REVISION.currentLines[0],
      descriptionSnapshot: "Frozen Pump Assembly Spec Rev-1",
      discountSnapshot: { itemId: ITEM_ID, promotionSavings: "125.50" },
    };
    const entries = quotationSavedLines([savedLine], {
      lines: [draftLine()],
      itemsById: {
        [ITEM_ID]: {
          ...CATALOG_ITEM,
          localizedNames: { en: "Changed Live Name" },
          quotationDescription: "Changed Live Description",
        },
      },
      uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] },
    });

    render(<QuotationSavedLines lines={entries} mode="PROMOTIONS" discountAmount="125.50" />);

    const table = within(screen.getByRole("table"));
    const headers = table.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual([
      en.common.rowNumberShort,
      en.tradeDocuments.item,
      en.coreOperations.templates.description,
      en.quotationExperience.unit,
      en.quotationExperience.quantity,
      en.quotationExperience.unitPrice,
      en.quotationExperience.lineAmount,
    ]);

    expect(table.getByText("VALVE-1")).toBeTruthy();
    expect(table.getByText("Frozen Pump Assembly Spec Rev-1")).toBeTruthy();
    const deduction = table.getAllByRole("row").at(-1)!;
    expect(deduction.className).toContain("bg-destructive/10");
    expect(within(deduction).getByRole("rowheader", { name: en.quotationDiscount.promotionDiscount })).toBeTruthy();
    expect(within(deduction).getByText(/-125\.50/)).toBeTruthy();
    expect(table.queryByText("Changed Live Name")).toBeNull();
    expect(table.queryByText("Changed Live Description")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows the full frozen description inline", () => {
    const longDescription = `Spec-${"A1B2C3D4-".repeat(54)}END`.slice(0, 500);
    const savedLine = {
      ...DETAIL_WITH_REVISION.currentLines[0],
      descriptionSnapshot: longDescription,
    };
    const entries = quotationSavedLines([savedLine]);

    render(<QuotationSavedLines lines={entries} mode="PROMOTIONS" />);

    const table = within(screen.getByRole("table"));
    const description = table.getByText(longDescription);
    expect(description.textContent).toBe(longDescription);
    expect(description).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
    expect(description).toHaveAttribute("dir", "auto");
  });

  it("renders the RTL item fallback and a final negative row for the quotation discount", () => {
    localeState = { t: ar as unknown as typeof en, lang: "ar", dir: "rtl" };
    const savedLine = {
      ...DETAIL_WITH_REVISION.currentLines[0],
      printLineNumber: 3,
      descriptionSnapshot: "مضخة صناعية عالية الضغط",
      discountTotal: "250.00",
      taxSnapshot: { uomCode: "EA" },
    };
    const entries = quotationSavedLines([savedLine]);

    render(
      <QuotationSavedLines
        lines={entries}
        mode="DISCOUNT"
        discountScope="DOCUMENT"
        discountAmount={savedLine.discountTotal}
        currencyCode="EGP"
        lineDisplayById={{ [savedLine.clientLineId]: { unavailable: true } }}
      />,
    );

    const table = within(screen.getByRole("table"));
    expect(table.getByRole("columnheader", { name: ar.coreOperations.templates.description })).toBeTruthy();
    expect(table.queryByRole("columnheader", { name: ar.quotationDiscount.allocatedDiscount })).toBeNull();
    const dataRow = within(table.getAllByRole("row")[1]!);
    expect(dataRow.getByText(ar.quotationExperience.itemUnknown, { exact: false })).toBeTruthy();
    expect(dataRow.getByText(ar.audit.valueUnavailable)).toBeTruthy();
    expect(dataRow.getByText("EA")).toBeTruthy();
    const discountRow = within(table.getAllByRole("row").at(-1)!);
    expect(discountRow.getByText(ar.quotationDiscount.discount)).toBeTruthy();
    expect(discountRow.getByText(/250\.00/).textContent).toContain("-");
    expect(screen.getByRole("table").textContent).not.toContain(savedLine.uomId);
    expect(screen.getByRole("table").textContent).not.toContain(savedLine.id);
  });
});
