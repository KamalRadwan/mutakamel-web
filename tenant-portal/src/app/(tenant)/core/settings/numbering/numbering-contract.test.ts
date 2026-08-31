import { describe, expect, it } from "vitest";
import {
  NUMBERING_PATH,
  buildCreateNumberingRequest,
  buildUpdateNumberingRequest,
  formatNumberingValue,
  isHigherOrEqualCounter,
  numberingPeekPath,
  parseNumberingPeekResponse,
  parseNumberingSequenceResponse,
  parseNumberingSequencesResponse,
  toNumberingForm,
  type NumberingSequence,
} from "./numbering-contract";

const sequenceId = "01902001-3000-7000-8000-000000000001";
const companyId = "01902001-3000-7000-8000-0000000000c1";

const sequence = {
  id: sequenceId,
  code: "SALES_INVOICE",
  prefix: "INV-",
  padding: 6,
  // `bigint` on the server, string on the wire.
  nextValue: "43",
  companyId,
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

describe("Core numbering contract", () => {
  it("uses only canonical Gateway paths and upper-cases the peek code", () => {
    expect(NUMBERING_PATH).toBe("/api/tenant/core/v1/numbering");
    expect(numberingPeekPath("sales_invoice", null)).toBe(
      "/api/tenant/core/v1/numbering/SALES_INVOICE/peek",
    );
    expect(numberingPeekPath("SALES_INVOICE", companyId)).toBe(
      `/api/tenant/core/v1/numbering/SALES_INVOICE/peek?companyId=${companyId}`,
    );
    expect(() => numberingPeekPath("bad code!", null)).toThrow("NUMBERING_FORM_CODE");
  });

  it("keeps nextValue an exact string past Number.MAX_SAFE_INTEGER", () => {
    const huge = "9007199254740993";
    const parsed = parseNumberingSequenceResponse({ ...sequence, nextValue: huge });

    expect(parsed.nextValue).toBe(huge);
    // The defect this rule exists to prevent: Number(huge) === 9007199254740992.
    expect(parsed.nextValue).not.toBe(String(Number(huge)));
    expect(toNumberingForm(parsed).startValue).toBe(huge);
  });

  it("formats exactly as NumberingSequencesService.format does", () => {
    expect(formatNumberingValue("INV-", 6, "43")).toBe("INV-000043");
    expect(formatNumberingValue("", 3, "7")).toBe("007");
    // Longer than the padding: padStart leaves it alone rather than truncating.
    expect(formatNumberingValue("INV-", 2, "12345")).toBe("INV-12345");
    expect(formatNumberingValue("A-", 12, "9007199254740993")).toBe("A-9007199254740993");
  });

  it("compares counters as strings, without converting either side", () => {
    expect(isHigherOrEqualCounter("44", "43")).toBe(true);
    expect(isHigherOrEqualCounter("43", "43")).toBe(true);
    expect(isHigherOrEqualCounter("42", "43")).toBe(false);
    expect(isHigherOrEqualCounter("100", "99")).toBe(true);
    expect(isHigherOrEqualCounter("99", "100")).toBe(false);
    expect(isHigherOrEqualCounter("0043", "43")).toBe(true);
    expect(isHigherOrEqualCounter("9007199254740994", "9007199254740993")).toBe(true);
    expect(isHigherOrEqualCounter("9007199254740992", "9007199254740993")).toBe(false);
  });

  it("refuses to send a lowered nextValue before the request leaves", () => {
    const current: NumberingSequence = parseNumberingSequenceResponse(sequence);

    expect(() =>
      buildUpdateNumberingRequest(current, { ...toNumberingForm(current), startValue: "42" }),
    ).toThrow("NUMBERING_FORM_BACKWARD");

    expect(
      buildUpdateNumberingRequest(current, { ...toNumberingForm(current), startValue: "44" }),
    ).toEqual({ nextValue: 44 });
  });

  it("sends only the fields that changed, and nothing the DTO does not declare", () => {
    const current = parseNumberingSequenceResponse(sequence);

    expect(buildUpdateNumberingRequest(current, toNumberingForm(current))).toEqual({});
    expect(
      buildUpdateNumberingRequest(current, { ...toNumberingForm(current), prefix: "SI-" }),
    ).toEqual({ prefix: "SI-" });
  });

  it("builds a create request with the documented DTO keys only", () => {
    expect(
      buildCreateNumberingRequest({
        code: "sales_invoice",
        prefix: "INV-",
        padding: "6",
        startValue: "1",
        companyId,
      }),
    ).toEqual({ code: "SALES_INVOICE", prefix: "INV-", padding: 6, startValue: 1, companyId });
  });

  it("rejects a counter the DTO's number type cannot carry", () => {
    expect(() =>
      buildCreateNumberingRequest({
        code: "SALES_INVOICE",
        prefix: "",
        padding: "6",
        startValue: "90071992547409931",
        companyId: null,
      }),
    ).toThrow("NUMBERING_FORM_VALUE");
  });

  it("parses the paginated list and the peek projection", () => {
    const page = parseNumberingSequencesResponse({
      items: [sequence],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);

    const peek = parseNumberingPeekResponse({
      code: "SALES_INVOICE",
      companyId,
      nextValue: "43",
      formatted: "INV-000043",
    });
    expect(peek).toEqual({
      code: "SALES_INVOICE",
      companyId,
      nextValue: "43",
      formatted: "INV-000043",
    });
  });

  it("rejects a response whose nextValue is not a bigint string", () => {
    expect(() => parseNumberingSequenceResponse({ ...sequence, nextValue: 43 })).toThrow(
      "Invalid Core numbering response.",
    );
  });
});
