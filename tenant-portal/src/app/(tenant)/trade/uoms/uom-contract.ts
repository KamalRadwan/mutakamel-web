import type { TradePath } from "@/lib/api/envelope";
import {
  hasValidLocaleKeys,
  isLocalizedNames,
  isNonEmptyString,
  isRowVersion,
  isTimestamp,
  isUuidV7,
  parseTradePage,
  record,
  type TradePage,
} from "../trade-validation";

// docs/api/trade-foundation.md#uom-master--4-routes, verified against
// trade-app/src/modules/catalog/catalog.controller.ts (CatalogUomsController),
// catalog-uom.service.ts and dto/catalog.dto.ts.
//
// **Read and write on this resource take opposite headers.** The Gateway
// declares `organizationScopeMode: BRANCH_REQUIRED` on both GETs and `NONE` on
// both writes, so a list needs the company AND branch headers while a create or
// update must send neither — a company header on `POST /uoms` is a 400
// `GW.REQUEST.INVALID` before trade-app ever sees it. The controller targets
// agree (`OPERATING_CONTEXT` for reads, `TENANT` for writes) but the two
// policies are enforced by different components with different error shapes.

export const UOMS_PATH = "/api/tenant/trade/v1/uoms";

/** `CreateUomDto` / `UpdateUomDto` column bounds. */
export const UOM_CODE_MAX_LENGTH = 32;
export const UOM_DISPLAY_NAME_MAX_LENGTH = 160;
export const UOM_PAGE_SIZE = 50;

/** `CreateUomDto.code` — `^[A-Za-z][A-Za-z0-9._-]*$`, uppercased by the service. */
const UOM_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/u;
/** `UomListQueryDto.search` — a **prefix** match on the code, not a name search. */
const UOM_SEARCH_PATTERN = /^[A-Za-z0-9._-]+$/u;

/** `UomStatus`. A UOM is retired by PATCHing `status`; there is no retire route. */
export const UOM_STATUSES = ["ACTIVE", "RETIRED"] as const;
export type UomStatus = (typeof UOM_STATUSES)[number];

export const UOM_CODE_TAKEN_CODE = "TRADE.CATALOG.UOM_CODE_TAKEN";
export const UOM_INVALID_CODE = "TRADE.CATALOG.UOM_INVALID";
export const UOM_RETIRE_REFERENCED_CODE = "TRADE.CATALOG.UOM_RETIRE_REFERENCED";

export interface Uom {
  id: string;
  code: string;
  displayName: string;
  localizedNames: Record<string, string>;
  status: UomStatus;
  version: number;
  updatedAt: string;
}

export interface UomFormValues {
  code: string;
  displayName: string;
  nameAr: string;
  nameEn: string;
  status: UomStatus;
  extraLocales?: Record<string, string>;
}

export const EMPTY_UOM_FORM: UomFormValues = {
  code: "",
  displayName: "",
  nameAr: "",
  nameEn: "",
  status: "ACTIVE",
};

export function extractExtraLocales(
  localizedNames: Record<string, string>,
): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const [locale, value] of Object.entries(localizedNames)) {
    if (locale !== "ar" && locale !== "en" && value.trim()) {
      extras[locale] = value;
    }
  }
  return extras;
}

export function toUomForm(uom: Uom): UomFormValues {
  return {
    code: uom.code,
    displayName: uom.displayName,
    nameAr: uom.localizedNames.ar ?? "",
    nameEn: uom.localizedNames.en ?? "",
    status: uom.status,
  };
}

export function uomPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${UOMS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function uomsListPath(page: number, status?: UomStatus, search?: string): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(UOM_PAGE_SIZE) });
  if (status) query.set("status", status);
  // Sent only when it can match: the DTO pattern rejects anything else with a
  // 400, and the service uppercases it into an ILIKE prefix on the code.
  if (search && UOM_SEARCH_PATTERN.test(search)) query.set("search", search);
  return `${UOMS_PATH}?${query.toString()}` as TradePath;
}

/** `CreateUomDto` — every field is required. */
export interface CreateUomRequest {
  code: string;
  displayName: string;
  localizedNames: Record<string, string>;
}

