import type { CorePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  buildCoreListQuery,
  nullableUuidV7,
  parseCorePage,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
  type CorePage,
} from "../../contracts/core-page";
import {
  isActiveStatus,
  isDecimalString,
  type ActiveStatus,
} from "../../core-validation";

export const TAXES_PATH = "/api/tenant/core/v1/taxes" as const;
export const INVALID_TAXES_RESPONSE_MESSAGE = "Invalid Core taxes response.";

/** `CreateTaxDto` / `UpdateTaxDto` column bounds. */
export const TAX_CODE_MAX_LENGTH = 32;
export const TAX_NAME_MAX_LENGTH = 120;
const TAX_RATE_MAX = 100;
const TAX_RATE_MAX_WHOLE = String(TAX_RATE_MAX);
const TAX_RATE_SCALE = 4;
export const TAX_PAGE_SIZE = 20;
export const TAX_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** `TaxesService` rejections. */
export const TAX_CODE_TAKEN_CODE = "TAX_CODE_TAKEN";
export const COMPANY_INVALID_CODE = "COMPANY_INVALID";
export const TAX_NOT_FOUND_CODE = "TAX_NOT_FOUND";

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
  status?: ActiveStatus;
}

/** `CreateTaxDto.rate` is a number on the wire. */
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
    status: tax.status,
  };
}

export function taxPath(id: string): CorePath {
  if (!isUUIDv7(id)) invalidResponse();
  return `${TAXES_PATH}/${encodeURIComponent(id)}`;
}

/** The only sort fields GET /taxes accepts; anything else is a 400. */
export const TAX_SORT_FIELDS = ["code", "name", "rate", "createdAt"] as const;
export type TaxSortField = (typeof TAX_SORT_FIELDS)[number];

export function buildTaxesListQuery(options: {
  page: number;
  limit?: number;
  status?: ActiveStatus;
  companyId?: string;
  isInclusive?: boolean;
  search: string;
  sortBy?: TaxSortField;
  sortDir?: "ASC" | "DESC";
}): string {
  if (options.companyId !== undefined && !isUUIDv7(options.companyId)) {
    throw new Error("TAX_FORM_COMPANY");
  }
  return buildCoreListQuery({
    page: options.page,
    limit: options.limit ?? TAX_PAGE_SIZE,
    search: options.search,
    sortBy: options.sortBy ?? "code",
    sortDir: options.sortDir ?? "ASC",
    filters: {
      status: options.status,
      companyId: options.companyId,
      isInclusive:
        options.isInclusive === undefined ? undefined : String(options.isInclusive),
    },
  });
}

export function buildCreateTaxRequest(values: TaxFormValues): CreateTaxRequest {
  const code = values.code.trim().toUpperCase();
  const name = values.name.trim();
  if (code.length === 0 || code.length > TAX_CODE_MAX_LENGTH) throw new Error("TAX_FORM_CODE");
  if (name.length === 0 || name.length > TAX_NAME_MAX_LENGTH) throw new Error("TAX_FORM_NAME");

  const request: CreateTaxRequest = { code, name, rate: parseWireTaxRate(values.rate) };
  if (values.isInclusive) request.isInclusive = true;
  if (values.companyId !== null) {
    if (!isUUIDv7(values.companyId)) throw new Error("TAX_FORM_COMPANY");
    request.companyId = values.companyId;
  }
  return request;
}

export function buildUpdateTaxRequest(current: Tax, values: TaxFormValues): UpdateTaxRequest {
  const request: UpdateTaxRequest = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > TAX_NAME_MAX_LENGTH) throw new Error("TAX_FORM_NAME");
  if (name !== current.name) request.name = name;

  const nextCanonicalRate = normalizeTaxRateFixedScale(values.rate);
  if (nextCanonicalRate === null) throw new Error("TAX_FORM_RATE");
  const currentCanonicalRate = normalizeTaxRateFixedScale(current.rate);
  if (currentCanonicalRate === null) invalidResponse();
  if (nextCanonicalRate !== currentCanonicalRate) {
    request.rate = Number(values.rate.trim());
  }
  if (values.isInclusive !== current.isInclusive) request.isInclusive = values.isInclusive;
  if (values.status !== undefined) {
    if (!isActiveStatus(values.status)) throw new Error("TAX_FORM_STATUS");
    if (values.status !== current.status) request.status = values.status;
  }
  return request;
}

export function parseTaxesResponse(envelope: {
  data: unknown;
  meta: unknown;
}): CorePage<Tax> {
  try {
    return parseCorePage(envelope, parseTaxResponse);
  } catch {
    invalidResponse();
  }
}

export function parseTaxResponse(payload: unknown): Tax {
  const tax = record(payload);
  if (!tax || !isDecimalString(tax.rate) || !isActiveStatus(tax.status)) {
    invalidResponse();
  }

  try {
    return {
      id: requiredUuidV7(tax, "id"),
      code: requiredText(tax, "code", TAX_CODE_MAX_LENGTH),
      name: requiredText(tax, "name", TAX_NAME_MAX_LENGTH),
      rate: tax.rate,
      isInclusive: requiredBoolean(tax, "isInclusive"),
      companyId: nullableUuidV7(tax, "companyId"),
      status: tax.status,
      updatedAt: requiredTimestamp(tax, "updatedAt"),
    };
  } catch {
    invalidResponse();
  }
}

/** `@IsFixedScaleNumber(4)` `@Min(0)` `@Max(100)` — exact string check; never calls `Number()`. */
export function isValidTaxRateInput(value: string): boolean {
  return normalizeTaxRateFixedScale(value) !== null;
}

function normalizeTaxRateFixedScale(value: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/u.exec(value.trim());
  if (!match) return null;

  const whole = match[1].replace(/^0+(?=\d)/u, "");
  const frac = (match[2] ?? "").padEnd(TAX_RATE_SCALE, "0");

  if (whole.length > TAX_RATE_MAX_WHOLE.length) return null;
  if (
    whole.length === TAX_RATE_MAX_WHOLE.length &&
    (whole > TAX_RATE_MAX_WHOLE || (whole === TAX_RATE_MAX_WHOLE && frac !== "0000"))
  ) {
    return null;
  }

  return `${whole}.${frac}`;
}

function parseWireTaxRate(value: string): number {
  if (normalizeTaxRateFixedScale(value) === null) throw new Error("TAX_FORM_RATE");
  return Number(value.trim());
}

function invalidResponse(): never {
  throw new Error(INVALID_TAXES_RESPONSE_MESSAGE);
}
