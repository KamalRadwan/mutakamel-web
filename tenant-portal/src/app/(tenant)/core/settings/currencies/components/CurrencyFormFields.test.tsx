// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import { EMPTY_CURRENCY_FORM } from "../currency-contract";
import { CurrencyFormFields } from "./CurrencyFormFields";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, t: locale.lang === "ar" ? ar : en }),
}));

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("currency code choice, fallback, and derived ISO precision fields", () => {
  it.each([en, ar])("shows immutable code and precision with tooltip hints on edit", (t) => {
    locale.lang = t === ar ? "ar" : "en";
    render(
      <div dir={t === ar ? "rtl" : "ltr"}>
        <CurrencyFormFields
          values={{
            ...EMPTY_CURRENCY_FORM,
            code: "EUR",
            decimalPlaces: "2",
            isDefault: true,
            exchangeRate: "1",
          }}
          onChange={vi.fn()}
          isSubmitting={false}
          codeReadOnly
          rateLocked
          showDefaultToggle={false}
        />
      </div>,
    );

    const codeInput = screen.getByRole("textbox", {
      name: t.coreSettings.currencyCode,
    }) as HTMLInputElement;
    const decimalsInput = screen.getByRole("textbox", {
      name: t.coreSettings.currencyDecimalPlaces,
    }) as HTMLInputElement;
    const rateInput = screen.getByRole("textbox", {
      name: t.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;

    expect(codeInput.readOnly).toBe(true);
    expect(codeInput.disabled).toBe(false);
    expect(codeInput.value).toBe("EUR");
    expect(decimalsInput.readOnly).toBe(true);
    expect(decimalsInput.disabled).toBe(false);
    expect(decimalsInput.value).toBe("2");
    expect(rateInput.readOnly).toBe(true);

    expect(codeInput.parentElement?.getAttribute("dir")).toBe("ltr");
    expect(decimalsInput.parentElement?.getAttribute("dir")).toBe("ltr");
    expect(rateInput.parentElement?.getAttribute("dir")).toBe("ltr");

    expect(screen.getByRole("button", { name: t.coreSettings.currencyCodeImmutable })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.coreSettings.currencyDecimalPlacesImmutable }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.coreSettings.currencyRateLockedHint }),
    ).toBeTruthy();
  });

  it("offers spendable ISO codes on create and excludes every non-spendable code", async () => {
    locale.lang = "en";
    const onChange = vi.fn();
    render(
      <CurrencyFormFields
        values={EMPTY_CURRENCY_FORM}
        onChange={onChange}
        isSubmitting={false}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
      />,
    );

    const codePicker = screen.getByRole("combobox", { name: en.coreSettings.currencyCode });
    const decimalsInput = screen.getByRole("textbox", {
      name: en.coreSettings.currencyDecimalPlaces,
    }) as HTMLInputElement;

    expect(decimalsInput.readOnly).toBe(true);
    expect(decimalsInput.value).toBe("");
    expect(decimalsInput.placeholder).toBe("—");
    expect(
      screen.getByRole("button", { name: en.coreSettings.currencyDecimalPlacesDerived }),
    ).toBeTruthy();

    fireEvent.keyDown(codePicker, { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox");
    const offeredCodes = within(listbox).getAllByRole("option").map(option => option.textContent);
    for (const nonSpendable of ["XDR", "XSU", "XUA", "XAU", "XAG", "XPD", "XPT", "XTS", "XXX"]) {
      expect(offeredCodes).not.toContain(nonSpendable);
    }
    fireEvent.click(within(listbox).getByRole("option", { name: "KWD" }));
    expect(onChange).toHaveBeenCalledWith({ code: "KWD" });
  });

  it.each([
    ["", ""], ["JPY", "0"], ["BHD", "3"], ["CLF", "4"], ["USD", "2"],
  ] as const)("derives immutable create precision for %s as %s", (code, expected) => {
    locale.lang = "en";
    const onChange = vi.fn();
    const { rerender } = render(<CurrencyFormFields values={EMPTY_CURRENCY_FORM} onChange={onChange}
      isSubmitting={false} codeReadOnly={false} rateLocked={false} showDefaultToggle />);
    rerender(<CurrencyFormFields values={{ ...EMPTY_CURRENCY_FORM, code }} onChange={onChange}
      isSubmitting={false} codeReadOnly={false} rateLocked={false} showDefaultToggle />);
    const decimalsInput = screen.getByRole("textbox", { name: en.coreSettings.currencyDecimalPlaces }) as HTMLInputElement;
    expect(decimalsInput.readOnly).toBe(true);
    expect(decimalsInput.value).toBe(expected);
  });

  it("falls back to free-code input when Intl.supportedValuesOf enumeration is unavailable", () => {
    locale.lang = "en";
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([]);
    const onChange = vi.fn();

    render(
      <CurrencyFormFields
        values={EMPTY_CURRENCY_FORM}
        onChange={onChange}
        isSubmitting={false}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
      />,
    );

    expect(screen.queryByRole("combobox", { name: en.coreSettings.currencyCode })).toBeNull();
    const codeInput = screen.getByRole("textbox", {
      name: en.coreSettings.currencyCode,
    }) as HTMLInputElement;
    expect(codeInput.readOnly).toBe(false);

    fireEvent.change(codeInput, { target: { value: "kwd" } });
    expect(onChange).toHaveBeenCalledWith({ code: "KWD" });
  });
});

describe("currency conversion explanation and default checkbox", () => {
  it.each([en, ar])("collects the rate against an unknown default during creation", (t) => {
    locale.lang = t === ar ? "ar" : "en";
    const onChange = vi.fn();
    render(
      <CurrencyFormFields
        values={{ ...EMPTY_CURRENCY_FORM, code: "EGP", isDefault: true }}
        onChange={onChange}
        isSubmitting={false}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
      />,
    );

    const input = screen.getByRole("textbox", {
      name: t.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    expect(screen.getByText(t.coreSettings.currencyCreateDefaultRateHint)).toBeTruthy();
    fireEvent.change(input, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith({ exchangeRate: "50" });

    const defaultCheckbox = screen.getByRole("checkbox", {
      name: t.coreSettings.currencyMakeDefault,
    });
    fireEvent.click(defaultCheckbox);
    expect(onChange).toHaveBeenCalledWith({ isDefault: false });
  });

  it("renders a single conversion explanation instead of stacking Units-per-base hint and equation", () => {
    locale.lang = "en";
    const perBaseHint = formatTemplate(en.coreSettings.currencyRatePerBaseHint, { base: "EGP" });
    const { rerender } = render(
      <CurrencyFormFields
        values={{ ...EMPTY_CURRENCY_FORM, code: "USD", exchangeRate: "" }}
        onChange={vi.fn()}
        isSubmitting={false}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
        baseStatus="ready"
        baseCurrencyCode="EGP"
      />,
    );

    expect(screen.getByText(perBaseHint)).toBeTruthy();

    rerender(
      <CurrencyFormFields
        values={{ ...EMPTY_CURRENCY_FORM, code: "USD", exchangeRate: "0.02000000" }}
        onChange={vi.fn()}
        isSubmitting={false}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
        baseStatus="ready"
        baseCurrencyCode="EGP"
      />,
    );

    expect(screen.getByText("1 EGP = 0.02000000 USD")).toBeTruthy();
    expect(screen.queryByText(perBaseHint)).toBeNull();
  });
});

describe("currency inline validation and linked summary", () => {
  it("associates inline errors with controls and focuses the linked invalid field", () => {
    locale.lang = "en";
    const onFocusField = vi.fn();
    const rateRef = createRef<HTMLInputElement>();

    render(
      <CurrencyFormFields
        values={{ ...EMPTY_CURRENCY_FORM, code: "EUR", name: "Euro" }}
        onChange={vi.fn()}
        isSubmitting={false}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
        errors={{ exchangeRate: en.coreSettings.currencyRateRequired }}
        errorSummary={[
          {
            field: "exchangeRate",
            label: en.coreSettings.currencyExchangeRate,
            anchorId: "anchor-rate",
          },
        ]}
        anchorIds={{ exchangeRate: "anchor-rate" }}
        fieldRefs={{ exchangeRate: rateRef }}
        onFocusField={onFocusField}
      />,
    );

    const rateInput = screen.getByRole("textbox", {
      name: en.coreSettings.currencyExchangeRate,
    });
    expect(rateInput.getAttribute("aria-invalid")).toBe("true");
    const inlineError = screen.getByText(en.coreSettings.currencyRateRequired);
    expect(rateInput.getAttribute("aria-describedby")).toContain(inlineError.id);

    const summaryLink = screen.getByRole("link", {
      name: en.coreSettings.currencyExchangeRate,
    });
    expect(summaryLink.getAttribute("href")).toBe("#anchor-rate");
    fireEvent.click(summaryLink);
    expect(onFocusField).toHaveBeenCalledWith("exchangeRate");
  });
});
