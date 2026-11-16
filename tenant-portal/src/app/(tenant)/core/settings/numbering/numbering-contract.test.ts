import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import {
  NumberingResponseValidationError,
  createNumberingSequence,
  fetchNumberingPeek,
  fetchNumberingSequences,
  updateNumberingSequence,
} from "./numbering-api";
import {
  classifyNumberingQueryError,
  describeNumberingQueryError,
  isNumberingQueryNotFound,
  resolveNumberingWriteError,
  sanitizeNumberingWriteError,
} from "./numbering-errors";
import {
  NUMBERING_PAGE_SIZE,
  NUMBERING_PATH,
  SEQUENCE_CODE_TAKEN_CODE,
  SEQUENCE_NOT_FOUND_CODE,
  SEQUENCE_VALUE_INVALID_CODE,
  buildCreateNumberingRequest,
  buildUpdateNumberingRequest,
  formatNumberingValue,
  isHigherOrEqualCounter,
  numberingListQuery,
  numberingPath,
  numberingPeekPath,
  parseNumberingPeekResponse,
  parseNumberingSequenceResponse,
  parseNumberingSequencesResponse,
  toNumberingForm,
  type NumberingSequence,
} from "./numbering-contract";

const sequenceId = "01902001-3000-7000-8000-000000000001";
const secondSequenceId = "01902001-3000-7000-8000-000000000002";
const companyId = "01902001-3000-7000-8000-0000000000c1";
const correlationId = "01902001-3000-7000-8000-0000000000f1";

