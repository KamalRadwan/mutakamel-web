// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import {
  CURRENCY_CODE_INVALID_CODE,
  CURRENCY_CODE_TAKEN_CODE,
  CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE,
  CURRENCY_PRECISION_MISMATCH_CODE,
  CURRENCY_RATE_REQUIRED_CODE,
  CURRENCY_REBASE_OUT_OF_RANGE_CODE,
  buildCreateCurrencyRequest,
  buildUpdateCurrencyRequest,
  type Currency,
  type CurrencyFormValues,
} from "../currency-contract";
import { CreateCurrencyModal } from "./CreateCurrencyModal";
import { EditCurrencyModal } from "./EditCurrencyModal";

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
  window.localStorage.removeItem("tenant_lang");
  vi.restoreAllMocks();
});

const eurCurrency: Currency = {
  id: "01902001-3000-7000-8000-000000000012",
  code: "EUR",
  name: "Euro",
  symbol: "€",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.92345678",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const usdDefaultCurrency: Currency = {
  id: "01902001-3000-7000-8000-000000000011",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  decimalPlaces: 2,
  isDefault: true,
  exchangeRate: "1.00000000",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:00:00.000Z",
};

async function renderWithLocale(ui: React.ReactElement, language: "en" | "ar" = "en") {
  await act(async () => {
    await setLanguage(language);
  });
  return render(<I18nProvider initialLanguage={language}>{ui}</I18nProvider>);
}

async function selectCurrencyCodeOption(dialog: HTMLElement, label: string, code: string) {
  const trigger = within(dialog).getByRole("combobox", { name: label });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText(code));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  return trigger;
}

