import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import {
  CURRENCIES_PATH,
  CURRENCY_CODE_INVALID_CODE,
  CURRENCY_CODE_TAKEN_CODE,
  CURRENCY_COMPANY_IN_USE_CODE,
  CURRENCY_DEFAULT_DELETE_CODE,
  CURRENCY_INACTIVE_DEFAULT_CODE,
  CURRENCY_IN_USE_CODE,
  CURRENCY_RATE_REQUIRED_CODE,
  CURRENCY_REBASE_OUT_OF_RANGE_CODE,
  CURRENCY_REBASE_PRECISION_LOSS_CODE,
  INVALID_CURRENCIES_RESPONSE_MESSAGE,
  buildCreateCurrencyRequest,
  buildUpdateCurrencyRequest,
  currenciesListPath,
  currenciesListQuery,
  fetchBaseCurrency,
  hasValidSavedExchangeRate,
  isValidTypedExchangeRate,
  parseCurrencyResponse,
  resolveCurrencyListFilter,
  toCurrencyForm,
} from "./currency-contract";
import {
  normalizeCurrencyQueryError,
  resolveCurrencyActionBlocker,
  resolveCurrencyFormFailure,
} from "./hooks/currency-errors";

afterEach(() => vi.restoreAllMocks());

const usdId = "01902001-3000-7000-8000-000000000011";
const eurId = "01902001-3000-7000-8000-000000000012";

