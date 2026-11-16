import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import {
  EMPTY_TAX_FORM,
  TAX_CODE_MAX_LENGTH,
  TAX_NAME_MAX_LENGTH,
  type TaxFormValues,
} from "./tax-contract";
import {
  buildTaxErrorSummaryItems,
  resolveServerTaxFieldError,
  taxFieldAnchorId,
  validateTaxForm,
  validateTaxFormField,
} from "./tax-validation";

const activeCompanyId = "01902001-3000-7000-8000-0000000000c1";
const unmanageableCompanyId = "01902001-3000-7000-8000-0000000000c9";
const companies = [{ id: activeCompanyId, code: "ACME", name: "Acme Retail" }];

const validCreateValues: TaxFormValues = {
  ...EMPTY_TAX_FORM,
  code: " vat14 ",
  name: " Standard VAT ",
  rate: "14.25",
  isInclusive: true,
  companyId: activeCompanyId,
};

describe("tax-validation", () => {
  it.each([
    ["en", en],
    ["ar", ar],
  ] as const)("validates create and edit fields in %s", (_lang, t) => {
    const createContext = {
      mode: "create" as const,
      companies,
      tenantWideAllowed: true,
      t,
    };

    expect(validateTaxForm(validCreateValues, createContext)).toEqual({});
    expect(
      validateTaxForm({ ...validCreateValues, companyId: null }, createContext),
    ).toEqual({});

    expect(
      validateTaxFormField(
        "companyId",
        { ...validCreateValues, companyId: null },
        { ...createContext, tenantWideAllowed: false },
      ),
    ).toBe(t.coreSettings.taxFormCompany);

    expect(
      validateTaxFormField(
        "companyId",
        { ...validCreateValues, companyId: "550e8400-e29b-41d4-a716-446655440000" },
        createContext,
      ),
    ).toBe(t.coreSettings.taxFormCompany);

    expect(
      validateTaxFormField(
        "companyId",
        { ...validCreateValues, companyId: unmanageableCompanyId },
        createContext,
      ),
    ).toBe(t.coreSettings.taxCompanyInvalid);

    expect(
      validateTaxFormField("code", { ...validCreateValues, code: "   " }, createContext),
    ).toBe(t.coreSettings.taxFormCode);
    expect(
      validateTaxFormField(
        "code",
        { ...validCreateValues, code: "A".repeat(TAX_CODE_MAX_LENGTH + 1) },
        createContext,
      ),
    ).toBe(t.coreSettings.taxFormCode);
    expect(
      validateTaxFormField(
        "code",
        { ...validCreateValues, code: `  ${"a".repeat(TAX_CODE_MAX_LENGTH)}  ` },
        createContext,
      ),
    ).toBeUndefined();

    expect(
      validateTaxFormField("name", { ...validCreateValues, name: "   " }, createContext),
    ).toBe(t.coreSettings.taxFormName);
    expect(
      validateTaxFormField(
        "name",
        { ...validCreateValues, name: "N".repeat(TAX_NAME_MAX_LENGTH + 1) },
        createContext,
      ),
    ).toBe(t.coreSettings.taxFormName);
    expect(
      validateTaxFormField(
        "name",
        { ...validCreateValues, name: `  ${"N".repeat(TAX_NAME_MAX_LENGTH)}  ` },
        createContext,
      ),
    ).toBeUndefined();

    for (const validRate of ["0", "0.0000", "14", "14.1234", "100", "100.0000"]) {
      expect(
        validateTaxFormField("rate", { ...validCreateValues, rate: validRate }, createContext),
      ).toBeUndefined();
    }
    for (const invalidRate of ["", " ", "-1", "100.0001", "101", "14.12345", "14.", ".5", "abc"]) {
      expect(
        validateTaxFormField("rate", { ...validCreateValues, rate: invalidRate }, createContext),
      ).toBe(t.coreSettings.taxFormRate);
    }

    const editContext = {
      mode: "edit" as const,
      companies: [],
      tenantWideAllowed: false,
      t,
    };
    expect(
      validateTaxForm(
        {
          code: "",
          companyId: "not-validated-on-edit",
          name: "Value added tax",
          rate: "14.0000",
          isInclusive: false,
          status: "INACTIVE",
        },
        editContext,
      ),
    ).toEqual({});
  });

  it.each([en, ar])("maps server field rejections and builds ordered summary anchors", (t) => {
    const duplicateMsg = `${formatTemplate(t.coreSettings.taxCodeTaken, { company: "Acme Retail" })} — ${t.errors.reference}: 01902001-3000-7000-8000-000000000099`;
    expect(resolveServerTaxFieldError(duplicateMsg, "create", t)).toEqual({
      field: "code",
      message: duplicateMsg,
    });

    expect(resolveServerTaxFieldError(t.coreSettings.taxCompanyInvalid, "create", t)).toEqual({
      field: "companyId",
      message: t.coreSettings.taxCompanyInvalid,
    });
    expect(resolveServerTaxFieldError(t.coreSettings.taxCompanyInvalid, "edit", t)).toEqual({
      field: "status",
      message: t.coreSettings.taxCompanyInvalid,
    });
    expect(resolveServerTaxFieldError(t.coreSettings.taxUpdateFailed, "edit", t)).toEqual({
      unmappedError: t.coreSettings.taxUpdateFailed,
    });

    const summary = buildTaxErrorSummaryItems(
      {
        rate: t.coreSettings.taxFormRate,
        code: duplicateMsg,
        companyId: t.coreSettings.taxFormCompany,
      },
      "tax-create",
      t,
    );
    expect(summary).toEqual([
      {
        field: "companyId",
        anchorId: taxFieldAnchorId("tax-create", "companyId"),
        label: t.coreSettings.taxCompany,
        message: t.coreSettings.taxFormCompany,
      },
      {
        field: "code",
        anchorId: taxFieldAnchorId("tax-create", "code"),
        label: t.coreSettings.taxCode,
        message: duplicateMsg,
      },
      {
        field: "rate",
        anchorId: taxFieldAnchorId("tax-create", "rate"),
        label: t.coreSettings.taxRate,
        message: t.coreSettings.taxFormRate,
      },
    ]);
  });
});
