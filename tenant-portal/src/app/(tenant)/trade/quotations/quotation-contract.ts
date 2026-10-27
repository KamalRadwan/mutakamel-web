import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_CURSOR_MAX_LENGTH,
  TRADE_V1,
  isBoundedString,
  isCurrencyCode,
  isTradeDate,
  isTradeDecimal,
  isTradeStatus,
  isTradeTimestamp,
  jsonObject,
  nullableString,
  optionalUuid,
  parseTradeDocumentHeader,
  record,
  tradeInvalidResponse,
  type TradeDocumentHeader,
} from "../documents/trade-document-contract";

// Quotations — 14 routes, feature gate `trade.sales`, every route targeting
// `BRANCH`. Verified against
// trade-app/src/modules/documents/{documents.controller,documents.service}.ts
// and dto/documents.dto.ts.
//
// **S6 cannot be satisfied on this screen.** Trade publishes no capabilities
// endpoint (Q30), so action admission is the permission string plus
// `is_tenant_owner` and nothing more. A 403 is an authoritative refusal, not a
// bug — see `TradeGate`.

export const QUOTATIONS_PATH = `${TRADE_V1}/quotations`;

export const QUOTATION_PERMISSIONS = {
  read: "trade.quotations.read",
  create: "trade.quotations.create",
  update: "trade.quotations.update",
  send: "trade.quotations.send",
  accept: "trade.quotations.accept",
  reject: "trade.quotations.reject",
  cancel: "trade.quotations.cancel",
  convert: "trade.quotations.convert",
} as const;

/** `QuotationCustomerOptionsQueryDto.limit` — 1..100, default 25. */
const QUOTATION_CUSTOMER_PAGE_SIZE = 50;

/**
 * The revision's own status, written alongside the quotation's.
 *
 * `DRAFT` is proven, not assumed: `createQuotationRevision` assigns
 * `status: "DRAFT"` and `quotationAction`'s `send` branch refuses anything
 * else. trade-documents.md lists this literal under "Not verified"; it is
 * verified here.
 */
export interface QuotationRevision {
  id: string;
  revisionNumber: number;
  status: string;
  validUntil: string;
  grandTotal: string;
  termsSnapshot: Record<string, unknown>;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  priceLockExpiresAt: string | null;
}

export interface QuotationLine {
  id: string;
  clientLineId: string;
  printLineNumber: number;
  descriptionSnapshot: string;
  quantity: string;
  uomId: string;
  unitPrice: string;
  lineTotal: string;
}

export interface Quotation extends TradeDocumentHeader {
  currentRevisionId: string | null;
  acceptedRevisionId: string | null;
  crmCustomerProfileId: string | null;
  customerEligibilitySource: string;
}

export interface QuotationDetail extends Quotation {
  revisions: QuotationRevision[];
  currentLines: QuotationLine[];
}

/** One row of `GET /quotations/customer-options`. */
export interface QuotationCustomerOption {
  partyId: string;
  displayName: string;
  crmCustomerProfileId: string | null;
  commercialAccountStatus: string;
  eligibilitySource: string;
  quotationSelectable: boolean;
  denialCode: string | null;
}

export interface QuotationCustomerPage {
  items: QuotationCustomerOption[];
  /**
   * **Omitted entirely on the last page — not `null`.** The cursor is
   * base64url JSON and unsigned, but it is an opaque token here: passed back
   * verbatim, never parsed. An unparseable cursor is *silently ignored* by the
   * service and the first page comes back, so a paging bug looks like a loop
   * rather than a failure.
   */
  nextCursor: string | null;
}

export interface CreateQuotationRequest {
  partyId: string;
  currencyCode: string;
  crmCustomerProfileId?: string;
  draftReference?: string;
}

// `UpdateQuotationDto` accepts a nullable `contactPartyId` and a nullable
// `draftReference` and nothing else — party, currency and lines cannot be
// patched. `CreateQuotationRevisionDto` takes `validUntil`, the line set and an
// optional `terms`. Both bodies are two or three keys built at their call
// sites; a named type for each would be a second place to keep in step with
// the DTO.

/**
 * `GET /quotations/customer-options` — the only cursor-paged route in Trade.
 *
 * Gated on **`trade.quotations.create`**, not `.read`: a user who may read
 * quotations and not create them gets a 403 from the customer picker, so it is
 * never fetched on the detail screen.
 */
export function quotationCustomerOptionsPath(search: string, cursor: string | null): TradePath {
  const query = new URLSearchParams({ limit: String(QUOTATION_CUSTOMER_PAGE_SIZE) });
  if (search.trim()) query.set("search", search.trim().slice(0, 120));
  if (cursor && cursor.length <= TRADE_CURSOR_MAX_LENGTH) query.set("cursor", cursor);
  return `${QUOTATIONS_PATH}/customer-options?${query.toString()}` as TradePath;
}

