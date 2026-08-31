import type { TradePath } from "@/lib/api/envelope";
import {
  hasValidLocaleKeys,
  isJsonObject,
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
export const UOM_SOURCE_KIND_MAX_LENGTH = 80;
export const UOM_REFERENCE_MAX_LENGTH = 240;
export const UOM_NOTE_MAX_LENGTH = 500;
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

interface UomSourceEvidence {
  sourceKind: string;
  reference: string | null;
  note: string | null;
  /** Stamped by the service, never sent: `recordedBy` and `recordedAt`. */
  recordedBy: string | null;
  recordedAt: string | null;
}

export interface Uom {
  id: string;
  code: string;
  displayName: string;
  localizedNames: Record<string, string>;
  sourceEvidence: UomSourceEvidence;
  status: UomStatus;
  version: number;
  updatedAt: string;
}

export interface UomFormValues {
  code: string;
  displayName: string;
  nameAr: string;
  nameEn: string;
  sourceKind: string;
  reference: string;
  note: string;
  status: UomStatus;
}

export const EMPTY_UOM_FORM: UomFormValues = {
  code: "",
  displayName: "",
  nameAr: "",
  nameEn: "",
  sourceKind: "",
  reference: "",
  note: "",
  status: "ACTIVE",
};

export function toUomForm(uom: Uom): UomFormValues {
  return {
    code: uom.code,
    displayName: uom.displayName,
    nameAr: uom.localizedNames.ar ?? "",
    nameEn: uom.localizedNames.en ?? "",
    sourceKind: uom.sourceEvidence.sourceKind,
    reference: uom.sourceEvidence.reference ?? "",
    note: uom.sourceEvidence.note ?? "",
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

interface UomSourceEvidenceRequest {
  sourceKind: string;
  reference?: string;
  note?: string;
}

/** `CreateUomDto` — every field is required, `sourceEvidence` included. */
export interface CreateUomRequest {
  code: string;
  displayName: string;
  localizedNames: Record<string, string>;
  sourceEvidence: UomSourceEvidenceRequest;
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
  sourceEvidence?: UomSourceEvidenceRequest;
  status?: UomStatus;
}

function buildLocalizedNames(
  values: UomFormValues,
  current?: Record<string, string>,
): Record<string, string> {
  // Merged onto the stored map rather than replacing it: `localizedNames` is
  // written wholesale, and this form offers two locales, so a tenant that
  // stored a third would silently lose it on the next save.
  const names: Record<string, string> = { ...(current ?? {}) };
  const arabic = values.nameAr.trim();
  const english = values.nameEn.trim();
  if (arabic) names.ar = arabic;
  else delete names.ar;
  if (english) names.en = english;
  else delete names.en;
  if (!hasValidLocaleKeys(names)) throw new Error("UOM_FORM_NAMES");
  return names;
}

function buildEvidence(values: UomFormValues): UomSourceEvidenceRequest {
  const sourceKind = values.sourceKind.trim();
  if (sourceKind.length === 0 || sourceKind.length > UOM_SOURCE_KIND_MAX_LENGTH) {
    throw new Error("UOM_FORM_EVIDENCE");
  }
  const reference = values.reference.trim();
  const note = values.note.trim();
  if (reference.length > UOM_REFERENCE_MAX_LENGTH || note.length > UOM_NOTE_MAX_LENGTH) {
    throw new Error("UOM_FORM_EVIDENCE");
  }
  return {
    sourceKind,
    ...(reference ? { reference } : {}),
    ...(note ? { note } : {}),
  };
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
    sourceEvidence: buildEvidence(values),
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
  if (JSON.stringify(names) !== JSON.stringify(current.localizedNames)) {
    request.localizedNames = names;
  }

  const evidence = buildEvidence(values);
  if (
    evidence.sourceKind !== current.sourceEvidence.sourceKind ||
    (evidence.reference ?? null) !== current.sourceEvidence.reference ||
    (evidence.note ?? null) !== current.sourceEvidence.note
  ) {
    request.sourceEvidence = evidence;
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
    !isJsonObject(uom.sourceEvidence) ||
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
    sourceEvidence: parseSourceEvidence(uom.sourceEvidence),
    status: uom.status,
    version: uom.version,
    updatedAt: uom.updatedAt,
  };
}

/**
 * `source_evidence` is a `jsonb` column with no response DTO. `sourceKind` is
 * the only key the service guarantees; the rest are optional or stamped, so
 * they are read defensively rather than asserted.
 */
function parseSourceEvidence(evidence: Record<string, unknown>): UomSourceEvidence {
  if (!isNonEmptyString(evidence.sourceKind, UOM_SOURCE_KIND_MAX_LENGTH)) invalidResponse();
  return {
    sourceKind: evidence.sourceKind,
    reference: typeof evidence.reference === "string" ? evidence.reference : null,
    note: typeof evidence.note === "string" ? evidence.note : null,
    recordedBy: typeof evidence.recordedBy === "string" ? evidence.recordedBy : null,
    recordedAt: typeof evidence.recordedAt === "string" ? evidence.recordedAt : null,
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
  isBaseUom: boolean;
  canSell: boolean;
  canPurchase: boolean;
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
    isBaseUom: option.isBaseUom,
    canSell: option.canSell,
    canPurchase: option.canPurchase,
  };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade UOM response.");
}