/**
 * `UpdateUomDto`.
 *
 * Every field uses `@ValidateIf(value !== undefined)`, so **`null` is a 400**
 * rather than a clear — an omitted key is the only way to leave a field alone.
 */
export interface UpdateUomRequest {
  displayName?: string;
  localizedNames?: Record<string, string>;
  status?: UomStatus;
}

export interface UomFormIssues {
  code?: boolean;
  displayName?: boolean;
  localizedNames?: boolean;
}

function mergeLocaleCandidate(
  values: UomFormValues,
  current?: Record<string, string>,
): Record<string, string> {
  const names: Record<string, string> = {};
  if (values.extraLocales !== undefined) {
    for (const [locale, text] of Object.entries(values.extraLocales)) {
      const trimmedLocale = locale.trim();
      const trimmedText = text.trim();
      if (trimmedLocale && trimmedLocale !== "ar" && trimmedLocale !== "en" && trimmedText) {
        names[trimmedLocale] = trimmedText;
      }
    }
  } else if (current) {
    for (const [locale, text] of Object.entries(current)) {
      if (locale !== "ar" && locale !== "en") {
        names[locale] = text;
      }
    }
  }
  const arabic = values.nameAr.trim();
  const english = values.nameEn.trim();
  if (arabic) names.ar = arabic;
  if (english) names.en = english;
  return names;
}

export function validateUomForm(
  values: UomFormValues,
  options?: { codeReadOnly?: boolean; currentNames?: Record<string, string> },
): UomFormIssues {
  const issues: UomFormIssues = {};
  if (!options?.codeReadOnly) {
    const code = values.code.trim().toUpperCase();
    if (!UOM_CODE_PATTERN.test(code) || code.length > UOM_CODE_MAX_LENGTH) {
      issues.code = true;
    }
  }
  const displayName = values.displayName.trim();
  if (displayName.length === 0 || displayName.length > UOM_DISPLAY_NAME_MAX_LENGTH) {
    issues.displayName = true;
  }
  const names = mergeLocaleCandidate(values, options?.currentNames);
  if (!hasValidLocaleKeys(names)) {
    issues.localizedNames = true;
  }
  return issues;
}

function buildLocalizedNames(
  values: UomFormValues,
  current?: Record<string, string>,
): Record<string, string> {
  // Merged onto the stored map rather than replacing it when `extraLocales` is
  // not explicitly supplied: `localizedNames` is written wholesale, so a
  // caller that only passes `ar` and `en` preserves any stored third locale.
  const names = mergeLocaleCandidate(values, current);
  if (!hasValidLocaleKeys(names)) throw new Error("UOM_FORM_NAMES");
  return names;
}