const usdPayload = {
  id: usdId,
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  decimalPlaces: 2,
  isDefault: true,
  exchangeRate: "1.00000000",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const inactiveEurPayload = {
  id: eurId,
  code: "EUR",
  name: "Euro",
  symbol: "€",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.92345678",
  status: "INACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

function okResponse(data: unknown): AxiosResponse<unknown> {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

describe("Core currencies T02 query, activation, and error helpers", () => {
  it("serializes isDefault and custom limit query params and reads fetchBaseCurrency via isDefault=true", async () => {
    expect(currenciesListQuery({ page: 1, isDefault: true })).toBe(
      "page=1&limit=20&sortBy=code&sortDir=ASC&isDefault=true",
    );
    expect(currenciesListQuery({ page: 1, status: "ACTIVE", isDefault: false })).toBe(
      "page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&isDefault=false",
    );
    expect(currenciesListPath(1, "INACTIVE", "", "code", "ASC", false)).toBe(
      `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=INACTIVE&isDefault=false`,
    );

    const controller = new AbortController();
    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValueOnce(
      okResponse({
        success: true,
        data: [usdPayload],
        meta: { page: 1, limit: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    );

    const base = await fetchBaseCurrency(controller.signal);
    expect(getSpy).toHaveBeenCalledWith(
      `${CURRENCIES_PATH}?page=1&limit=1&sortBy=code&sortDir=ASC&isDefault=true`,
      expect.objectContaining({
        signal: controller.signal,
        cache: "no-store",
        suppressForbiddenToast: true,
      }),
    );
    expect(base?.code).toBe("USD");
    expect(base?.isDefault).toBe(true);

    getSpy.mockResolvedValueOnce(
      okResponse({
        success: true,
        data: [],
        meta: { page: 1, limit: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      }),
    );
    expect(await fetchBaseCurrency()).toBeNull();
  });

  it("validates saved decimal rate strings without float coercion, rejects 1000000000.00000001 on typed input, and omits unchanged high stored rates on edit", () => {
    expect(hasValidSavedExchangeRate(null)).toBe(false);
    expect(hasValidSavedExchangeRate("")).toBe(false);
    expect(hasValidSavedExchangeRate("   ")).toBe(false);
    expect(hasValidSavedExchangeRate("0")).toBe(false);
    expect(hasValidSavedExchangeRate("0.00000000")).toBe(false);
    expect(hasValidSavedExchangeRate("-1.25")).toBe(false);
    expect(hasValidSavedExchangeRate("1.123456789")).toBe(false);
    expect(hasValidSavedExchangeRate("0.00000001")).toBe(true);
    expect(hasValidSavedExchangeRate("50.25000000")).toBe(true);
    expect(hasValidSavedExchangeRate("9000000000.12345678")).toBe(true);

    expect(isValidTypedExchangeRate("0.00000001")).toBe(true);
    expect(isValidTypedExchangeRate("1000000000")).toBe(true);
    expect(isValidTypedExchangeRate("1000000000.00000000")).toBe(true);
    expect(isValidTypedExchangeRate("1000000000.00000001")).toBe(false);
    expect(isValidTypedExchangeRate("9000000000.12345678")).toBe(false);

    expect(() =>
      buildCreateCurrencyRequest({
        code: "LBP",
        name: "Lebanese Pound",
        symbol: "L£",
        decimalPlaces: "2",
        exchangeRate: "1000000000.00000001",
        isDefault: false,
      }),
    ).toThrow("CURRENCY_FORM_RATE");

    const rebasedHighRateRow = parseCurrencyResponse({
      ...inactiveEurPayload,
      status: "ACTIVE",
      exchangeRate: "9000000000.12345678",
    });
    const nameOnlyPatch = buildUpdateCurrencyRequest(rebasedHighRateRow, {
      ...toCurrencyForm(rebasedHighRateRow),
      name: "Euro Rebased",
      symbol: "€€",
    });
    expect(nameOnlyPatch).toEqual({ name: "Euro Rebased", symbol: "€€" });
    expect("exchangeRate" in nameOnlyPatch).toBe(false);

    expect(() =>
      buildUpdateCurrencyRequest(rebasedHighRateRow, {
        ...toCurrencyForm(rebasedHighRateRow),
        exchangeRate: "1000000000.00000001",
      }),
    ).toThrow("CURRENCY_FORM_RATE");

    expect(resolveCurrencyListFilter(undefined)).toEqual({});
    expect(resolveCurrencyListFilter("ACTIVE")).toEqual({ status: "ACTIVE" });
    expect(resolveCurrencyListFilter("INACTIVE")).toEqual({ status: "INACTIVE" });
    expect(resolveCurrencyListFilter("DEFAULT")).toEqual({ isDefault: true });
    expect(resolveCurrencyListFilter("NON_DEFAULT")).toEqual({ isDefault: false });

    const inactiveWithRate = parseCurrencyResponse(inactiveEurPayload);
    expect(
      buildUpdateCurrencyRequest(inactiveWithRate, toCurrencyForm(inactiveWithRate), {
        activate: true,
      }),
    ).toEqual({ status: "ACTIVE" });

    const inactiveWithoutRate = parseCurrencyResponse({
      ...inactiveEurPayload,
      exchangeRate: null,
    });
    expect(() =>
      buildUpdateCurrencyRequest(inactiveWithoutRate, toCurrencyForm(inactiveWithoutRate), {
        activate: true,
      }),
    ).toThrow("CURRENCY_FORM_RATE");

    expect(
      buildUpdateCurrencyRequest(
        inactiveWithoutRate,
        { ...toCurrencyForm(inactiveWithoutRate), exchangeRate: "0.95" },
        { activate: true },
      ),
    ).toEqual({ status: "ACTIVE", exchangeRate: 0.95 });

    const defaultRow = parseCurrencyResponse(usdPayload);
    expect(
      buildUpdateCurrencyRequest(defaultRow, toCurrencyForm(defaultRow), { activate: true }),
    ).toEqual({});
  });

  it("resolves structured domain blockers and form error codes without leaking raw wire messages", () => {
    const eur = parseCurrencyResponse(inactiveEurPayload);
    const corrId = "01902001-3000-7000-8000-000000000077";

    const makeError = (status: number, errorCode: string) =>
      normalizeCurrencyQueryError(
        new TenantApiClientError("Raw server English message", {
          status,
          statusText: "Conflict",
          headers: new Headers(),
          data: {
            success: false,
            status: "ERROR",
            statusCode: status,
            errorCode,
            message: "Raw server English message",
            correlationId: corrId,
          },
        }),
      );

    const companyBlocker = resolveCurrencyActionBlocker(
      makeError(409, CURRENCY_COMPANY_IN_USE_CODE),
      "deactivate",
      eur,
      en,
    );
    expect(companyBlocker).toMatchObject({
      kind: "deactivate",
      code: CURRENCY_COMPANY_IN_USE_CODE,
      currency: eur,
    });
    expect(companyBlocker?.reason).toContain(en.coreSettings.currencyCompanyInUse);
    expect(companyBlocker?.reason).toContain(corrId);
    expect(companyBlocker?.reason).not.toContain("Raw server English message");

    expect(
      resolveCurrencyActionBlocker(makeError(409, CURRENCY_IN_USE_CODE), "deactivate", eur, ar)
        ?.reason,
    ).toContain(ar.coreSettings.currencyInUse);
    expect(
      resolveCurrencyActionBlocker(
        makeError(409, CURRENCY_DEFAULT_DELETE_CODE),
        "deactivate",
        eur,
        en,
      )?.code,
    ).toBe(CURRENCY_DEFAULT_DELETE_CODE);

    expect(
      resolveCurrencyActionBlocker(
        makeError(422, CURRENCY_INACTIVE_DEFAULT_CODE),
        "setDefault",
        eur,
        en,
      )?.reason,
    ).toContain(en.coreSettings.currencyInactiveDefault);
    expect(
      resolveCurrencyActionBlocker(
        makeError(422, CURRENCY_REBASE_OUT_OF_RANGE_CODE),
        "setDefault",
        eur,
        en,
      )?.reason,
    ).toContain(en.coreSettings.currencyRebaseOutOfRange);
    expect(
      resolveCurrencyActionBlocker(
        makeError(422, CURRENCY_REBASE_PRECISION_LOSS_CODE),
        "setDefault",
        eur,
        ar,
      )?.reason,
    ).toContain(ar.coreSettings.currencyRebasePrecisionLoss);
    expect(
      resolveCurrencyActionBlocker(makeError(500, "INTERNAL_ERROR"), "deactivate", eur, en),
    ).toBeNull();

    const duplicateFailure = resolveCurrencyFormFailure(
      new TenantApiClientError("Raw duplicate message", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: { errorCode: CURRENCY_CODE_TAKEN_CODE, message: "Raw duplicate message" },
      }),
      en,
      "create",
    );
    expect(duplicateFailure).toEqual({
      message: en.coreSettings.currencyCodeTaken,
      code: CURRENCY_CODE_TAKEN_CODE,
    });

    expect(
      resolveCurrencyFormFailure(
        new TenantApiClientError("Raw invalid code", {
          status: 422,
          statusText: "Unprocessable",
          headers: new Headers(),
          data: { errorCode: CURRENCY_CODE_INVALID_CODE, message: "Raw invalid code" },
        }),
        ar,
        "create",
      ),
    ).toEqual({
      message: ar.coreSettings.currencyCodeInvalid,
      code: CURRENCY_CODE_INVALID_CODE,
    });

    expect(
      resolveCurrencyFormFailure(
        new TenantApiClientError("Raw rate error", {
          status: 422,
          statusText: "Unprocessable",
          headers: new Headers(),
          data: { errorCode: CURRENCY_RATE_REQUIRED_CODE, message: "Raw rate error" },
        }),
        en,
        "update",
      ),
    ).toEqual({
      message: en.coreSettings.currencyRateRequired,
      code: CURRENCY_RATE_REQUIRED_CODE,
    });

    const malformedWrite = resolveCurrencyFormFailure(
      new Error(INVALID_CURRENCIES_RESPONSE_MESSAGE),
      en,
      "create",
    );
    expect(malformedWrite.code).toBe("INVALID_CURRENCIES_RESPONSE");
    expect(malformedWrite.message).toContain(en.coreIdentity.errors.UNKNOWN);
  });
});
