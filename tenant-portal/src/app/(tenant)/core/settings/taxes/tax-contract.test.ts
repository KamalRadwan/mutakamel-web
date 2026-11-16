import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import { readCorePage } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import { companyLabel } from "../company-options";
import {
  COMPANY_INVALID_CODE,
  EMPTY_TAX_FORM,
  INVALID_TAXES_RESPONSE_MESSAGE,
  TAXES_PATH,
  TAX_CODE_MAX_LENGTH,
  TAX_CODE_TAKEN_CODE,
  TAX_NAME_MAX_LENGTH,
  TAX_NOT_FOUND_CODE,
  TAX_PAGE_SIZE,
  TAX_SORT_FIELDS,
  buildCreateTaxRequest,
  buildTaxesListQuery,
  buildUpdateTaxRequest,
  isValidTaxRateInput,
  parseTaxResponse,
  parseTaxesResponse,
  taxPath,
  toTaxForm,
  type CreateTaxRequest,
  type TaxFormValues,
  type TaxSortField,
  type UpdateTaxRequest,
} from "./tax-contract";
import {
  formatTaxCompanyOptionsFailure,
  formatTaxQueryFailure,
  isAbortError,
  normalizeTaxQueryError,
  resolveTaxDeactivateToastMessage,
  resolveTaxFormWriteError,
  resolveTaxReactivateError,
} from "./tax-errors";

const taxId = "01902001-3000-7000-8000-000000000002";
const secondTaxId = "01902001-3000-7000-8000-000000000003";
const companyId = "01902001-3000-7000-8000-0000000000c1";
const correlationId = "01902001-3000-7000-8000-000000009999";

const wireTax = {
  id: taxId,
  code: "VAT14",
  name: "Standard VAT",
  rate: "14.0000",
  isInclusive: false,
  companyId,
  status: "ACTIVE",
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

function coreHttpPageResponse(
  rows: unknown[],
  overrides: Partial<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> = {},
): AxiosResponse<unknown> {
  const page = overrides.page ?? 1;
  const limit = overrides.limit ?? TAX_PAGE_SIZE;
  const total = overrides.total ?? rows.length;
  const totalPages = overrides.totalPages ?? (total === 0 ? 0 : Math.ceil(total / limit));
  return {
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    data: {
      success: true,
      status: "SUCCESS",
      statusCode: 200,
      code: "TAXES_LISTED",
      message: "Taxes retrieved.",
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: overrides.hasNext ?? page < totalPages,
        hasPrev: overrides.hasPrev ?? page > 1,
      },
      correlationId,
      timestamp: "2026-11-01T10:00:00.000Z",
    },
  };
}