const sequence = {
  id: sequenceId,
  code: "SALES_INVOICE",
  prefix: "INV-",
  padding: 6,
  nextValue: "43",
  companyId,
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const singlePageMeta = {
  page: 1,
  limit: NUMBERING_PAGE_SIZE,
  total: 1,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

function httpResponse(data: unknown, status = 200) {
  return { data, status, statusText: "OK", headers: new Headers() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Core numbering contract", () => {
  it.each([" ", "\t", "\n", "A\nB", "A B", "A\u202eB", "A\u2066B", "A\0B", "A".repeat(17)])(
    "rejects unsafe prefixes in create and update: %j",
    (prefix) => {
      const current = parseNumberingSequenceResponse(sequence);
      const values = { ...toNumberingForm(current), prefix };
      expect(() => buildCreateNumberingRequest(values)).toThrow("NUMBERING_FORM_PREFIX");
      expect(() => buildUpdateNumberingRequest(current, values)).toThrow("NUMBERING_FORM_PREFIX");
    },
  );

  it.each(["INV-", "قيد-", "", "._:/#-", "A".repeat(16), "𐐀".repeat(16)])(
    "accepts safe prefixes in create and update: %j",
    (prefix) => {
      const current = parseNumberingSequenceResponse({ ...sequence, prefix: "OLD-" });
      const values = { ...toNumberingForm(current), prefix };
      expect(buildCreateNumberingRequest(values).prefix).toBe(prefix || undefined);
      expect(buildUpdateNumberingRequest(current, values)).toEqual({ prefix });
      expect(parseNumberingSequenceResponse({ ...sequence, prefix }).prefix).toBe(prefix);
    },
  );

  it("trims nonempty prefixes before sending or comparing them", () => {
    const current = parseNumberingSequenceResponse(sequence);
    const values = { ...toNumberingForm(current), prefix: " INV- " };
    expect(buildCreateNumberingRequest(values).prefix).toBe("INV-");
    expect(buildUpdateNumberingRequest(current, values)).toEqual({});
  });

  it("uses canonical Gateway paths and builds list queries cleanly", () => {
    expect(NUMBERING_PATH).toBe("/api/tenant/core/v1/numbering");
    expect(numberingPath(sequenceId)).toBe(`/api/tenant/core/v1/numbering/${sequenceId}`);
    expect(() => numberingPath("not-a-uuid")).toThrow("Invalid Core numbering response.");
    expect(numberingPeekPath("sales_invoice", null)).toBe("/api/tenant/core/v1/numbering/SALES_INVOICE/peek");
    expect(numberingPeekPath("SALES_INVOICE", companyId)).toBe(
      `/api/tenant/core/v1/numbering/SALES_INVOICE/peek?companyId=${companyId}`,
    );
    expect(() => numberingPeekPath("bad code!", null)).toThrow("NUMBERING_FORM_CODE");

    expect(
      numberingListQuery({
        page: 2,
        companyId,
        code: "  sales_invoice  ",
        search: "  INV  ",
        sortBy: "nextValue",
        sortDir: "DESC",
      }),
    ).toBe(
      `page=2&limit=20&sortBy=nextValue&sortDir=DESC&search=INV&companyId=${companyId}&code=SALES_INVOICE`,
    );
    expect(() => numberingListQuery({ page: 1, companyId: "bad-id", search: "" })).toThrow(
      "NUMBERING_FORM_COMPANY",
    );
    expect(() => numberingListQuery({ page: 1, code: "bad code!", search: "" })).toThrow(
      "NUMBERING_FORM_CODE",
    );
  });

  it("keeps nextValue an exact string past Number.MAX_SAFE_INTEGER", () => {
    const huge = "9007199254740993";
    const parsed = parseNumberingSequenceResponse({ ...sequence, nextValue: huge });
    expect(parsed.nextValue).toBe(huge);
    expect(parsed.nextValue).not.toBe(String(Number(huge)));
    expect(toNumberingForm(parsed).startValue).toBe(huge);
  });

  it("formats and compares counters as strings without numeric conversion", () => {
    expect(formatNumberingValue("INV-", 6, "43")).toBe("INV-000043");
    expect(formatNumberingValue("", 3, "7")).toBe("007");
    expect(formatNumberingValue("INV-", 2, "12345")).toBe("INV-12345");
    expect(formatNumberingValue("A-", 12, "9007199254740993")).toBe("A-9007199254740993");

    expect(isHigherOrEqualCounter("44", "43")).toBe(true);
    expect(isHigherOrEqualCounter("43", "43")).toBe(true);
    expect(isHigherOrEqualCounter("42", "43")).toBe(false);
    expect(isHigherOrEqualCounter("100", "99")).toBe(true);
    expect(isHigherOrEqualCounter("99", "100")).toBe(false);
    expect(isHigherOrEqualCounter("0043", "43")).toBe(true);
    expect(isHigherOrEqualCounter("9007199254740994", "9007199254740993")).toBe(true);
    expect(isHigherOrEqualCounter("9007199254740992", "9007199254740993")).toBe(false);
  });

  it("enforces backward-counter stops, DTO field whitelisting and safe integer bounds", () => {
    const current: NumberingSequence = parseNumberingSequenceResponse(sequence);
    expect(() =>
      buildUpdateNumberingRequest(current, { ...toNumberingForm(current), startValue: "42" }),
    ).toThrow("NUMBERING_FORM_BACKWARD");
    expect(
      buildUpdateNumberingRequest(current, { ...toNumberingForm(current), startValue: "44" }),
    ).toEqual({ nextValue: 44 });
    expect(buildUpdateNumberingRequest(current, toNumberingForm(current))).toEqual({});
    expect(
      buildUpdateNumberingRequest(current, { ...toNumberingForm(current), prefix: "SI-" }),
    ).toEqual({ prefix: "SI-" });

    expect(
      buildCreateNumberingRequest({
        code: "sales_invoice", prefix: "INV-", padding: "6", startValue: "1", companyId,
      }),
    ).toEqual({ code: "SALES_INVOICE", prefix: "INV-", padding: 6, startValue: 1, companyId });

    expect(() =>
      buildCreateNumberingRequest({
        code: "SALES_INVOICE", prefix: "", padding: "6", startValue: "9007199254740992", companyId: null,
      }),
    ).toThrow("NUMBERING_FORM_VALUE");
    expect(() =>
      buildCreateNumberingRequest({
        code: "SALES_INVOICE", prefix: "", padding: "13", startValue: "1", companyId: null,
      }),
    ).toThrow("NUMBERING_FORM_PADDING");
  });

  it("parses canonical { data, meta } envelopes and rejects legacy or malformed shapes", () => {
    expect(parseNumberingSequencesResponse({ data: [sequence], meta: singlePageMeta })).toEqual({
      items: [parseNumberingSequenceResponse(sequence)],
      ...singlePageMeta,
    });

    const empty = parseNumberingSequencesResponse({
      data: [],
      meta: { page: 1, limit: NUMBERING_PAGE_SIZE, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });
    expect(empty.items).toEqual([]);
    expect(empty.total).toBe(0);

    expect(() =>
      parseNumberingSequencesResponse({
        data: { items: [sequence], total: 1, page: 1, limit: 20 },
        meta: undefined,
      }),
    ).toThrow();
    expect(() =>
      parseNumberingSequencesResponse({
        data: [sequence, { ...sequence, code: "DUPLICATE_ID" }],
        meta: { ...singlePageMeta, total: 2 },
      }),
    ).toThrow();
    expect(() =>
      parseNumberingSequencesResponse({ data: [sequence], meta: { ...singlePageMeta, hasNext: true } }),
    ).toThrow();
    expect(() => parseNumberingSequenceResponse({ ...sequence, nextValue: 43 })).toThrow(
      "Invalid Core numbering response.",
    );

    expect(
      parseNumberingPeekResponse({
        code: "SALES_INVOICE", companyId, nextValue: "9007199254740993", formatted: "INV-9007199254740993",
      }),
    ).toEqual({
      code: "SALES_INVOICE", companyId, nextValue: "9007199254740993", formatted: "INV-9007199254740993",
    });
  });

  it("unwraps real Core HTTP envelopes across list, peek, create and update transport calls", async () => {
    const getSpy = vi.spyOn(axiosClient, "get");
    const postSpy = vi.spyOn(axiosClient, "post");
    const patchSpy = vi.spyOn(axiosClient, "patch");

    getSpy.mockResolvedValueOnce(
      httpResponse({
        success: true,
        status: "SUCCESS",
        statusCode: 200,
        data: [sequence, { ...sequence, id: secondSequenceId, code: "QUOTE", companyId: null }],
        meta: { page: 1, limit: NUMBERING_PAGE_SIZE, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
        correlationId,
      }),
    );
    const list = await fetchNumberingSequences({ page: 1, search: "" });
    expect(getSpy).toHaveBeenCalledWith(
      "/api/tenant/core/v1/numbering?page=1&limit=20&sortBy=code&sortDir=ASC",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(list.items.map((item) => item.code)).toEqual(["SALES_INVOICE", "QUOTE"]);
    expect(list.total).toBe(2);

    getSpy.mockResolvedValueOnce(httpResponse({ success: true, data: [sequence], correlationId }));
    await expect(fetchNumberingSequences({ page: 1, search: "" })).rejects.toBeInstanceOf(
      NumberingResponseValidationError,
    );

    const invalidClassified = classifyNumberingQueryError(new NumberingResponseValidationError());
    expect(invalidClassified).toEqual({ kind: "invalidResponse" });
    expect(describeNumberingQueryError(invalidClassified, en)).toEqual({
      title: en.coreSettings.numberingLoadFailed,
      description: en.coreSettings.invalidResponseDescription,
      retryable: true,
    });

    const offlineClassified = classifyNumberingQueryError(new TypeError("Failed to fetch"));
    expect(offlineClassified.kind).toBe("api");
    expect(describeNumberingQueryError(offlineClassified, en)).toEqual({
      title: en.coreSettings.numberingLoadFailed,
      description: en.coreIdentity.errors.OFFLINE,
      retryable: true,
    });

    const timeoutClassified = classifyNumberingQueryError(
      new TenantApiClientError("RAW_TIMEOUT_TEXT", {
        status: 504,
        statusText: "Gateway Timeout",
        headers: new Headers(),
        data: { success: false, statusCode: 504, errorCode: "REQUEST_TIMED_OUT", correlationId },
      }),
    );
    expect(describeNumberingQueryError(timeoutClassified, en).description).toBe(
      `${en.errors.requestTimedOut} — ${en.errors.reference}: ${correlationId}`,
    );
    if (timeoutClassified.kind === "api") {
      expect(sanitizeNumberingWriteError(timeoutClassified.error, en).message).toBe(
        en.errors.writeTimedOut,
      );
    }

    getSpy.mockResolvedValueOnce(
      httpResponse({
        success: true,
        data: { code: "SALES_INVOICE", companyId, nextValue: "43", formatted: "INV-000043" },
        correlationId,
      }),
    );
    const peek = await fetchNumberingPeek(numberingPeekPath("SALES_INVOICE", companyId));
    expect(peek.formatted).toBe("INV-000043");

    postSpy.mockResolvedValueOnce(
      httpResponse({ success: true, statusCode: 201, data: sequence, correlationId }, 201),
    );
    const created = await createNumberingSequence({
      code: "SALES_INVOICE", prefix: "INV-", padding: 6, startValue: 43, companyId,
    });
    expect(postSpy).toHaveBeenCalledWith(
      "/api/tenant/core/v1/numbering",
      { code: "SALES_INVOICE", prefix: "INV-", padding: 6, startValue: 43, companyId },
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(created.id).toBe(sequenceId);

    patchSpy.mockResolvedValueOnce(
      httpResponse({ success: true, statusCode: 200, data: { ...sequence, nextValue: "50" }, correlationId }),
    );
    const updated = await updateNumberingSequence(sequenceId, { nextValue: 50 });
    expect(patchSpy).toHaveBeenCalledWith(
      `/api/tenant/core/v1/numbering/${sequenceId}`,
      { nextValue: 50 },
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(updated.nextValue).toBe("50");
  });

  it("handles 404 without blind retry and separates create code conflict from locked edit conflict", () => {
    const notFoundClassified = classifyNumberingQueryError(
      new TenantApiClientError("Not found", {
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        data: { success: false, statusCode: 404, errorCode: SEQUENCE_NOT_FOUND_CODE, correlationId },
      }),
    );
    expect(isNumberingQueryNotFound(notFoundClassified)).toBe(true);
    expect(describeNumberingQueryError(notFoundClassified, en)).toEqual({
      title: en.editDrawer.notFoundTitle,
      description: `${en.coreIdentity.errors.NOT_FOUND} — ${en.errors.reference}: ${correlationId}`,
      retryable: false,
    });

    const duplicateError = new TenantApiClientError("Conflict", {
      status: 409,
      statusText: "Conflict",
      headers: new Headers(),
      data: { success: false, statusCode: 409, errorCode: SEQUENCE_CODE_TAKEN_CODE, correlationId },
    });
    const unknownCompanyId = "01902001-3000-7000-8000-0000000000c9";
    const createConflict = resolveNumberingWriteError({
      mode: "create",
      error: duplicateError,
      scopeCompanyId: unknownCompanyId,
      companies: [{ id: companyId, code: "ALPHA", name: "Alpha Trading" }],
      t: en,
    });
    expect(createConflict.bannerError).toBeNull();
    expect(createConflict.fieldErrors.code).toContain(en.coreSettings.unknownCompany);
    expect(createConflict.fieldErrors.code).not.toContain(unknownCompanyId);

    const editConflict = resolveNumberingWriteError({
      mode: "edit",
      error: duplicateError,
      scopeCompanyId: companyId,
      current: parseNumberingSequenceResponse(sequence),
      companies: [{ id: companyId, code: "ALPHA", name: "Alpha Trading" }],
      t: en,
    });
    expect(editConflict.fieldErrors).toEqual({});
    expect(editConflict.bannerError).toBe(
      `${en.coreIdentity.errors.CONFLICT} — ${en.errors.reference}: ${correlationId}`,
    );

    const invalidWritePayload = resolveNumberingWriteError({
      mode: "create",
      error: new NumberingResponseValidationError(),
      scopeCompanyId: companyId,
      companies: [{ id: companyId, code: "ALPHA", name: "Alpha Trading" }],
      t: en,
    });
    expect(invalidWritePayload).toEqual({
      bannerError: en.coreSettings.invalidResponseDescription,
      fieldErrors: {},
      notFound: false,
    });

    // Race case: client loaded nextValue "124", server advanced to "130", user sent "126".
    const staleCounterRace = resolveNumberingWriteError({
      mode: "edit",
      error: new TenantApiClientError("Unprocessable", {
        status: 422,
        statusText: "Unprocessable Entity",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 422,
          errorCode: SEQUENCE_VALUE_INVALID_CODE,
          message: "Sequence value cannot be lowered.",
          correlationId,
        },
      }),
      scopeCompanyId: companyId,
      current: parseNumberingSequenceResponse({ ...sequence, nextValue: "124" }),
      companies: [{ id: companyId, code: "ALPHA", name: "Alpha Trading" }],
      t: en,
    });
    expect(staleCounterRace.fieldErrors.startValue).toBe(
      `${en.coreIdentity.errors.CONFLICT} — ${en.errors.reference}: ${correlationId}`,
    );
    expect(staleCounterRace.fieldErrors.startValue).not.toContain("124");
  });
});