export function parseQuotation(payload: unknown): Quotation {
  const header = parseTradeDocumentHeader(payload);
  const row = record(payload);
  if (!row || !isTradeStatus(row.customerEligibilitySource)) tradeInvalidResponse();
  return {
    ...header,
    currentRevisionId: optionalUuid(row.currentRevisionId),
    acceptedRevisionId: optionalUuid(row.acceptedRevisionId),
    crmCustomerProfileId: optionalUuid(row.crmCustomerProfileId),
    customerEligibilitySource: row.customerEligibilitySource,
  };
}

export function parseQuotationDetail(payload: unknown): QuotationDetail {
  const quotation = parseQuotation(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.revisions) || !Array.isArray(row.currentLines)) {
    tradeInvalidResponse();
  }
  return {
    ...quotation,
    revisions: row.revisions.map(parseRevision),
    currentLines: row.currentLines.map(parseLine),
  };
}

export function parseQuotationCustomerPage(payload: unknown): QuotationCustomerPage {
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) tradeInvalidResponse();
  return {
    items: page.items.map(parseCustomerOption),
    // Absent means "last page". `null` would be a value the service never
    // sends, so treating absence as the terminator is the whole contract.
    nextCursor:
      typeof page.nextCursor === "string" && page.nextCursor.length <= TRADE_CURSOR_MAX_LENGTH
        ? page.nextCursor
        : null,
  };
}

function parseRevision(payload: unknown): QuotationRevision {
  const revision = record(payload);
  if (
    !revision ||
    !isUUIDv7(revision.id) ||
    typeof revision.revisionNumber !== "number" ||
    !isTradeStatus(revision.status) ||
    !isTradeDate(revision.validUntil) ||
    !isTradeDecimal(revision.grandTotal)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    status: revision.status,
    validUntil: revision.validUntil,
    grandTotal: revision.grandTotal,
    termsSnapshot: jsonObject(revision.termsSnapshot),
    sentAt: optionalTimestamp(revision.sentAt),
    acceptedAt: optionalTimestamp(revision.acceptedAt),
    rejectedAt: optionalTimestamp(revision.rejectedAt),
    priceLockExpiresAt: optionalTimestamp(revision.priceLockExpiresAt),
  };
}

function parseLine(payload: unknown): QuotationLine {
  const line = record(payload);
  if (
    !line ||
    !isUUIDv7(line.id) ||
    !isUUIDv7(line.clientLineId) ||
    typeof line.printLineNumber !== "number" ||
    !isBoundedString(line.descriptionSnapshot, 500) ||
    !isTradeDecimal(line.quantity) ||
    !isUUIDv7(line.uomId) ||
    !isTradeDecimal(line.unitPrice) ||
    !isTradeDecimal(line.lineTotal)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: line.id,
    clientLineId: line.clientLineId,
    printLineNumber: line.printLineNumber,
    descriptionSnapshot: line.descriptionSnapshot,
    quantity: line.quantity,
    uomId: line.uomId,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  };
}

function parseCustomerOption(payload: unknown): QuotationCustomerOption {
  const option = record(payload);
  if (
    !option ||
    !isUUIDv7(option.partyId) ||
    !isBoundedString(option.displayName, 500) ||
    !isTradeStatus(option.commercialAccountStatus) ||
    !isTradeStatus(option.eligibilitySource) ||
    typeof option.quotationSelectable !== "boolean"
  ) {
    tradeInvalidResponse();
  }
  return {
    partyId: option.partyId,
    displayName: option.displayName,
    crmCustomerProfileId: optionalUuid(option.crmCustomerProfileId),
    commercialAccountStatus: option.commercialAccountStatus,
    eligibilitySource: option.eligibilitySource,
    // A blocked customer is **returned, not filtered out**. Rendering it
    // disabled with the reason is the difference between "this account is
    // blocked" and "this customer does not exist".
    quotationSelectable: option.quotationSelectable,
    denialCode: nullableString(option.denialCode, 120),
  };
}

function optionalTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isTradeTimestamp(value) ? value : tradeInvalidResponse();
}

/** `CreateQuotationDto` — `partyId` and `currencyCode` are the only required fields. */
export function buildCreateQuotation(
  option: QuotationCustomerOption,
  currencyCode: string,
  draftReference: string,
): CreateQuotationRequest {
  const code = currencyCode.trim().toUpperCase();
  if (!isUUIDv7(option.partyId)) throw new Error("QUOTATION_FORM_CUSTOMER");
  if (!isCurrencyCode(code)) throw new Error("QUOTATION_FORM_CURRENCY");
  const request: CreateQuotationRequest = { partyId: option.partyId, currencyCode: code };
  // Retained so every forward quotation command can revalidate the same
  // customer identity, exactly as the service does.
  if (option.crmCustomerProfileId) request.crmCustomerProfileId = option.crmCustomerProfileId;
  const reference = draftReference.trim();
  if (reference) request.draftReference = reference.slice(0, 80);
  return request;
}