function areSameLocalizedNames(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

export function buildCreateUomRequest(values: UomFormValues): CreateUomRequest {
  const code = values.code.trim().toUpperCase();
  if (!UOM_CODE_PATTERN.test(code) || code.length > UOM_CODE_MAX_LENGTH) {
    throw new Error("UOM_FORM_CODE");
  }
  const displayName = values.displayName.trim();
  if (displayName.length === 0 || displayName.length > UOM_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error("UOM_FORM_DISPLAY_NAME");
  }
  return {
    code,
    displayName,
    localizedNames: buildLocalizedNames(values),
  };
}

export function buildUpdateUomRequest(current: Uom, values: UomFormValues): UpdateUomRequest {
  const request: UpdateUomRequest = {};
  const displayName = values.displayName.trim();
  if (displayName.length === 0 || displayName.length > UOM_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error("UOM_FORM_DISPLAY_NAME");
  }
  if (displayName !== current.displayName) request.displayName = displayName;

  const names = buildLocalizedNames(values, current.localizedNames);
  if (!areSameLocalizedNames(names, current.localizedNames)) {
    request.localizedNames = names;
  }

  if (values.status !== current.status) request.status = values.status;
  return request;
}

function isUomStatus(value: unknown): value is UomStatus {
  return value === "ACTIVE" || value === "RETIRED";
}

export function parseUomResponse(payload: unknown): Uom {
  const uom = record(payload);
  if (
    !uom ||
    !isUuidV7(uom.id) ||
    !isNonEmptyString(uom.code, UOM_CODE_MAX_LENGTH) ||
    !isNonEmptyString(uom.displayName, UOM_DISPLAY_NAME_MAX_LENGTH) ||
    !isLocalizedNames(uom.localizedNames) ||
    !isUomStatus(uom.status) ||
    !isRowVersion(uom.version) ||
    !isTimestamp(uom.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: uom.id,
    code: uom.code,
    displayName: uom.displayName,
    localizedNames: uom.localizedNames,
    status: uom.status,
    version: uom.version,
    updatedAt: uom.updatedAt,
  };
}

export function parseUomsResponse(payload: unknown): TradePage<Uom> {
  return parseTradePage(payload, parseUomResponse, invalidResponse);
}

/**
 * `GET /catalog/uoms` — a **different resource** from `/uoms`, and the
 * controller comment says so: `/uoms` is the tenant master list, this is the
 * set authorised for the current operating context, optionally narrowed to one
 * item. It is the correct source for a UOM picker.
 *
 * Target `COMPANY_OR_BRANCH`, but a missing company header is **403
 * `TRADE.AUTH.TARGET_DENIED`** rather than the guard's 400 — `requireCompany()`
 * in the read projection throws a `ForbiddenException`.
 *
 * `search` matches an **id fragment**, not a name: the DTO pins
 * `^[0-9a-fA-F-]+$` and the query does `uom_id::text ILIKE $5 || '%'`.
 */
const CATALOG_UOMS_PATH = "/api/tenant/trade/v1/catalog/uoms";

/** `UomCataloguePurpose` — the only narrowing this route accepts. */
export type CatalogUomPurpose = "ANY" | "SALES" | "PURCHASE";

export interface CatalogUomOption {
  id: string;
  code: string;
  displayName: string;
  localizedNames?: Record<string, string>;
  version?: number;
  isBaseUom: boolean;
  isDefaultSalesUom?: boolean;
  isDefaultPurchaseUom?: boolean;
  canSell: boolean;
  canPurchase: boolean;
  sourceItemCount?: number;
}

export function catalogUomsPath(purpose: CatalogUomPurpose): TradePath {
  const query = new URLSearchParams({ page: "1", limit: "100", purpose });
  return `${CATALOG_UOMS_PATH}?${query.toString()}` as TradePath;
}

export function parseCatalogUomsResponse(payload: unknown): CatalogUomOption[] {
  return parseTradePage(payload, parseCatalogUomOption, invalidResponse).items;
}

function parseCatalogUomOption(payload: unknown): CatalogUomOption {
  const option = record(payload);
  if (
    !option ||
    !isUuidV7(option.id) ||
    !isNonEmptyString(option.code, UOM_CODE_MAX_LENGTH) ||
    !isNonEmptyString(option.displayName, UOM_DISPLAY_NAME_MAX_LENGTH) ||
    typeof option.isBaseUom !== "boolean" ||
    typeof option.canSell !== "boolean" ||
    typeof option.canPurchase !== "boolean"
  ) {
    invalidResponse();
  }
  return {
    id: option.id,
    code: option.code,
    displayName: option.displayName,
    ...(isLocalizedNames(option.localizedNames)
      ? { localizedNames: option.localizedNames }
      : {}),
    ...(isRowVersion(option.version) ? { version: option.version } : {}),
    isBaseUom: option.isBaseUom,
    ...(typeof option.isDefaultSalesUom === "boolean"
      ? { isDefaultSalesUom: option.isDefaultSalesUom }
      : {}),
    ...(typeof option.isDefaultPurchaseUom === "boolean"
      ? { isDefaultPurchaseUom: option.isDefaultPurchaseUom }
      : {}),
    canSell: option.canSell,
    canPurchase: option.canPurchase,
    ...(typeof option.sourceItemCount === "number"
      ? { sourceItemCount: option.sourceItemCount }
      : {}),
  };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade UOM response.");
}
