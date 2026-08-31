import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { NON_NEGATIVE_DECIMAL } from "./fixed-decimal";

// The vocabulary the six commercial-document families share. Everything here
// is transcribed from trade-app source, cited per item; nothing is inferred
// from a name.
//
// Trade publishes no response DTO classes at all — every document `GET`
// returns the TypeORM entity spread (`{ ...quotation, revisions, currentLines }`
// in `DocumentsService.getQuotation`), so the response contract is the entity's
// column list. These parsers are written against
// trade-app/packages/database/src/entities/tenant/document.entities.ts.

export const TRADE_V1 = "/api/tenant/trade/v1";

/** `DocumentListQueryDto` — `limit` is capped at 100 and defaults to 25. */
export const TRADE_DOCUMENT_PAGE_SIZE = 25;

/** `QuotationCustomerOptionsQueryDto.cursor` — `@MaxLength(512)`. */
export const TRADE_CURSOR_MAX_LENGTH = 512;

/** `DocumentReasonDto.reasonCode` — `@MaxLength(80)`. */
export const TRADE_REASON_CODE_MAX_LENGTH = 80;

/** `draftReference` — `@MaxLength(80)` on quotations, sales and purchase orders. */
export const TRADE_DRAFT_REFERENCE_MAX_LENGTH = 80;

/** `reference` — `@MaxLength(120)` on purchase quotations, invoices, contracts. */
export const TRADE_REFERENCE_MAX_LENGTH = 120;

/** `notes` — `@MaxLength(8_000)`. */
export const TRADE_NOTES_MAX_LENGTH = 8_000;

// Response size bounds. A document `GET` carries its whole line set, so the
// detail bound has to allow 1000 lines of entity columns; a list page carries
// at most 100 headers.
export const TRADE_LIST_RESPONSE_BYTES = 500_000;
export const TRADE_DOCUMENT_RESPONSE_BYTES = 2_000_000;
export const TRADE_ACTION_RESPONSE_BYTES = 200_000;

/**
 * `TradeDocumentHeaderEntity` — the columns every quotation, sales order and
 * purchase order carries.
 *
 * There is deliberately **no `settlementStatus`**. `SettlementStatus` is an
 * exported enum in `@mutakamel/trade-app-common` with no column, no writer and
 * no reader anywhere in `trade-app` — rendering it would be inventing a field.
 */
