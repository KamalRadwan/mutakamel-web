import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import {
  CURRENCIES_PATH,
  CURRENCY_COMPANY_IN_USE_CODE,
  CURRENCY_IN_USE_CODE,
  CURRENCY_PRECISION_MISMATCH_CODE,
  CURRENCY_REBASE_OUT_OF_RANGE_CODE,
  CURRENCY_REBASE_PRECISION_LOSS_CODE,
  INVALID_CURRENCIES_RESPONSE_MESSAGE,
  buildCreateCurrencyRequest,
  buildUpdateCurrencyRequest,
  currenciesListPath,
  currenciesListQuery,
  currencyPath,
  fetchCurrenciesPage,
  formatCurrencyLabel,
  parseCurrenciesResponse,
  parseCurrencyResponse,
  setDefaultCurrencyPath,
  toCurrencyForm,
  type CreateCurrencyRequest,
  type CurrenciesListOptions,
  type UpdateCurrencyRequest,
} from "./currency-contract";
import {
  currencyFormMessage,
  currencyMutationFallbackError,
  currencyMutationMessage,
  describeCurrencyQueryError,
  normalizeCurrencyQueryError,
} from "./hooks/currency-errors";
import {
  DEFAULT_CURRENCY_MINOR_UNITS,
  ISO4217_MINOR_UNIT_EXCEPTIONS,
  ISO4217_NON_SPENDABLE_CODES,
  currencyMinorUnits,
  deriveCurrencyMinorUnits,
  supportedSpendableCurrencyCodes,
} from "./iso4217-minor-units";

afterEach(() => vi.restoreAllMocks());

const currencyId = "01902001-3000-7000-8000-000000000001";
const secondCurrencyId = "01902001-3000-7000-8000-000000000002";
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

