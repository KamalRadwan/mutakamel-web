import type { CorePath } from "@/lib/api/envelope";
import {
  isActiveStatus,
  isDecimalString,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseCorePage,
  record,
  type ActiveStatus,
  type CorePage,
} from "../../core-validation";

export const TAXES_PATH = "/api/tenant/core/v1/taxes";

/** `CreateTaxDto` / `UpdateTaxDto` column bounds. */
export const TAX_CODE_MAX_LENGTH = 32;
export const TAX_NAME_MAX_LENGTH = 120;
const TAX_RATE_MAX = 100;
export const TAX_PAGE_SIZE = 20;

/** `TaxesService` rejections. */
export const TAX_CODE_TAKEN_CODE = "TAX_CODE_TAKEN";
export const COMPANY_INVALID_CODE = "COMPANY_INVALID";

export interface Tax {
  id: string;
  code: string;
  name: string;
  /** `numeric(7,4)` — an exact decimal string; formatted, never parsed. */
  rate: string;
  isInclusive: boolean;
  /** `null` means tenant-wide: the code is unique once across the whole tenant. */
  companyId: string | null;
  status: ActiveStatus;
  updatedAt: string;
}

export interface TaxFormValues {
  code: string;
  name: string;
  rate: string;
  isInclusive: boolean;
  companyId: string | null;
}

/** `CreateTaxDto`. `rate` is `@IsNumber` on the wire, not a string. */
export interface CreateTaxRequest {
  code: string;
  name: string;
  rate: number;
  isInclusive?: boolean;
  companyId?: string;
}

/** `UpdateTaxDto` — no `code` and no `companyId`; the scope key is immutable. */
export interface UpdateTaxRequest {
  name?: string;
  rate?: number;
  isInclusive?: boolean;
  status?: ActiveStatus;
}

export const EMPTY_TAX_FORM: TaxFormValues = {
  code: "",
  name: "",
  rate: "",
  isInclusive: false,
  companyId: null,
};

export function toTaxForm(tax: Tax): TaxFormValues {
  return {
    code: tax.code,
    name: tax.name,
    rate: tax.rate,
    isInclusive: tax.isInclusive,
    companyId: tax.companyId,
  };
}

export function taxPath(id: string): CorePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${TAXES_PATH}/${encodeURIComponent(id)}` as CorePath;
}

export function taxesListPath(
  page: number,
  status: ActiveStatus | undefined,
  companyId: string | undefined,
  search: string,
): CorePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(TAX_PAGE_SIZE),
    sortBy: "code",
    sortDir: "ASC",
  });
  if (status) query.set("status", status);
  if (companyId) query.set("companyId", companyId);
  if (search) query.set("search", search);
  return `${TAXES_PATH}?${query.toString()}` as CorePath;
}

export function buildCreateTaxRequest(values: TaxFormValues): CreateTaxRequest {
  const code = values.code.trim().toUpperCase();
  const name = values.name.trim();
  if (code.length === 0 || code.length > TAX_CODE_MAX_LENGTH) throw new Error("TAX_FORM_CODE");
  if (name.length === 0 || name.length > TAX_NAME_MAX_LENGTH) throw new Error("TAX_FORM_NAME");

  const request: CreateTaxRequest = { code, name, rate: parseRate(values.rate) };
  if (values.isInclusive) request.isInclusive = true;
  if (values.companyId !== null) {
    if (!isUuidV7(values.companyId)) throw new Error("TAX_FORM_COMPANY");
    request.companyId = values.companyId;
  }
  return request;
}

export function buildUpdateTaxRequest(current: Tax, values: TaxFormValues): UpdateTaxRequest {
  const request: UpdateTaxRequest = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > TAX_NAME_MAX_LENGTH) throw new Error("TAX_FORM_NAME");
  if (name !== current.name) request.name = name;

  const rate = values.rate.trim();
  if (rate !== current.rate) request.rate = parseRate(values.rate);
  if (values.isInclusive !== current.isInclusive) request.isInclusive = values.isInclusive;
  return request;
}

export function parseTaxesResponse(payload: unknown): CorePage<Tax> {
  return parseCorePage(payload, parseTaxResponse, invalidResponse);
}

export function parseTaxResponse(payload: unknown): Tax {
  const tax = record(payload);
  if (
    !tax ||
    !isUuidV7(tax.id) ||
    !isNonEmptyString(tax.code, TAX_CODE_MAX_LENGTH) ||
    !isNonEmptyString(tax.name, TAX_NAME_MAX_LENGTH) ||
    !isDecimalString(tax.rate) ||
    typeof tax.isInclusive !== "boolean" ||
    !isActiveStatus(tax.status) ||
    !isTimestamp(tax.updatedAt) ||
    !isNullableCompanyId(tax.companyId)
  ) {
    invalidResponse();
  }

  return {
    id: tax.id,
    code: tax.code,
    name: tax.name,
    rate: tax.rate,
    isInclusive: tax.isInclusive,
    companyId: (tax.companyId as string | null | undefined) ?? null,
    status: tax.status,
    updatedAt: tax.updatedAt,
  };
}

/** `@IsNumber({ maxDecimalPlaces: 4 })`, 0–100 — typed input, never a wire decimal. */
function parseRate(value: string): number {
  const trimmed = value.trim();
  if (!/^\d{1,3}(\.\d{1,4})?$/u.test(trimmed)) throw new Error("TAX_FORM_RATE");
  const rate = Number(trimmed);
  if (rate < 0 || rate > TAX_RATE_MAX) throw new Error("TAX_FORM_RATE");
  return rate;
}

function isNullableCompanyId(value: unknown): boolean {
  return value === null || value === undefined || isUuidV7(value);
}

function invalidResponse(): never {
  throw new Error("Invalid Core taxes response.");
}