export interface TradeDocumentHeader {
  id: string;
  version: number;
  companyId: string;
  branchId: string;
  partyId: string;
  contactPartyId: string | null;
  currencyCode: string;
  businessDate: string;
  lifecycleStatus: string;
  approvalStatus: string;
  fulfillmentStatus: string;
  billingStatus: string;
  grandTotal: string;
  documentNumber: string | null;
  draftReference: string | null;
  partySnapshot: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `TradeFinalizedPrintDocumentEntity` — purchase quotations, invoices and
 * contracts. A different table shape from the header above: `documentNumber`
 * is assigned at creation and non-null, there is no approval or fulfilment
 * axis, and `totalsSnapshot` is the authored evidence rather than a column.
 */
export interface TradeFinalizedDocument {
  id: string;
  version: number;
  companyId: string;
  branchId: string;
  partyId: string;
  currencyCode: string;
  businessDate: string;
  documentNumber: string;
  reference: string | null;
  lifecycleStatus: string;
  notes: string | null;
  partySnapshot: Record<string, unknown>;
  termsSnapshot: Record<string, unknown>;
  totalsSnapshot: Record<string, unknown>;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeListPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function tradeInvalidResponse(): never {
  throw new Error("Invalid Trade document response.");
}

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function jsonObject(value: unknown): Record<string, unknown> {
  return record(value) ?? {};
}

/**
 * Every money and quantity field in Trade is a decimal string of at most eight
 * places. `Number(` appears nowhere in trade-app's document services for one of
 * them, and `fixedDecimalText` strips trailing zeros before they are written —
 * so a padded form never arrives and never should be compared against.
 */
export function isTradeDecimal(value: unknown): value is string {
  return typeof value === "string" && NON_NEGATIVE_DECIMAL.test(value);
}

export function isTradeTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** A `date` column — `businessDate`, `validUntil`, `expectedDate`. */
export function isTradeDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

export function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function nullableString(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  return isBoundedString(value, max) ? value : tradeInvalidResponse();
}

export function isTradeStatus(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 32;
}

export function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** `^[A-Z]{3}$` — `CURRENCY_PATTERN` on every create DTO. */
export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/u.test(value);
}

export function parseTradeListPage<T>(
  payload: unknown,
  parseItem: (item: unknown) => T,
): TradeListPage<T> {
  const page = record(payload);
  if (
    !page ||
    !Array.isArray(page.items) ||
    typeof page.total !== "number" ||
    typeof page.page !== "number" ||
    typeof page.limit !== "number"
  ) {
    tradeInvalidResponse();
  }
  return {
    items: page.items.map(parseItem),
    total: page.total,
    page: page.page,
    limit: page.limit,
  };
}

export function parseTradeDocumentHeader(payload: unknown): TradeDocumentHeader {
  const header = record(payload);
  if (
    !header ||
    !isUUIDv7(header.id) ||
    !isVersion(header.version) ||
    !isUUIDv7(header.companyId) ||
    !isUUIDv7(header.branchId) ||
    !isUUIDv7(header.partyId) ||
    !isCurrencyCode(header.currencyCode) ||
    !isTradeDate(header.businessDate) ||
    !isTradeStatus(header.lifecycleStatus) ||
    !isTradeStatus(header.approvalStatus) ||
    !isTradeStatus(header.fulfillmentStatus) ||
    !isTradeStatus(header.billingStatus) ||
    !isTradeDecimal(header.grandTotal) ||
    !isTradeTimestamp(header.createdAt) ||
    !isTradeTimestamp(header.updatedAt)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: header.id,
    version: header.version,
    companyId: header.companyId,
    branchId: header.branchId,
    partyId: header.partyId,
    contactPartyId: optionalUuid(header.contactPartyId),
    currencyCode: header.currencyCode,
    businessDate: header.businessDate,
    lifecycleStatus: header.lifecycleStatus,
    approvalStatus: header.approvalStatus,
    fulfillmentStatus: header.fulfillmentStatus,
    billingStatus: header.billingStatus,
    grandTotal: header.grandTotal,
    documentNumber: nullableString(header.documentNumber, 80),
    draftReference: nullableString(header.draftReference, TRADE_DRAFT_REFERENCE_MAX_LENGTH),
    partySnapshot: jsonObject(header.partySnapshot),
    createdBy: optionalUuid(header.createdBy),
    createdAt: header.createdAt,
    updatedAt: header.updatedAt,
  };
}

export function parseTradeFinalizedDocument(payload: unknown): TradeFinalizedDocument {
  const document = record(payload);
  if (
    !document ||
    !isUUIDv7(document.id) ||
    !isVersion(document.version) ||
    !isUUIDv7(document.companyId) ||
    !isUUIDv7(document.branchId) ||
    !isUUIDv7(document.partyId) ||
    !isCurrencyCode(document.currencyCode) ||
    !isTradeDate(document.businessDate) ||
    !isBoundedString(document.documentNumber, 80) ||
    !isTradeStatus(document.lifecycleStatus) ||
    !isTradeTimestamp(document.createdAt) ||
    !isTradeTimestamp(document.updatedAt)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: document.id,
    version: document.version,
    companyId: document.companyId,
    branchId: document.branchId,
    partyId: document.partyId,
    currencyCode: document.currencyCode,
    businessDate: document.businessDate,
    documentNumber: document.documentNumber,
    reference: nullableString(document.reference, TRADE_REFERENCE_MAX_LENGTH),
    lifecycleStatus: document.lifecycleStatus,
    notes: nullableString(document.notes, TRADE_NOTES_MAX_LENGTH),
    partySnapshot: jsonObject(document.partySnapshot),
    termsSnapshot: jsonObject(document.termsSnapshot),
    totalsSnapshot: jsonObject(document.totalsSnapshot),
    finalizedAt: document.finalizedAt === null || document.finalizedAt === undefined
      ? null
      : isTradeTimestamp(document.finalizedAt)
        ? document.finalizedAt
        : tradeInvalidResponse(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/**
 * The eight authored totals, read back off a finalized document.
 *
 * Missing keys are not an error: `emptyTotals()` seeds a purchase quotation
 * before its lines are priced, so a fresh draft legitimately carries figures
 * that are all zero, and a projection may add keys this list does not name.
 */
export function readTotalsSnapshot(snapshot: Record<string, unknown>): Record<string, string> {
  const totals: Record<string, string> = {};
  for (const key of [
    "subtotal",
    "discountTotal",
    "chargeTotal",
    "taxTotal",
    "roundingTotal",
    "grandTotal",
    "amountPaid",
    "amountDue",
  ]) {
    const value = snapshot[key];
    if (typeof value === "string") totals[key] = value;
  }
  return totals;
}

export function optionalUuid(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isUUIDv7(value) ? value : tradeInvalidResponse();
}

/**
 * Reads the party's display name out of the snapshot the service wrote.
 *
 * `scopeSnapshots` in financial-documents.service.ts stores `{ id, displayName }`
 * and the order services store the same shape, but the column is plain `jsonb`
 * with no check constraint, so this cannot assume the key is present.
 */
export function partyDisplayName(snapshot: Record<string, unknown>): string | null {
  for (const key of ["displayName", "name", "legalName"]) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

/** `page` and `limit` are the only list parameters `DocumentListQueryDto` reads. */
export function tradeListPath(
  base: string,
  page: number,
  status?: string,
  partyId?: string,
): TradePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(TRADE_DOCUMENT_PAGE_SIZE),
  });
  if (status) query.set("status", status);
  if (partyId) query.set("partyId", partyId);
  return `${base}?${query.toString()}` as TradePath;
}

export function tradeDocumentPath(base: string, id: string): TradePath {
  if (!isUUIDv7(id)) tradeInvalidResponse();
  return `${base}/${encodeURIComponent(id)}` as TradePath;
}

export function tradeDocumentActionPath(base: string, id: string, action: string): TradePath {
  return `${tradeDocumentPath(base, id)}/${action}` as TradePath;
}