function okResponse(data: unknown): AxiosResponse<unknown> {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

describe("Core currencies contract", () => {
  it("uses canonical Gateway paths, URLSearchParams list queries, and human labels", () => {
    expect(CURRENCIES_PATH).toBe("/api/tenant/core/v1/currencies");
    expect(currencyPath(currencyId)).toBe(`${CURRENCIES_PATH}/${currencyId}`);
    expect(setDefaultCurrencyPath(currencyId)).toBe(`${CURRENCIES_PATH}/${currencyId}/set-default`);
    expect(() => currencyPath("not-a-uuid")).toThrow(INVALID_CURRENCIES_RESPONSE_MESSAGE);

    const options: CurrenciesListOptions = {
      page: 2,
      status: "ACTIVE",
      search: " eu ro ",
      sortBy: "exchangeRate",
      sortDir: "DESC",
    };
    const query = currenciesListQuery(options);
    expect(query).toBe(
      "page=2&limit=20&sortBy=exchangeRate&sortDir=DESC&search=eu+ro&status=ACTIVE",
    );
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({
      page: "2",
      limit: "20",
      sortBy: "exchangeRate",
      sortDir: "DESC",
      search: "eu ro",
      status: "ACTIVE",
    });
    expect(currenciesListPath(2, "ACTIVE", "eu ro")).toBe(
      `${CURRENCIES_PATH}?page=2&limit=20&sortBy=code&sortDir=ASC&search=eu+ro&status=ACTIVE`,
    );

    const parsed = parseCurrencyResponse(currency);
    expect(formatCurrencyLabel(parsed)).toBe("Euro (EUR)");
    expect(formatCurrencyLabel(parsed)).not.toContain(currencyId);
  });

  it("reads canonical Core { data, meta } envelopes via readCorePage and preserves decimal strings", async () => {
    const controller = new AbortController();
    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValueOnce(
      okResponse({
        success: true,
        status: "SUCCESS",
        statusCode: 200,
        data: [currency],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    );

    const page = await fetchCurrenciesPage({
      page: 1,
      sortBy: "exchangeRate",
      sortDir: "ASC",
      signal: controller.signal,
    });

    expect(getSpy).toHaveBeenCalledWith(
      `${CURRENCIES_PATH}?page=1&limit=20&sortBy=exchangeRate&sortDir=ASC`,
      expect.objectContaining({
        signal: controller.signal,
        cache: "no-store",
        suppressForbiddenToast: true,
        maxResponseBytes: 400_000,
      }),
    );
    expect(page.items[0].exchangeRate).toBe("0.92345678");
    expect(toCurrencyForm(page.items[0]).exchangeRate).toBe("0.92345678");
    expect(page.totalPages).toBe(1);
  });

  it("accepts empty/out-of-range meta and rejects legacy shapes, bad meta, duplicate ids, numeric rates, and unknown status", () => {
    expect(
      parseCurrenciesResponse({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      }),
    ).toMatchObject({ items: [], total: 0, totalPages: 0, hasPrev: false });

    expect(
      parseCurrenciesResponse({
        data: [],
        meta: { page: 2, limit: 20, total: 20, totalPages: 1, hasNext: false, hasPrev: true },
      }),
    ).toMatchObject({ items: [], page: 2, total: 20, totalPages: 1, hasPrev: true });

    const validMeta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
    expect(() => parseCurrenciesResponse({ items: [currency], total: 1, page: 1, limit: 20 })).toThrow(
      INVALID_CURRENCIES_RESPONSE_MESSAGE,
    );
    expect(() => parseCurrenciesResponse([currency])).toThrow(INVALID_CURRENCIES_RESPONSE_MESSAGE);
    expect(() => parseCurrenciesResponse({ data: [currency] })).toThrow(INVALID_CURRENCIES_RESPONSE_MESSAGE);
    expect(() =>
      parseCurrenciesResponse({
        data: [currency, { ...currency, code: "USD" }],
        meta: { ...validMeta, total: 2 },
      }),
    ).toThrow(INVALID_CURRENCIES_RESPONSE_MESSAGE);
    expect(() =>
      parseCurrenciesResponse({
        data: [{ ...currency, id: secondCurrencyId, exchangeRate: 0.92 }],
        meta: validMeta,
      }),
    ).toThrow(INVALID_CURRENCIES_RESPONSE_MESSAGE);
    expect(() =>
      parseCurrenciesResponse({ data: [{ ...currency, status: "ARCHIVED" }], meta: validMeta }),
    ).toThrow(INVALID_CURRENCIES_RESPONSE_MESSAGE);

    const noOptionals = parseCurrencyResponse({ ...currency, exchangeRate: null, symbol: null });
    expect(noOptionals.exchangeRate).toBeNull();
    expect(noOptionals.symbol).toBeNull();
  });

  it("derives ISO-4217 minor units from canonical server exceptions and omits decimalPlaces on create", () => {
    const entries = Object.entries(ISO4217_MINOR_UNIT_EXCEPTIONS);
    expect(DEFAULT_CURRENCY_MINOR_UNITS).toBe(2);
    expect(entries.filter(([, u]) => u === 0)).toHaveLength(17);
    expect(entries.filter(([, u]) => u === 3)).toHaveLength(7);
    expect(entries.filter(([, u]) => u === 4)).toHaveLength(2);
    expect(currencyMinorUnits("jpy")).toBe(0);
    expect(currencyMinorUnits("BHD")).toBe(3);
    expect(currencyMinorUnits("CLF")).toBe(4);
    expect(currencyMinorUnits("USD")).toBe(2);
    expect(deriveCurrencyMinorUnits("")).toBeNull();
    expect(deriveCurrencyMinorUnits("US")).toBeNull();
    expect(deriveCurrencyMinorUnits("JPY")).toBe(0);
    expect(deriveCurrencyMinorUnits("BHD")).toBe(3);
    expect(deriveCurrencyMinorUnits("CLF")).toBe(4);
    expect(deriveCurrencyMinorUnits("USD")).toBe(2);

    const spendable = supportedSpendableCurrencyCodes();
    expect(spendable.length).toBeGreaterThan(50);
    expect(spendable).toEqual(expect.arrayContaining(["USD", "EGP", "JPY", "BHD", "KWD"]));
    for (const nonSpendable of ["XDR", "XSU", "XUA", "XAU", "XAG", "XPD", "XPT", "XTS", "XXX"]) {
      expect(ISO4217_NON_SPENDABLE_CODES.has(nonSpendable)).toBe(true);
      expect(spendable).not.toContain(nonSpendable);
    }

    const enumeratedSpy = vi
      .spyOn(Intl, "supportedValuesOf")
      .mockReturnValueOnce(["usd", "clf", "XAU", "XDR", "XTS", "XXX", "jpy", "USD", "bad1", "12"]);
    expect(supportedSpendableCurrencyCodes()).toEqual(["CLF", "JPY", "USD"]);
    enumeratedSpy.mockImplementationOnce(() => {
      throw new RangeError("Unsupported key");
    });
    expect(supportedSpendableCurrencyCodes()).toEqual([]);
    enumeratedSpy.mockRestore();

    const firstDefault: CreateCurrencyRequest = buildCreateCurrencyRequest({
      code: "usd",
      name: " US Dollar ",
      symbol: "$",
      decimalPlaces: "2",
      exchangeRate: " ",
      isDefault: true,
    });
    expect(firstDefault).toEqual({
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      isDefault: true,
    });
    expect("decimalPlaces" in firstDefault).toBe(false);
    expect(
      buildCreateCurrencyRequest({
        code: "egp",
        name: "Egyptian Pound",
        symbol: "",
        decimalPlaces: "",
        exchangeRate: " 50 ",
        isDefault: true,
      }),
    ).toEqual({ code: "EGP", name: "Egyptian Pound", exchangeRate: 50, isDefault: true });

    expect(() =>
      buildCreateCurrencyRequest({
        code: "U1D",
        name: "Invalid Code",
        symbol: "$",
        decimalPlaces: "2",
        exchangeRate: "1",
        isDefault: false,
      }),
    ).toThrow("CURRENCY_FORM_CODE");
    expect(() =>
      buildCreateCurrencyRequest({
        code: "USD",
        name: "US Dollar",
        symbol: "123456789",
        decimalPlaces: "2",
        exchangeRate: "1",
        isDefault: false,
      }),
    ).toThrow("CURRENCY_FORM_SYMBOL");
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
    expect(() =>
      buildCreateCurrencyRequest({
        code: "EGP",
        name: "Egyptian Pound",
        symbol: "",
        decimalPlaces: "2",
        exchangeRate: "1.123456789",
        isDefault: true,
      }),
    ).toThrow("CURRENCY_FORM_RATE");

    const defaultRow = parseCurrencyResponse({ ...currency, isDefault: true, exchangeRate: "1" });
    expect(buildUpdateCurrencyRequest(defaultRow, { ...toCurrencyForm(defaultRow), exchangeRate: "7" })).toEqual({});

    const nonDefault = parseCurrencyResponse(currency);
    expect(() =>
      buildUpdateCurrencyRequest(nonDefault, { ...toCurrencyForm(nonDefault), symbol: "123456789" }),
    ).toThrow("CURRENCY_FORM_SYMBOL");
    expect(() =>
      buildUpdateCurrencyRequest(nonDefault, { ...toCurrencyForm(nonDefault), exchangeRate: " " }),
    ).toThrow("CURRENCY_FORM_RATE");
    const patch: UpdateCurrencyRequest = buildUpdateCurrencyRequest(nonDefault, {
      ...toCurrencyForm(nonDefault),
      name: "Euro area",
      decimalPlaces: "4",
    });
    expect(patch).toEqual({ name: "Euro area" });
    expect("code" in patch).toBe(false);
    expect("decimalPlaces" in patch).toBe(false);
  });

  it("maps malformed responses, server errors, and domain codes without raw wire leaks", () => {
    const malformed = normalizeCurrencyQueryError(new Error(INVALID_CURRENCIES_RESPONSE_MESSAGE));
    expect(malformed.status).toBe(502);
    expect(describeCurrencyQueryError(malformed, en).description).toContain(en.coreIdentity.errors.UNKNOWN);
    expect(describeCurrencyQueryError(malformed, en).description).not.toContain(en.coreIdentity.errors.OFFLINE);

    const server500 = normalizeCurrencyQueryError(
      new TenantApiClientError("Internal crash", {
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        data: {
          errorCode: "UNEXPECTED_DB_FAILURE",
          message: "Raw backend English detail",
          correlationId: "01902001-3000-7000-8000-000000000099",
        },
      }),
    );
    const copy = describeCurrencyQueryError(server500, en);
    expect(copy.title).toBe(en.coreSettings.currencyLoadFailed);
    expect(copy.description).not.toContain("Raw backend English detail");
    expect(copy.description).toContain("01902001-3000-7000-8000-000000000099");

    expect(currencyMutationMessage(CURRENCY_IN_USE_CODE, en)).toBe(en.coreSettings.currencyInUse);
    expect(currencyMutationMessage(CURRENCY_IN_USE_CODE, ar)).toBe(ar.coreSettings.currencyInUse);
    expect(currencyMutationMessage(CURRENCY_COMPANY_IN_USE_CODE, en)).toBe(
      en.coreSettings.currencyCompanyInUse,
    );
    expect(currencyMutationMessage(CURRENCY_COMPANY_IN_USE_CODE, ar)).toBe(
      ar.coreSettings.currencyCompanyInUse,
    );
    expect(currencyMutationMessage(CURRENCY_PRECISION_MISMATCH_CODE, en)).toBe(
      en.coreSettings.currencyPrecisionMismatch,
    );
    expect(currencyMutationMessage(CURRENCY_PRECISION_MISMATCH_CODE, ar)).toBe(
      ar.coreSettings.currencyPrecisionMismatch,
    );
    expect(currencyMutationMessage(CURRENCY_REBASE_OUT_OF_RANGE_CODE, en)).toBe(
      en.coreSettings.currencyRebaseOutOfRange,
    );
    expect(currencyMutationMessage(CURRENCY_REBASE_PRECISION_LOSS_CODE, en)).toBe(
      en.coreSettings.currencyRebasePrecisionLoss,
    );
    expect(currencyMutationMessage(CURRENCY_REBASE_PRECISION_LOSS_CODE, ar)).toBe(
      ar.coreSettings.currencyRebasePrecisionLoss,
    );
    expect(currencyMutationFallbackError({ status: 0 }, en).message).toBe(en.coreIdentity.errors.OFFLINE);
    expect(currencyFormMessage(new Error("CURRENCY_FORM_CODE"), en, "create")).toBe(
      en.coreSettings.currencyFormCode,
    );
    expect(currencyFormMessage(new Error("CURRENCY_FORM_SYMBOL"), en, "create")).toBe(
      en.coreSettings.currencyFormSymbol,
    );
    expect(currencyFormMessage(new Error("CURRENCY_FORM_SYMBOL"), ar, "update")).toBe(
      ar.coreSettings.currencyFormSymbol,
    );
  });
});
