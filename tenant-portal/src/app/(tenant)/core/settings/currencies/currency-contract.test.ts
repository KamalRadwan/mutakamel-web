import { describe, expect, it } from "vitest";
import {
  CURRENCIES_PATH,
  buildCreateCurrencyRequest,
  buildUpdateCurrencyRequest,
  currenciesListPath,
  currencyPath,
  parseCurrenciesResponse,
  parseCurrencyResponse,
  setDefaultCurrencyPath,
  toCurrencyForm,
} from "./currency-contract";

const currencyId = "01902001-3000-7000-8000-000000000001";
const currency = {
  id: currencyId,
  code: "EUR",
  name: "Euro",
  symbol: "€",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.92345678",
  status: "ACTIVE",
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

describe("Core currencies contract", () => {
  it("uses only canonical Gateway paths", () => {
    expect(CURRENCIES_PATH).toBe("/api/tenant/core/v1/currencies");
    expect(currencyPath(currencyId)).toBe(`${CURRENCIES_PATH}/${currencyId}`);
    expect(setDefaultCurrencyPath(currencyId)).toBe(
      `${CURRENCIES_PATH}/${currencyId}/set-default`,
    );
    expect(() => currencyPath("not-a-uuid")).toThrow("Invalid Core currencies response.");
  });

  it("builds the list query from URLSearchParams, never concatenation", () => {
    expect(currenciesListPath(2, "ACTIVE", "eu ro")).toBe(
      `${CURRENCIES_PATH}?page=2&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&search=eu+ro`,
    );
  });

  it("keeps the exchange rate an exact decimal string", () => {
    const parsed = parseCurrencyResponse(currency);
    expect(parsed.exchangeRate).toBe("0.92345678");
    expect(toCurrencyForm(parsed).exchangeRate).toBe("0.92345678");
  });

  it("accepts a currency with no rate and no symbol", () => {
    const parsed = parseCurrencyResponse({ ...currency, exchangeRate: null, symbol: null });
    expect(parsed.exchangeRate).toBeNull();
    expect(parsed.symbol).toBeNull();
  });

  it("omits the exchange rate when the new currency is the default", () => {
    // The server pins the default's rate to 1, so sending one is a value it discards.
    expect(
      buildCreateCurrencyRequest({
        code: "usd",
        name: " US Dollar ",
        symbol: "$",
        decimalPlaces: "2",
        exchangeRate: "5",
        isDefault: true,
      }),
    ).toEqual({ code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, isDefault: true });
  });

  it("requires a well-formed rate for a non-default currency", () => {
    expect(
      buildCreateCurrencyRequest({
        code: "EUR",
        name: "Euro",
        symbol: "",
        decimalPlaces: "2",
        exchangeRate: "0.92345678",
        isDefault: false,
      }),
    ).toEqual({ code: "EUR", name: "Euro", decimalPlaces: 2, exchangeRate: 0.92345678 });

    expect(() =>
      buildCreateCurrencyRequest({
        code: "EUR",
        name: "Euro",
        symbol: "",
        decimalPlaces: "2",
        exchangeRate: "",
        isDefault: false,
      }),
    ).toThrow("CURRENCY_FORM_RATE");
  });

  it("never sends an exchange rate for the default currency on update", () => {
    const current = parseCurrencyResponse({ ...currency, isDefault: true, exchangeRate: "1" });
    const form = { ...toCurrencyForm(current), exchangeRate: "7" };

    expect(buildUpdateCurrencyRequest(current, form)).toEqual({});
  });

  it("sends only the changed keys, and never the immutable code", () => {
    const current = parseCurrencyResponse(currency);

    expect(buildUpdateCurrencyRequest(current, toCurrencyForm(current))).toEqual({});
    const request = buildUpdateCurrencyRequest(current, {
      ...toCurrencyForm(current),
      name: "Euro area",
    });
    expect(request).toEqual({ name: "Euro area" });
    expect("code" in request).toBe(false);
  });

  it("rejects a page whose row carries an unknown status", () => {
    expect(() =>
      parseCurrenciesResponse({
        items: [{ ...currency, status: "ARCHIVED" }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    ).toThrow("Invalid Core currencies response.");
  });
});