describe("CreateCurrencyModal and EditCurrencyModal", () => {
  it.each([
    ["en", en] as const,
    ["ar", ar] as const,
  ])(
    "renders a centered compact modal and focuses the first editable field on open in %s",
    async (lang, t) => {
      const createView = await renderWithLocale(
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={vi.fn().mockResolvedValue(true)}
          isSubmitting={false}
          error={null}
        />,
        lang,
      );

      const createDialog = screen.getByRole("dialog");
      expect(createDialog.querySelector("aside")).toBeNull();
      expect(createDialog.className).not.toContain("inset-y-0");
      expect(within(createDialog).getByRole("heading", { name: t.coreSettings.currencyCreateTitle })).toBeTruthy();
      expect(within(createDialog).getByRole("button", { name: t.coreSettings.save })).toBeTruthy();

      const codeChoice = within(createDialog).getByRole("combobox", { name: t.coreSettings.currencyCode });
      expect(document.activeElement).toBe(codeChoice);

      createView.unmount();

      await renderWithLocale(
        <EditCurrencyModal
          currency={eurCurrency}
          onClose={vi.fn()}
          onSubmit={vi.fn().mockResolvedValue(true)}
          isSubmitting={false}
          error={null}
          baseCurrencyCode="USD"
        />,
        lang,
      );

      const editDialog = screen.getByRole("dialog");
      const editNameInput = within(editDialog).getByRole("textbox", { name: t.coreSettings.currencyName });
      expect(document.activeElement).toBe(editNameInput);
      expect(within(editDialog).getByText("1 USD = 0.92345678 EUR")).toBeTruthy();
    },
  );

  it("picks spendable ISO codes, derives readonly precision (JPY/BHD/CLF/default), blocks invalid submit with linked summary, and omits decimalPlaces on wire", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([
      "BHD",
      "CLF",
      "EGP",
      "EUR",
      "JPY",
      "USD",
      "XAU",
      "XDR",
      "XXX",
    ]);
    const submittedPayloads: ReturnType<typeof buildCreateCurrencyRequest>[] = [];
    const onSubmit = vi.fn(async (values: CurrencyFormValues) => {
      submittedPayloads.push(buildCreateCurrencyRequest(values));
      return true;
    });

    await renderWithLocale(
      <CreateCurrencyModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
        baseStatus="ready"
        baseCurrencyCode="USD"
      />,
    );

    const dialog = screen.getByRole("dialog");
    const codeChoice = within(dialog).getByRole("combobox", { name: en.coreSettings.currencyCode });
    const nameInput = within(dialog).getByRole("textbox", { name: en.coreSettings.currencyName }) as HTMLInputElement;
    const decimalsInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencyDecimalPlaces,
    }) as HTMLInputElement;
    const rateInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;

    expect(decimalsInput.readOnly).toBe(true);
    expect(decimalsInput.value).toBe("");

    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(codeChoice);
    expect(within(dialog).getByText(en.coreSettings.currencyFormErrorSummary)).toBeTruthy();
    expect(within(dialog).getByText(en.coreSettings.currencyFormCode)).toBeTruthy();
    expect(within(dialog).getByText(en.coreSettings.currencyFormName)).toBeTruthy();
    expect(within(dialog).getByText(en.coreSettings.currencyRateRequired)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("link", { name: en.coreSettings.currencyExchangeRate }));
    expect(document.activeElement).toBe(rateInput);

    for (const [code, expected] of [
      ["JPY", "0"],
      ["BHD", "3"],
      ["CLF", "4"],
      ["USD", "2"],
    ] as const) {
      await selectCurrencyCodeOption(dialog, en.coreSettings.currencyCode, code);
      expect(decimalsInput.readOnly).toBe(true);
      expect(decimalsInput.value).toBe(expected);
      expect(nameInput.value).toBe("");
    }

    await selectCurrencyCodeOption(dialog, en.coreSettings.currencyCode, "BHD");
    fireEvent.change(nameInput, { target: { value: "Bahraini Dinar" } });
    fireEvent.change(rateInput, { target: { value: "0.376" } });

    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submittedPayloads[0]).toEqual({
      code: "BHD",
      name: "Bahraini Dinar",
      exchangeRate: 0.376,
    });
    expect("decimalPlaces" in submittedPayloads[0]).toBe(false);
  });

  it("blocks Make default + blank rate locally when a known existing base is ready", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["EGP", "EUR", "USD"]);
    const submittedPayloads: ReturnType<typeof buildCreateCurrencyRequest>[] = [];
    const onSubmit = vi.fn(async (values: CurrencyFormValues) => {
      submittedPayloads.push(buildCreateCurrencyRequest(values));
      return true;
    });

    await renderWithLocale(
      <CreateCurrencyModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
        baseStatus="ready"
        baseCurrencyCode="USD"
      />,
    );

    const dialog = screen.getByRole("dialog");
    await selectCurrencyCodeOption(dialog, en.coreSettings.currencyCode, "EGP");
    fireEvent.change(within(dialog).getByRole("textbox", { name: en.coreSettings.currencyName }), {
      target: { value: "Egyptian Pound" },
    });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: en.coreSettings.currencyMakeDefault }));
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));

    expect(onSubmit).not.toHaveBeenCalled();
    const rateInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;
    expect(rateInput.getAttribute("aria-invalid")).toBe("true");
    expect(within(dialog).getByText(en.coreSettings.currencyRateRequired)).toBeTruthy();
    expect(document.activeElement).toBe(rateInput);

    fireEvent.change(rateInput, { target: { value: "50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submittedPayloads[0]).toEqual({
      code: "EGP",
      name: "Egyptian Pound",
      exchangeRate: 50,
      isDefault: true,
    });
  });

  it.each(["loading", "unknown"] as const)(
    "never treats %s baseStatus as absence of a base currency",
    async (status) => {
      vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["SAR", "USD"]);
      const onSubmit = vi.fn().mockResolvedValue(true);

      await renderWithLocale(
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={onSubmit}
          isSubmitting={false}
          error={null}
          baseStatus={status}
          baseCurrencyCode={null}
        />,
      );

      const dialog = screen.getByRole("dialog");
      const defaultToggle = within(dialog).getByRole("checkbox", {
        name: en.coreSettings.currencyMakeDefault,
      });
      const rateInput = within(dialog).getByRole("textbox", {
        name: en.coreSettings.currencyExchangeRate,
      }) as HTMLInputElement;

      expect(defaultToggle).toHaveAttribute("aria-checked", "false");
      expect(defaultToggle).not.toBeDisabled();
      expect(rateInput.readOnly).toBe(false);
      expect(rateInput.value).toBe("");

      await selectCurrencyCodeOption(dialog, en.coreSettings.currencyCode, "SAR");
      fireEvent.change(within(dialog).getByRole("textbox", { name: en.coreSettings.currencyName }), {
        target: { value: "Saudi Riyal" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(within(dialog).getByText(en.coreSettings.currencyRateRequired)).toBeTruthy();
    },
  );

  it("uses first-currency default and rate-1 semantics when baseStatus is ready and baseCurrencyCode is null", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["EGP", "USD"]);
    const submittedPayloads: ReturnType<typeof buildCreateCurrencyRequest>[] = [];
    const onSubmit = vi.fn(async (values: CurrencyFormValues) => {
      submittedPayloads.push(buildCreateCurrencyRequest(values));
      return true;
    });

    await renderWithLocale(
      <CreateCurrencyModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
        baseStatus="ready"
        baseCurrencyCode={null}
      />,
    );

    const firstDialog = screen.getByRole("dialog");
    const firstDefaultToggle = within(firstDialog).getByRole("checkbox", {
      name: en.coreSettings.currencyMakeDefault,
    });
    const firstRate = within(firstDialog).getByRole("textbox", {
      name: en.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;

    expect(firstDefaultToggle).toHaveAttribute("aria-checked", "true");
    expect(firstDefaultToggle).toBeDisabled();
    expect(firstRate.readOnly).toBe(true);
    expect(firstRate.value).toBe("1");

    await selectCurrencyCodeOption(firstDialog, en.coreSettings.currencyCode, "EGP");
    fireEvent.change(within(firstDialog).getByRole("textbox", { name: en.coreSettings.currencyName }), {
      target: { value: "Egyptian Pound" },
    });
    fireEvent.click(within(firstDialog).getByRole("button", { name: en.coreSettings.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submittedPayloads[0]).toEqual({
      code: "EGP",
      name: "Egyptian Pound",
      isDefault: true,
    });
    expect("exchangeRate" in submittedPayloads[0]).toBe(false);
  });

  it("preserves user draft across baseStatus transitions and recovers inline when a server race demands exchangeRate", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["EGP", "EUR", "USD"]);
    const submittedPayloads: ReturnType<typeof buildCreateCurrencyRequest>[] = [];
    const onSubmit = vi
      .fn<(values: CurrencyFormValues) => Promise<boolean>>()
      .mockRejectedValueOnce(
        new TenantApiClientError("Exchange rate required", {
          status: 422,
          statusText: "Unprocessable Entity",
          headers: new Headers(),
          data: {
            errorCode: CURRENCY_RATE_REQUIRED_CODE,
            message: "Exchange rate required",
          },
        }),
      )
      .mockImplementationOnce(async (values) => {
        submittedPayloads.push(buildCreateCurrencyRequest(values));
        return true;
      });

    const { rerender } = await renderWithLocale(
      <CreateCurrencyModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
        baseStatus="loading"
        baseCurrencyCode={null}
      />,
    );

    const dialog = screen.getByRole("dialog");
    await selectCurrencyCodeOption(dialog, en.coreSettings.currencyCode, "EUR");
    const nameInput = within(dialog).getByRole("textbox", { name: en.coreSettings.currencyName }) as HTMLInputElement;
    const symbolInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencySymbol,
    }) as HTMLInputElement;
    const rateInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "Euro Draft" } });
    fireEvent.change(symbolInput, { target: { value: "€" } });
    fireEvent.change(rateInput, { target: { value: "0.92" } });

    // Resolving base to unknown keeps all typed draft fields untouched.
    rerender(
      <I18nProvider initialLanguage="en">
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={onSubmit}
          isSubmitting={false}
          error={null}
          baseStatus="unknown"
          baseCurrencyCode={null}
        />
      </I18nProvider>,
    );
    expect(nameInput.value).toBe("Euro Draft");
    expect(symbolInput.value).toBe("€");
    expect(rateInput.value).toBe("0.92");

    // Resolving base to ready + USD keeps typed draft and displays live equation.
    rerender(
      <I18nProvider initialLanguage="en">
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={onSubmit}
          isSubmitting={false}
          error={null}
          baseStatus="ready"
          baseCurrencyCode="USD"
        />
      </I18nProvider>,
    );
    expect(nameInput.value).toBe("Euro Draft");
    expect(symbolInput.value).toBe("€");
    expect(rateInput.value).toBe("0.92");
    expect(within(dialog).getByText("1 USD = 0.92 EUR")).toBeTruthy();

    // Resolving base to ready + null (first currency) preserves code/name/symbol; if a concurrent
    // server transaction created a default first and rejects with CURRENCY_EXCHANGE_RATE_REQUIRED,
    // the rate field unlocks inline with draft preserved!
    fireEvent.change(rateInput, { target: { value: "" } });
    rerender(
      <I18nProvider initialLanguage="en">
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={onSubmit}
          isSubmitting={false}
          error={null}
          baseStatus="ready"
          baseCurrencyCode={null}
        />
      </I18nProvider>,
    );
    expect(nameInput.value).toBe("Euro Draft");
    expect(symbolInput.value).toBe("€");
    expect(rateInput.readOnly).toBe(true);
    expect(rateInput.value).toBe("1");

    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(rateInput.readOnly).toBe(false));
    expect(rateInput.getAttribute("aria-invalid")).toBe("true");
    expect(within(dialog).getByText(en.coreSettings.currencyRateRequired)).toBeTruthy();
    expect(document.activeElement).toBe(rateInput);
    expect(nameInput.value).toBe("Euro Draft");
    expect(symbolInput.value).toBe("€");

    fireEvent.change(rateInput, { target: { value: "0.92" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(submittedPayloads[0]).toEqual({
      code: "EUR",
      name: "Euro Draft",
      symbol: "€",
      exchangeRate: 0.92,
    });
  });

  it("uses concise localized edit title, omits immutable code and decimalPlaces on PATCH, and locks default rate", async () => {
    const patches: ReturnType<typeof buildUpdateCurrencyRequest>[] = [];
    const onSubmit = vi.fn(async (values: CurrencyFormValues) => {
      patches.push(buildUpdateCurrencyRequest(eurCurrency, values));
      return true;
    });

    const view = await renderWithLocale(
      <EditCurrencyModal currency={eurCurrency} onClose={vi.fn()} onSubmit={onSubmit} isSubmitting={false} error={null} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: en.coreSettings.currencyEditTitle })).toBeTruthy();
    expect(within(dialog).queryByText("Euro (EUR)")).toBeNull();

    const getBox = (name: string) => within(dialog).getByRole("textbox", { name }) as HTMLInputElement;
    expect(getBox(en.coreSettings.currencyCode).readOnly).toBe(true);
    expect(getBox(en.coreSettings.currencyDecimalPlaces).readOnly).toBe(true);
    expect(getBox(en.coreSettings.currencyExchangeRate).readOnly).toBe(false);

    fireEvent.change(getBox(en.coreSettings.currencyName), { target: { value: "Eurozone Euro" } });
    fireEvent.change(getBox(en.coreSettings.currencyExchangeRate), { target: { value: "0.95000000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(patches[0]).toEqual({ name: "Eurozone Euro", exchangeRate: 0.95 });
    expect("code" in patches[0]).toBe(false);
    expect("decimalPlaces" in patches[0]).toBe(false);

    view.unmount();
    await renderWithLocale(
      <EditCurrencyModal
        currency={usdDefaultCurrency}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        isSubmitting={false}
        error={null}
      />,
    );
    expect(
      (screen.getByRole("textbox", { name: en.coreSettings.currencyExchangeRate }) as HTMLInputElement).readOnly,
    ).toBe(true);
  });

  it("allows name/symbol-only edits when a stored rebased rate exceeds 1e9 while rejecting changed input above 1e9", async () => {
    const highStoredRateCurrency: Currency = {
      ...eurCurrency,
      code: "LBP",
      name: "Lebanese Pound",
      exchangeRate: "9000000000.12345678",
    };
    const submittedValues: CurrencyFormValues[] = [];
    const builtPatches: ReturnType<typeof buildUpdateCurrencyRequest>[] = [];
    const onSubmit = vi.fn(async (values: CurrencyFormValues) => {
      submittedValues.push(values);
      builtPatches.push(buildUpdateCurrencyRequest(highStoredRateCurrency, values));
      return true;
    });

    await renderWithLocale(
      <EditCurrencyModal
        currency={highStoredRateCurrency}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencyName,
    }) as HTMLInputElement;
    const rateInput = within(dialog).getByRole("textbox", {
      name: en.coreSettings.currencyExchangeRate,
    }) as HTMLInputElement;
    expect(rateInput.value).toBe("9000000000.12345678");

    fireEvent.change(nameInput, { target: { value: "Lebanese Pound Updated" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submittedValues[0]?.exchangeRate).toBe("9000000000.12345678");
    expect(builtPatches[0]).toEqual({ name: "Lebanese Pound Updated" });
    expect("exchangeRate" in (builtPatches[0] ?? {})).toBe(false);

    fireEvent.change(rateInput, { target: { value: "1000000000.00000001" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(rateInput.getAttribute("aria-invalid")).toBe("true");
    expect(within(dialog).getByText(en.coreSettings.currencyFormRate)).toBeTruthy();
  });

  it("supports free-code fallback focus, maps duplicate/non-spendable-ISO/rebase errors to editable fields, and uses general banner for non-editable rejections", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([]);
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(
        new TenantApiClientError("Raw duplicate SQL detail", {
          status: 409,
          statusText: "Conflict",
          headers: new Headers(),
          data: { errorCode: CURRENCY_CODE_TAKEN_CODE, message: "Raw duplicate SQL detail" },
        }),
      )
      .mockRejectedValueOnce(
        new TenantApiClientError("Currency 'XAU' is not spendable", {
          status: 422,
          statusText: "Unprocessable Entity",
          headers: new Headers(),
          data: { errorCode: CURRENCY_CODE_INVALID_CODE, message: "Currency 'XAU' is not spendable" },
        }),
      );

    const { rerender } = await renderWithLocale(
      <CreateCurrencyModal isOpen onClose={vi.fn()} onSubmit={onSubmit} isSubmitting={false} error={null} />,
    );

    const codeInput = screen.getByRole("textbox", { name: en.coreSettings.currencyCode }) as HTMLInputElement;
    const nameInput = screen.getByRole("textbox", { name: en.coreSettings.currencyName }) as HTMLInputElement;
    const rateInput = screen.getByRole("textbox", { name: en.coreSettings.currencyExchangeRate }) as HTMLInputElement;

    expect(document.activeElement).toBe(codeInput);

    fireEvent.change(codeInput, { target: { value: "clf" } });
    expect(
      (screen.getByRole("textbox", { name: en.coreSettings.currencyDecimalPlaces }) as HTMLInputElement).value,
    ).toBe("4");

    fireEvent.change(codeInput, { target: { value: "EUR" } });
    fireEvent.change(nameInput, { target: { value: "Euro Draft" } });
    fireEvent.change(rateInput, { target: { value: "0.92" } });
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.save }));

    await waitFor(() => expect(codeInput.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByText(en.coreSettings.currencyCodeTaken)).toBeTruthy();
    expect(screen.queryByText("Raw duplicate SQL detail")).toBeNull();
    expect(nameInput.value).toBe("Euro Draft");

    fireEvent.change(codeInput, { target: { value: "XAU" } });
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => expect(screen.getByText(en.coreSettings.currencyCodeInvalid)).toBeTruthy());
    expect(codeInput.getAttribute("aria-invalid")).toBe("true");

    rerender(
      <I18nProvider initialLanguage="en">
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={vi.fn().mockResolvedValue(false)}
          isSubmitting={false}
          error={en.coreSettings.currencyRebaseOutOfRange}
          errorCode={CURRENCY_REBASE_OUT_OF_RANGE_CODE}
        />
      </I18nProvider>,
    );
    expect(rateInput.getAttribute("aria-invalid")).toBe("true");

    rerender(
      <I18nProvider initialLanguage="en">
        <CreateCurrencyModal
          isOpen
          onClose={vi.fn()}
          onSubmit={vi.fn().mockResolvedValue(false)}
          isSubmitting={false}
          error={en.coreSettings.currencyPrecisionMismatch}
          errorCode={CURRENCY_PRECISION_MISMATCH_CODE}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(en.coreSettings.currencyPrecisionMismatch)).toBeTruthy();

    rerender(
      <I18nProvider initialLanguage="en">
        <EditCurrencyModal
          currency={eurCurrency}
          onClose={vi.fn()}
          onSubmit={vi.fn().mockResolvedValue(false)}
          isSubmitting={false}
          error={en.coreSettings.currencyDecimalPlacesImmutable}
          errorCode={CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE}
        />
      </I18nProvider>,
    );
    expect(screen.getAllByText(en.coreSettings.currencyDecimalPlacesImmutable).length).toBeGreaterThanOrEqual(2);
  });

  it("prevents duplicate submits and dismissal while busy, and confirms dirty dismissal when idle", async () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["SAR", "USD"]);
    let resolveSubmit: ((saved: boolean) => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<boolean>((resolve) => { resolveSubmit = resolve; }));
    const onClose = vi.fn();

    await renderWithLocale(
      <CreateCurrencyModal isOpen onClose={onClose} onSubmit={onSubmit} isSubmitting={false} error={null} />,
    );

    const dialog = screen.getByRole("dialog");
    await selectCurrencyCodeOption(dialog, en.coreSettings.currencyCode, "SAR");
    fireEvent.change(within(dialog).getByRole("textbox", { name: en.coreSettings.currencyName }), {
      target: { value: "Saudi Riyal" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: en.coreSettings.currencyExchangeRate }), {
      target: { value: "3.75" },
    });

    const saveButton = within(dialog).getByRole("button", { name: en.coreSettings.save });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    fireEvent.submit(saveButton.closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await act(async () => { resolveSubmit?.(false); });

    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    const confirmDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: en.common.cancel }));
    expect(onClose).not.toHaveBeenCalled();
    expect(
      (within(dialog).getByRole("textbox", { name: en.coreSettings.currencyName }) as HTMLInputElement).value,
    ).toBe("Saudi Riyal");

    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    const secondConfirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(secondConfirm).getByRole("button", { name: en.common.discardConfirm }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
