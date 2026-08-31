import { describe, expect, it } from "vitest";
import {
  TAXES_PATH,
  buildCreateTaxRequest,
  buildUpdateTaxRequest,
  parseTaxResponse,
  parseTaxesResponse,
  taxPath,
  taxesListPath,
  toTaxForm,
} from "./tax-contract";
import { companyLabel } from "../company-options";

const taxId = "01902001-3000-7000-8000-000000000002";
const companyId = "01902001-3000-7000-8000-0000000000c1";
const tax = {
  id: taxId,
  code: "VAT14",
  name: "VAT 14%",
  rate: "14.0000",
  isInclusive: false,
  companyId,
  status: "ACTIVE",
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

describe("Core taxes contract", () => {
  it("uses only canonical Gateway paths", () => {
    expect(TAXES_PATH).toBe("/api/tenant/core/v1/taxes");
    expect(taxPath(taxId)).toBe(`${TAXES_PATH}/${taxId}`);
    expect(taxesListPath(1, "ACTIVE", companyId, "vat")).toBe(
      `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&companyId=${companyId}&search=vat`,
    );
  });

  it("keeps the rate an exact decimal string on the way in", () => {
    const parsed = parseTaxResponse(tax);
    expect(parsed.rate).toBe("14.0000");
    expect(toTaxForm(parsed).rate).toBe("14.0000");
  });

  it("treats an absent companyId as tenant-wide", () => {
    expect(parseTaxResponse({ ...tax, companyId: null }).companyId).toBeNull();
    const withoutCompany: Record<string, unknown> = { ...tax };
    delete withoutCompany.companyId;
    expect(parseTaxResponse(withoutCompany).companyId).toBeNull();
  });

  it("converts the typed rate to the number the DTO declares", () => {
    expect(
      buildCreateTaxRequest({
        code: "vat14",
        name: " VAT 14% ",
        rate: "14",
        isInclusive: true,
        companyId,
      }),
    ).toEqual({ code: "VAT14", name: "VAT 14%", rate: 14, isInclusive: true, companyId });
  });

  it("rejects a rate outside the 0–100, four-decimal bound", () => {
    const base = { code: "VAT", name: "VAT", isInclusive: false, companyId: null };
    expect(() => buildCreateTaxRequest({ ...base, rate: "101" })).toThrow("TAX_FORM_RATE");
    expect(() => buildCreateTaxRequest({ ...base, rate: "14.00001" })).toThrow("TAX_FORM_RATE");
    expect(() => buildCreateTaxRequest({ ...base, rate: "" })).toThrow("TAX_FORM_RATE");
  });

  it("never sends code or companyId on update — the scope key is immutable", () => {
    const current = parseTaxResponse(tax);
    const request = buildUpdateTaxRequest(current, { ...toTaxForm(current), name: "VAT" });

    expect(request).toEqual({ name: "VAT" });
    expect("code" in request).toBe(false);
    expect("companyId" in request).toBe(false);
  });

  it("names the scope a duplicate code collided in", () => {
    const companies = [{ id: companyId, code: "ACME", name: "Acme Retail" }];

    expect(companyLabel(companies, companyId, "Tenant-wide")).toBe("Acme Retail");
    expect(companyLabel(companies, null, "Tenant-wide")).toBe("Tenant-wide");
    // An id with no loaded company still names something, never an empty string.
    expect(companyLabel([], companyId, "Tenant-wide")).toBe(companyId);
  });

  it("rejects a page whose row carries a non-decimal rate", () => {
    expect(() =>
      parseTaxesResponse({
        items: [{ ...tax, rate: 14 }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    ).toThrow("Invalid Core taxes response.");
  });
});
