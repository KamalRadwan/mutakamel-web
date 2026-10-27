// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { CreateUomConversionModal } from "./CreateUomConversionModal";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[language], lang: language }),
}));

afterEach(() => {
  cleanup();
  language = "en";
});

function renderModal(isSubmitting = false) {
  return render(
    <TooltipProvider>
      <CreateUomConversionModal
        isOpen
        isSubmitting={isSubmitting}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    </TooltipProvider>,
  );
}

describe.each(["ar", "en"] as const)("UOM conversion suggestions (%s)", (lang) => {
  it.each([
    ["1", "2.5", "2", "5"],
    ["2", "2.5", "4", "5"],
    ["1.5", "2", "3", "4"],
    ["1.5", "2.5", "3", "5"],
  ])("displays and applies the equivalent ratio for %s / %s", (num, den, nextNum, nextDen) => {
    language = lang;
    renderModal();
    const t = dictionaries[lang].tradeInventory;
    const numerator = screen.getByLabelText(new RegExp(t.factorNumerator, "u"));
    const denominator = screen.getByLabelText(new RegExp(t.factorDenominator, "u"));
    fireEvent.change(numerator, { target: { value: num } });
    fireEvent.change(denominator, { target: { value: den } });

    expect(screen.getByText(`${num} / ${den} = ${nextNum} / ${nextDen}`)).toHaveAttribute("dir", "ltr");
    expect(screen.getByText(t.conversionExactRatioHint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.conversionApplyExactRatio }));

    expect(numerator).toHaveValue(nextNum);
    expect(denominator).toHaveValue(nextDen);
    expect(screen.queryByRole("button", { name: t.conversionApplyExactRatio })).not.toBeInTheDocument();
  });

  it("hides Apply when the opposing operand is missing or zero", () => {
    language = lang;
    renderModal();
    const t = dictionaries[lang].tradeInventory;
    fireEvent.change(screen.getByLabelText(new RegExp(t.factorNumerator, "u")), {
      target: { value: "1.5" },
    });
    const denominator = screen.getByLabelText(new RegExp(t.factorDenominator, "u"));
    for (const value of ["", "0"]) {
      fireEvent.change(denominator, { target: { value } });
      expect(screen.queryByRole("button", { name: t.conversionApplyExactRatio })).not.toBeInTheDocument();
    }
  });
});
