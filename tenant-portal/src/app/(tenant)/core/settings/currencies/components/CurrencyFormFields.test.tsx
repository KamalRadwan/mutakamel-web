// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { EMPTY_CURRENCY_FORM } from "../currency-contract";
import { CurrencyFormFields } from "./CurrencyFormFields";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, t: locale.lang === "ar" ? ar : en }),
}));

afterEach(cleanup);

describe("currency precision field", () => {
  it.each([en, ar])("shows immutable precision with an explanation on edit", (t) => {
    locale.lang = t === ar ? "ar" : "en";
    render(<CurrencyFormFields
      values={EMPTY_CURRENCY_FORM}
      onChange={vi.fn()}
      isSubmitting={false}
      codeReadOnly
      rateLocked={false}
      showDefaultToggle={false}
    />);

    const input = screen.getByRole("textbox", { name: t.coreSettings.currencyDecimalPlaces }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe("2");
    expect(screen.getByText(t.coreSettings.currencyDecimalPlacesImmutable)).toBeTruthy();
  });

  it("keeps precision editable on create", () => {
    locale.lang = "en";
    render(<CurrencyFormFields
      values={EMPTY_CURRENCY_FORM}
      onChange={vi.fn()}
      isSubmitting={false}
      codeReadOnly={false}
      rateLocked={false}
      showDefaultToggle={false}
    />);

    const input = screen.getByRole("textbox", { name: en.coreSettings.currencyDecimalPlaces }) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
  });
});

describe("currency rebase rate field", () => {
  it.each([en, ar])("collects the rate against the current default during creation", (t) => {
    locale.lang = t === ar ? "ar" : "en";
    const onChange = vi.fn();
    render(<CurrencyFormFields
      values={{ ...EMPTY_CURRENCY_FORM, code: "EGP", isDefault: true }}
      onChange={onChange}
      isSubmitting={false}
      codeReadOnly={false}
      rateLocked={false}
      showDefaultToggle
    />);

    const input = screen.getByRole("textbox", { name: t.coreSettings.currencyExchangeRate }) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    expect(screen.getByText(t.coreSettings.currencyCreateDefaultRateHint)).toBeTruthy();
    fireEvent.change(input, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith({ exchangeRate: "50" });
  });

  it.each([en, ar])("keeps the stored default rate read-only on edit", (t) => {
    locale.lang = t === ar ? "ar" : "en";
    render(<CurrencyFormFields
      values={{ ...EMPTY_CURRENCY_FORM, isDefault: true, exchangeRate: "1" }}
      onChange={vi.fn()}
      isSubmitting={false}
      codeReadOnly
      rateLocked
      showDefaultToggle={false}
    />);

    const input = screen.getByRole("textbox", { name: t.coreSettings.currencyExchangeRate }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe("1");
    expect(screen.getByText(t.coreSettings.currencyRateLockedHint)).toBeTruthy();
  });
});
