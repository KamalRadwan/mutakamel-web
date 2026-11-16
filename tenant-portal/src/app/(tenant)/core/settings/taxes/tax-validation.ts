import type { Dictionary } from "@/i18n/dictionaries/ar";
import { isUUIDv7 } from "@/lib/uuid";
import { isActiveStatus } from "../../core-validation";
import type { CompanyOption } from "../company-options";
import {
  TAX_CODE_MAX_LENGTH,
  TAX_NAME_MAX_LENGTH,
  isValidTaxRateInput,
  type TaxFormValues,
} from "./tax-contract";

export type TaxFormMode = "create" | "edit";
export type TaxFormFieldKey = "companyId" | "code" | "name" | "rate" | "status";
export type TaxFormFieldErrors = Partial<Record<TaxFormFieldKey, string>>;

export interface TaxFormValidationContext {
  mode: TaxFormMode;
  companies: readonly CompanyOption[];
  tenantWideAllowed: boolean;
  t: Dictionary;
}

export interface TaxErrorSummaryItem {
  field: TaxFormFieldKey;
  anchorId: string;
  label: string;
  message: string;
}

const CREATE_FIELD_ORDER: readonly TaxFormFieldKey[] = ["companyId", "code", "name", "rate"];
const EDIT_FIELD_ORDER: readonly TaxFormFieldKey[] = ["name", "rate", "status"];
const SUMMARY_FIELD_ORDER: readonly TaxFormFieldKey[] = [
  "companyId",
  "code",
  "name",
  "rate",
  "status",
];

export function taxFieldAnchorId(idPrefix: string, field: TaxFormFieldKey): string {
  return `${idPrefix}-field-${field}`;
}

export function validateTaxFormField(
  field: TaxFormFieldKey,
  values: TaxFormValues,
  context: TaxFormValidationContext,
): string | undefined {
  const { mode, companies, tenantWideAllowed, t } = context;

  switch (field) {
    case "companyId": {
      if (mode === "edit") return undefined;
      if (values.companyId === null) {
        return tenantWideAllowed ? undefined : t.coreSettings.taxFormCompany;
      }
      if (!isUUIDv7(values.companyId)) {
        return t.coreSettings.taxFormCompany;
      }
      if (!companies.some((company) => company.id === values.companyId)) {
        return t.coreSettings.taxCompanyInvalid;
      }
      return undefined;
    }
    case "code": {
      if (mode === "edit") return undefined;
      const code = values.code.trim().toUpperCase();
      if (code.length === 0 || code.length > TAX_CODE_MAX_LENGTH) {
        return t.coreSettings.taxFormCode;
      }
      return undefined;
    }
    case "name": {
      const name = values.name.trim();
      if (name.length === 0 || name.length > TAX_NAME_MAX_LENGTH) {
        return t.coreSettings.taxFormName;
      }
      return undefined;
    }
    case "rate": {
      return isValidTaxRateInput(values.rate) ? undefined : t.coreSettings.taxFormRate;
    }
    case "status": {
      if (mode === "create") return undefined;
      return isActiveStatus(values.status ?? "ACTIVE") ? undefined : t.crmShared.fieldRequired;
    }
  }
}

export function validateTaxForm(
  values: TaxFormValues,
  context: TaxFormValidationContext,
): TaxFormFieldErrors {
  const fields = context.mode === "create" ? CREATE_FIELD_ORDER : EDIT_FIELD_ORDER;
  const errors: TaxFormFieldErrors = {};

  for (const field of fields) {
    const message = validateTaxFormField(field, values, context);
    if (message) {
      errors[field] = message;
    }
  }

  return errors;
}

/**
 * Routes server/client form rejections to the matching field when unambiguous
 * (e.g. `409 TAX_CODE_TAKEN` -> `code`, `422 COMPANY_INVALID` -> `companyId` or
 * `status` when reactivating a tax under an inactive company), leaving generic
 * transport/permission failures for `FormModal`'s non-field error banner.
 */
export function resolveServerTaxFieldError(
  error: string | null,
  mode: TaxFormMode,
  t: Dictionary,
): { field?: TaxFormFieldKey; message?: string; unmappedError?: string } {
  if (!error) return {};

  const [takenPrefix = ""] = t.coreSettings.taxCodeTaken.split("{company}");
  if (mode === "create" && takenPrefix.length > 0 && error.startsWith(takenPrefix)) {
    return { field: "code", message: error };
  }
  if (error.startsWith(t.coreSettings.taxCompanyInvalid)) {
    return { field: mode === "create" ? "companyId" : "status", message: error };
  }
  if (mode === "create" && error === t.coreSettings.taxFormCode) {
    return { field: "code", message: error };
  }
  if (error === t.coreSettings.taxFormName) {
    return { field: "name", message: error };
  }
  if (error === t.coreSettings.taxFormRate) {
    return { field: "rate", message: error };
  }
  if (mode === "create" && error === t.coreSettings.taxFormCompany) {
    return { field: "companyId", message: error };
  }

  return { unmappedError: error };
}

export function buildTaxErrorSummaryItems(
  errors: TaxFormFieldErrors,
  idPrefix: string,
  t: Dictionary,
): TaxErrorSummaryItem[] {
  const labels: Record<TaxFormFieldKey, string> = {
    companyId: t.coreSettings.taxCompany,
    code: t.coreSettings.taxCode,
    name: t.coreSettings.taxName,
    rate: t.coreSettings.taxRate,
    status: t.common.status,
  };

  const items: TaxErrorSummaryItem[] = [];
  for (const field of SUMMARY_FIELD_ORDER) {
    const message = errors[field];
    if (!message) continue;
    items.push({
      field,
      anchorId: taxFieldAnchorId(idPrefix, field),
      label: labels[field],
      message,
    });
  }

  return items;
}