function apiError(status: number, errorCode: string, message: string, corrId?: string) {
  return new TenantApiClientError(message, {
    status,
    statusText: "Error",
    headers: new Headers(),
    data: {
      success: false,
      status: "ERROR",
      statusCode: status,
      errorCode,
      message,
      ...(corrId ? { correlationId: corrId } : {}),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Core taxes contract", () => {
  it("uses canonical Gateway paths and builds validated list query strings", () => {
    expect(TAXES_PATH).toBe("/api/tenant/core/v1/taxes");
    expect(taxPath(taxId)).toBe(`${TAXES_PATH}/${taxId}`);
    expect(() => taxPath("550e8400-e29b-41d4-a716-446655440000")).toThrow(
      INVALID_TAXES_RESPONSE_MESSAGE,
    );

    const sortField: TaxSortField = TAX_SORT_FIELDS[2];
    expect(sortField).toBe("rate");
    const listQuery = buildTaxesListQuery({
      page: 2,
      status: "ACTIVE",
      companyId,
      isInclusive: true,
      search: "  vat  ",
      sortBy: sortField,
      sortDir: "DESC",
    });
    expect(listQuery).toBe(
      `page=2&limit=20&sortBy=rate&sortDir=DESC&search=vat&status=ACTIVE&companyId=${companyId}&isInclusive=true`,
    );
    expect(Object.fromEntries(new URLSearchParams(listQuery).entries())).toEqual({
      page: "2",
      limit: "20",
      sortBy: "rate",
      sortDir: "DESC",
      search: "vat",
      status: "ACTIVE",
      companyId,
      isInclusive: "true",
    });

    const exclusiveQuery = buildTaxesListQuery({
      page: 1,
      isInclusive: false,
      search: "",
    });
    expect(exclusiveQuery).toBe("page=1&limit=20&sortBy=code&sortDir=ASC&isInclusive=false");

    expect(() =>
      buildTaxesListQuery({
        page: 1,
        companyId: "not-a-uuid-v7",
        search: "",
      }),
    ).toThrow("TAX_FORM_COMPANY");
  });

  it("parses the real Core { success, data, meta } transport envelope via readCorePage and preserves decimal rate strings", async () => {
    const precisionTax = {
      ...wireTax,
      id: secondTaxId,
      code: "WHT0125",
      name: "Withholding 0.125%",
      rate: "0.1250",
      isInclusive: true,
      companyId: null,
    };
    const getSpy = vi
      .spyOn(axiosClient, "get")
      .mockResolvedValueOnce(coreHttpPageResponse([wireTax, precisionTax]));

    const envelope = await readCorePage(
      TAXES_PATH,
      buildTaxesListQuery({ page: 1, search: "" }),
      { suppressForbiddenToast: true },
    );
    const parsed = parseTaxesResponse(envelope);

    expect(getSpy).toHaveBeenCalledWith(
      `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC`,
      expect.objectContaining({ suppressForbiddenToast: true }),
    );
    expect(parsed.total).toBe(2);
    expect(parsed.totalPages).toBe(1);
    expect(parsed.items[0]?.rate).toBe("14.0000");
    expect(parsed.items[1]?.rate).toBe("0.1250");
    expect(parsed.items[1]?.companyId).toBeNull();
    expect(toTaxForm(parsed.items[0])).toEqual({
      code: "VAT14",
      name: "Standard VAT",
      rate: "14.0000",
      isInclusive: false,
      companyId,
      status: "ACTIVE",
    });
  });

  it("accepts empty first pages and out-of-range page metadata for last-page recovery", () => {
    const withoutCompany: Record<string, unknown> = { ...wireTax };
    delete withoutCompany.companyId;
    expect(parseTaxResponse(withoutCompany).companyId).toBeNull();

    const emptyFirst = parseTaxesResponse({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });
    expect(emptyFirst.items).toEqual([]);
    expect(emptyFirst.totalPages).toBe(0);

    const outOfRangeNonEmpty = parseTaxesResponse({
      data: [],
      meta: { page: 2, limit: 20, total: 20, totalPages: 1, hasNext: false, hasPrev: true },
    });
    expect(outOfRangeNonEmpty.totalPages).toBe(1);

    const outOfRangeEmpty = parseTaxesResponse({
      data: [],
      meta: { page: 2, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: true },
    });
    expect(outOfRangeEmpty.totalPages).toBe(0);
  });

  it("rejects legacy { items, total } payloads, missing meta, numeric wire rates, and duplicate IDs", async () => {
    expect(() =>
      parseTaxesResponse({
        data: { items: [wireTax], total: 1, page: 1, limit: 20 },
        meta: undefined,
      }),
    ).toThrow(INVALID_TAXES_RESPONSE_MESSAGE);

    expect(() =>
      parseTaxesResponse({
        data: [{ ...wireTax, rate: 14 }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    ).toThrow(INVALID_TAXES_RESPONSE_MESSAGE);

    expect(() =>
      parseTaxesResponse({
        data: [wireTax, { ...wireTax, code: "DUP" }],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    ).toThrow(INVALID_TAXES_RESPONSE_MESSAGE);

    expect(() =>
      parseTaxResponse({ ...wireTax, code: "X".repeat(TAX_CODE_MAX_LENGTH + 1) }),
    ).toThrow(INVALID_TAXES_RESPONSE_MESSAGE);
    expect(() =>
      parseTaxResponse({ ...wireTax, name: "X".repeat(TAX_NAME_MAX_LENGTH + 1) }),
    ).toThrow(INVALID_TAXES_RESPONSE_MESSAGE);

    vi.spyOn(axiosClient, "get").mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      data: { success: true, data: { items: [wireTax], total: 1, page: 1, limit: 20 } },
    });
    const legacyEnvelope = await readCorePage(TAXES_PATH, "page=1&limit=20");
    expect(() => parseTaxesResponse(legacyEnvelope)).toThrow(INVALID_TAXES_RESPONSE_MESSAGE);
  });

  it("validates CreateTaxRequest and keeps UpdateTaxRequest free of immutable scope keys", () => {
    expect(EMPTY_TAX_FORM).toEqual({
      code: "",
      name: "",
      rate: "",
      isInclusive: false,
      companyId: null,
    });

    const created: CreateTaxRequest = buildCreateTaxRequest({
      code: " vat14 ",
      name: " Standard VAT ",
      rate: "14.25",
      isInclusive: true,
      companyId,
    });
    expect(created).toEqual({
      code: "VAT14",
      name: "Standard VAT",
      rate: 14.25,
      isInclusive: true,
      companyId,
    });

    const base: TaxFormValues = {
      code: "VAT",
      name: "VAT",
      rate: "14",
      isInclusive: false,
      companyId: null,
    };
    expect(() => buildCreateTaxRequest({ ...base, code: " " })).toThrow("TAX_FORM_CODE");
    expect(() => buildCreateTaxRequest({ ...base, name: " " })).toThrow("TAX_FORM_NAME");
    expect(() => buildCreateTaxRequest({ ...base, rate: "101" })).toThrow("TAX_FORM_RATE");
    expect(() => buildCreateTaxRequest({ ...base, rate: "14.00001" })).toThrow("TAX_FORM_RATE");
    expect(() => buildCreateTaxRequest({ ...base, rate: "" })).toThrow("TAX_FORM_RATE");
    expect(() =>
      buildCreateTaxRequest({ ...base, companyId: "not-a-uuid-v7" }),
    ).toThrow("TAX_FORM_COMPANY");

    const current = parseTaxResponse(wireTax);
    const updated: UpdateTaxRequest = buildUpdateTaxRequest(current, {
      ...toTaxForm(current),
      code: "IGNORED",
      companyId: null,
      name: "Updated VAT",
      rate: "15",
      status: "INACTIVE",
    });
    expect(updated).toEqual({ name: "Updated VAT", rate: 15, status: "INACTIVE" });
    expect("code" in updated).toBe(false);
    expect("companyId" in updated).toBe(false);

    // Equivalent rate formatting ("14" vs wire "14.0000") and unchanged status are omitted.
    expect(
      buildUpdateTaxRequest(current, {
        ...toTaxForm(current),
        rate: "14",
        status: "ACTIVE",
      }),
    ).toEqual({});

    expect(isValidTaxRateInput("0")).toBe(true);
    expect(isValidTaxRateInput("100")).toBe(true);
    expect(isValidTaxRateInput("14.1234")).toBe(true);
    expect(isValidTaxRateInput("-0.01")).toBe(false);
    expect(isValidTaxRateInput("100.0001")).toBe(false);
    expect(isValidTaxRateInput("14.12345")).toBe(false);
    expect(() =>
      buildUpdateTaxRequest(current, {
        ...toTaxForm(current),
        rate: "100.01",
      }),
    ).toThrow("TAX_FORM_RATE");
  });

  it("validates and compares exact 4-scale decimal rates without coercing stored decimals through Number()", () => {
    function captureNumberCalls<T>(run: () => T): { result: T; calls: unknown[] } {
      const numberSpy = vi.spyOn(globalThis, "Number");
      let calls: unknown[] = [];
      try {
        const result = run();
        calls = numberSpy.mock.calls.map((args) => args[0] as unknown);
        return { result, calls };
      } finally {
        numberSpy.mockRestore();
      }
    }

    const validInputs = [
      "0",
      "0.0000",
      "0.0001",
      "014.25",
      " 14.0000 ",
      "99.9999",
      "100",
      "100.0",
      "100.0000",
      "00100.0000",
    ];
    const invalidInputs = [
      "",
      "   ",
      "-0",
      "-0.0001",
      "+14",
      "100.0001",
      "100.1",
      "101",
      "1000",
      "14.12345",
      "14.",
      ".5",
      "1e2",
      "NaN",
      "Infinity",
    ];

    const validationRun = captureNumberCalls(() => ({
      valid: validInputs.map((input) => isValidTaxRateInput(input)),
      invalid: invalidInputs.map((input) => isValidTaxRateInput(input)),
    }));
    expect(validationRun.result.valid.every(Boolean)).toBe(true);
    expect(validationRun.result.invalid.some(Boolean)).toBe(false);
    expect(validationRun.calls).toEqual([]);

    const current = parseTaxResponse(wireTax);
    const zeroTax = parseTaxResponse({ ...wireTax, rate: "0.0000" });
    const maxTax = parseTaxResponse({ ...wireTax, rate: "100.0000" });
    const fractionalTax = parseTaxResponse({ ...wireTax, rate: "14.2500" });

    const unchangedRun = captureNumberCalls(() => ({
      nameOnly: buildUpdateTaxRequest(current, {
        ...toTaxForm(current),
        name: "Renamed VAT",
      }),
      equivalentVariants: ["14", "14.0", "14.00", "014.0000", " 14.0000 "].map((rate) =>
        buildUpdateTaxRequest(current, {
          ...toTaxForm(current),
          rate,
        }),
      ),
      zeroEquivalent: buildUpdateTaxRequest(zeroTax, { ...toTaxForm(zeroTax), rate: "0" }),
      maxEquivalent: buildUpdateTaxRequest(maxTax, { ...toTaxForm(maxTax), rate: "100" }),
      fractionalEquivalent: buildUpdateTaxRequest(fractionalTax, {
        ...toTaxForm(fractionalTax),
        rate: "14.25",
      }),
    }));
    expect(unchangedRun.calls).toEqual([]);
    expect(unchangedRun.result.nameOnly).toEqual({ name: "Renamed VAT" });
    expect("rate" in unchangedRun.result.nameOnly).toBe(false);
    expect("code" in unchangedRun.result.nameOnly).toBe(false);
    expect("companyId" in unchangedRun.result.nameOnly).toBe(false);
    expect(unchangedRun.result.equivalentVariants).toEqual([{}, {}, {}, {}, {}]);
    expect(unchangedRun.result.zeroEquivalent).toEqual({});
    expect(unchangedRun.result.maxEquivalent).toEqual({});
    expect(unchangedRun.result.fractionalEquivalent).toEqual({});

    const changedRun = captureNumberCalls(() =>
      buildUpdateTaxRequest(current, {
        ...toTaxForm(current),
        rate: " 15.2575 ",
      }),
    );
    expect(changedRun.calls).toEqual(["15.2575"]);
    expect(changedRun.result).toEqual({ rate: 15.2575 });
    expect(typeof changedRun.result.rate).toBe("number");
    expect("code" in changedRun.result).toBe(false);
    expect("companyId" in changedRun.result).toBe(false);

    expect(
      buildUpdateTaxRequest(current, { ...toTaxForm(current), rate: "0" }),
    ).toEqual({ rate: 0 });
    expect(
      buildUpdateTaxRequest(current, { ...toTaxForm(current), rate: "100.0000" }),
    ).toEqual({ rate: 100 });

    const rejectedRun = captureNumberCalls(() => {
      const thrown: string[] = [];
      for (const badDraft of ["100.0001", "14.12345", "-0.0001", "1e2"]) {
        try {
          buildUpdateTaxRequest(current, { ...toTaxForm(current), rate: badDraft });
        } catch (err) {
          thrown.push(err instanceof Error ? err.message : String(err));
        }
      }
      for (const malformedSaved of ["100.0001", "14.12345"]) {
        try {
          buildUpdateTaxRequest(
            { ...current, rate: malformedSaved },
            { ...toTaxForm(current), rate: "14.0000" },
          );
        } catch (err) {
          thrown.push(err instanceof Error ? err.message : String(err));
        }
      }
      return thrown;
    });
    expect(rejectedRun.calls).toEqual([]);
    expect(rejectedRun.result).toEqual([
      "TAX_FORM_RATE",
      "TAX_FORM_RATE",
      "TAX_FORM_RATE",
      "TAX_FORM_RATE",
      INVALID_TAXES_RESPONSE_MESSAGE,
      INVALID_TAXES_RESPONSE_MESSAGE,
    ]);
  });

  it.each([en, ar])("maps read and write failures to localized copy without leaking raw wire text", (t) => {
    const companies = [{ id: companyId, code: "ACME", name: "Acme Retail" }];
    expect(
      companyLabel(companies, companyId, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany),
    ).toBe("Acme Retail");

    const malformedFailure = formatTaxQueryFailure(
      normalizeTaxQueryError(new Error(INVALID_TAXES_RESPONSE_MESSAGE)),
      t,
    );
    expect(malformedFailure.title).toBe(t.coreSettings.taxLoadFailed);
    expect(malformedFailure.description).toBe(t.coreIdentity.errors.UNKNOWN);
    expect(malformedFailure.description).not.toBe(t.coreIdentity.errors.OFFLINE);

    const serverFailure = formatTaxQueryFailure(
      normalizeTaxQueryError(apiError(500, "INTERNAL_ERROR", "Raw SQL trace", correlationId)),
      t,
    );
    expect(serverFailure.title).toBe(t.coreSettings.taxLoadFailed);
    expect(serverFailure.description).toContain(correlationId);
    expect(serverFailure.description).not.toContain("Raw SQL trace");

    const duplicateInCompany = resolveTaxFormWriteError({
      error: apiError(409, TAX_CODE_TAKEN_CODE, "Duplicate code", correlationId),
      fallbackTitle: t.coreSettings.taxCreateFailed,
      scopeCompanyId: companyId,
      companies,
      t,
    });
    expect(duplicateInCompany.message).toContain("Acme Retail");
    expect(duplicateInCompany.message).toContain(correlationId);
    expect(duplicateInCompany.shouldReload).toBe(false);

    const invalidCompany = resolveTaxFormWriteError({
      error: apiError(422, COMPANY_INVALID_CODE, "Invalid company"),
      fallbackTitle: t.coreSettings.taxCreateFailed,
      scopeCompanyId: companyId,
      companies,
      t,
    });
    expect(invalidCompany.message).toBe(t.coreSettings.taxCompanyInvalid);

    const missingTax = resolveTaxFormWriteError({
      error: apiError(404, TAX_NOT_FOUND_CODE, "Missing tax", correlationId),
      fallbackTitle: t.coreSettings.taxUpdateFailed,
      scopeCompanyId: companyId,
      companies,
      t,
    });
    expect(missingTax.message).toContain(t.editDrawer.notFoundTitle);
    expect(missingTax.shouldReload).toBe(true);

    const unreadableWrite = resolveTaxFormWriteError({
      error: new Error(INVALID_TAXES_RESPONSE_MESSAGE),
      fallbackTitle: t.coreSettings.taxCreateFailed,
      scopeCompanyId: companyId,
      companies,
      t,
    });
    expect(unreadableWrite.message).toBe(t.coreSettings.invalidResponseDescription);
    expect(unreadableWrite.shouldReload).toBe(false);

    const oversizedWrite = resolveTaxFormWriteError({
      error: apiError(502, "API_RESPONSE_TOO_LARGE", "Response exceeded cap", correlationId),
      fallbackTitle: t.coreSettings.taxUpdateFailed,
      scopeCompanyId: companyId,
      companies,
      t,
    });
    expect(oversizedWrite.message).toContain(t.coreSettings.invalidResponseDescription);
    expect(oversizedWrite.message).toContain(correlationId);
    expect(oversizedWrite.shouldReload).toBe(false);

    const reactivateInvalidPayload = resolveTaxReactivateError(
      new Error(INVALID_TAXES_RESPONSE_MESSAGE),
      t,
    );
    expect(reactivateInvalidPayload.isInvalidResponse).toBe(true);
    expect(reactivateInvalidPayload.message).toBe(t.coreSettings.invalidResponseDescription);
    expect(reactivateInvalidPayload.shouldReload).toBe(false);

    const reactivateCompanyInvalid = resolveTaxReactivateError(
      apiError(422, COMPANY_INVALID_CODE, "Company inactive", correlationId),
      t,
    );
    expect(reactivateCompanyInvalid.isInvalidResponse).toBe(false);
    expect(reactivateCompanyInvalid.message).toContain(t.coreSettings.taxCompanyInvalid);
    expect(reactivateCompanyInvalid.message).toContain(correlationId);
    expect(reactivateCompanyInvalid.shouldReload).toBe(false);

    const reactivateMissing = resolveTaxReactivateError(
      apiError(404, TAX_NOT_FOUND_CODE, "Missing", correlationId),
      t,
    );
    expect(reactivateMissing.shouldReload).toBe(true);
    expect(reactivateMissing.message).toContain(t.editDrawer.notFoundTitle);

    expect(
      resolveTaxDeactivateToastMessage(
        normalizeApiError(apiError(404, TAX_NOT_FOUND_CODE, "Missing", correlationId)),
        t,
      ),
    ).toContain(t.editDrawer.notFoundTitle);

    const companyDenied = formatTaxCompanyOptionsFailure(
      normalizeApiError(
        apiError(403, "MISSING_REQUIRED_PERMISSIONS", "Raw missing org.read wire text", correlationId),
      ),
      t,
    );
    expect(companyDenied.title).toBe(t.coreSettings.companyOptionsLoadFailed);
    expect(companyDenied.description).toContain(t.coreIdentity.errors.MISSING_REQUIRED_PERMISSIONS);
    expect(companyDenied.description).toContain(correlationId);
    expect(companyDenied.description).not.toContain("Raw missing org.read wire text");
    expect(companyDenied.retryable).toBe(false);

    const companyGenericDenied = formatTaxCompanyOptionsFailure(
      normalizeApiError(apiError(403, "UNMAPPED_403_CODE", "Raw 403 text")),
      t,
    );
    expect(companyGenericDenied.description).toBe(t.errors.accessDeniedMessage);
    expect(companyGenericDenied.retryable).toBe(false);

    const companyTransient = formatTaxCompanyOptionsFailure(
      normalizeApiError(apiError(503, "UPSTREAM_UNAVAILABLE", "Raw 503 trace", correlationId)),
      t,
    );
    expect(companyTransient.title).toBe(t.coreSettings.companyOptionsLoadFailed);
    expect(companyTransient.description).toContain(
      t.coreSettings.companyOptionsLoadFailedDescription,
    );
    expect(companyTransient.description).toContain(correlationId);
    expect(companyTransient.description).not.toContain("Raw 503 trace");
    expect(companyTransient.retryable).toBe(true);

    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("Network failed"))).toBe(false);
  });
});
