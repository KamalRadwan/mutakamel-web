// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { createEmptyEvidenceLineDraft, type TradeEvidenceDialect } from "../lib/trade-financial-evidence";
import { TradeFinancialLinesEditor } from "./TradeFinancialLinesEditor";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: locale.lang === "ar" ? ar : en, lang: locale.lang }),
}));
vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => locale.lang }));

function Editor({ dialect = "FINANCIAL" }: { dialect?: TradeEvidenceDialect }) {
  const [lines, setLines] = useState(() => [{ ...createEmptyEvidenceLineDraft(), unitPrice: "100" }]);
  const [roundingTotal, setRoundingTotal] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  return (
    <TooltipProvider>
      <TradeFinancialLinesEditor dialect={dialect} currencyCode="SAR"
        lines={lines} onChangeLines={setLines}
        roundingTotal={roundingTotal} onChangeRoundingTotal={setRoundingTotal}
        amountPaid={amountPaid} onChangeAmountPaid={setAmountPaid}
        showAmountPaid={dialect === "ORDER"} />
    </TooltipProvider>
  );
}

afterEach(cleanup);

describe.each(["en", "ar"] as const)("financial field errors in %s", (lang) => {
  beforeEach(() => { locale.lang = lang; });
  const td = (lang === "ar" ? ar : en).tradeDocuments;

  it.each([
    [td.quantity, "0", td.lineEditor.quantityInvalid],
    [td.quantity, "-1", td.lineEditor.decimalInvalid],
    [td.unitPrice, "12oops", td.lineEditor.decimalInvalid],
    [td.unitPrice, "", td.lineEditor.decimalInvalid],
    [td.executive.taxRatePercentLabel, "15oops", td.lineEditor.taxRateInvalid],
    [td.executive.taxRatePercentLabel, "101", td.lineEditor.taxRateInvalid],
    [td.executive.taxRatePercentLabel, "15.001", td.lineEditor.taxRateInvalid],
    [td.executive.computedRounding, "bad", td.lineEditor.decimalInvalid],
  ])("preserves invalid %s=%s with an accessible localized error", (label, raw, message) => {
    render(<Editor />);
    const input = screen.getByRole("textbox", { name: label });
    fireEvent.change(input, { target: { value: raw } });

    expect(input).toHaveValue(raw);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(message);
    expect(screen.queryByText(td.executive.evidenceVerifiedBadge)).toBeNull();
    expect(screen.queryByText(td.executive.computedGrandTotal)).toBeNull();

    fireEvent.change(input, { target: { value: "1" } });
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(td.executive.evidenceVerifiedBadge)).toBeVisible();
    expect(screen.getByText(td.executive.computedGrandTotal)).toBeVisible();
  });

  it("preserves an invalid payment and reports its field error", () => {
    render(<Editor dialect="ORDER" />);
    const payment = screen.getByRole("textbox", { name: td.executive.amountPaidLabel });
    fireEvent.change(payment, { target: { value: "oops" } });
    expect(payment).toHaveValue("oops");
    expect(payment).toHaveAccessibleDescription(td.lineEditor.decimalInvalid);
    expect(screen.queryByText(td.executive.computedGrandTotal)).toBeNull();
  });

  it("reports invalid calculated totals without displaying substitute totals", () => {
    render(<Editor dialect="ORDER" />);
    const payment = screen.getByRole("textbox", { name: td.executive.amountPaidLabel });
    fireEvent.change(payment, { target: { value: "116" } });
    expect(payment).toHaveValue("116");
    expect(screen.getByRole("alert")).toHaveTextContent(td.lineEditor.calculationInvalid);
    expect(screen.queryByText(td.executive.computedGrandTotal)).toBeNull();
    expect(screen.queryByText(td.executive.evidenceVerifiedBadge)).toBeNull();
  });
});
