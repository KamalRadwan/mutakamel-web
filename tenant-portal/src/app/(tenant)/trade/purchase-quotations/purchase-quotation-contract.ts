import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_NOTES_MAX_LENGTH,
  TRADE_REFERENCE_MAX_LENGTH,
  TRADE_V1,
  isCurrencyCode,
  isTradeDate,
  isTradeDecimal,
  isTradeStatus,
  nullableString,
  parseTradeFinalizedDocument,
  record,
  tradeInvalidResponse,
  type TradeFinalizedDocument,
} from "../documents/trade-document-contract";

// Purchase quotations — 8 routes, feature gate `trade.purchasing`. All eight
// target `BRANCH` **and** are Gateway `BRANCH_REQUIRED`, so the header shape is
// validated twice.
//
// This is the one commercial-document family the portal can create and edit in
// full: `CreatePurchaseQuotationDto` carries **no financial evidence at all**.
// The lines are items, units and quantities; the service prices them from the
// selected price book and freezes the display labels at issue. Nothing here has
// to compose a tax or price snapshot, which is what blocks the other five.

export const PURCHASE_QUOTATIONS_PATH = `${TRADE_V1}/purchase-quotations`;

/**
 * Supplier accounts, used as the supplier picker.
 *
 * There is **no supplier name source in Trade**. `GET /commercial-accounts`
 * returns `TradeCommercialAccountEntity` rows, whose only identity column is
 * `party_id`; `GET /commercial-accounts/lookups` returns payment terms and
 * credit policies, not accounts. Quotations have `customer-options` with a
 * `displayName`; purchasing has no equivalent. Recorded as Q83.
 */
const COMMERCIAL_ACCOUNTS_PATH = `${TRADE_V1}/commercial-accounts`;

export const PURCHASE_QUOTATION_PERMISSIONS = {
  read: "trade.purchase_quotations.read",
  create: "trade.purchase_quotations.create",
  update: "trade.purchase_quotations.update",
  issue: "trade.purchase_quotations.issue",
  /** The supplier picker's own grant, which the document grants do not imply. */
  accounts: "trade.commercial_accounts.read",
} as const;

export interface PurchaseQuotation extends TradeFinalizedDocument {
  validUntil: string | null;
}

export interface PurchaseQuotationLine {
  id: string;
  clientLineId: string;
  uomId: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  descriptionSnapshot: string | null;
}

export interface PurchaseQuotationDetail extends PurchaseQuotation {
  lines: PurchaseQuotationLine[];
}

export interface SupplierAccountOption {
  id: string;
  partyId: string;
  status: string;
}

export interface CreatePurchaseQuotationRequest {
  supplierPartyId: string;
  currencyCode: string;
  validUntil: string;
  reference?: string;
  notes?: string;
  lines: Array<{ clientLineId: string; itemId: string; uomId: string; quantity: string }>;
}

export function supplierAccountsPath(): TradePath {
  const query = new URLSearchParams({
    page: "1",
    limit: "100",
    accountRole: "SUPPLIER",
    status: "ACTIVE",
  });
  return `${COMMERCIAL_ACCOUNTS_PATH}?${query.toString()}` as TradePath;
}

export function parsePurchaseQuotation(payload: unknown): PurchaseQuotation {
  const document = parseTradeFinalizedDocument(payload);
  const row = record(payload);
  if (!row) tradeInvalidResponse();
  return {
    ...document,
    validUntil:
      row.validUntil == null
        ? null
        : isTradeDate(row.validUntil)
          ? row.validUntil
          : tradeInvalidResponse(),
  };
}

export function parsePurchaseQuotationDetail(payload: unknown): PurchaseQuotationDetail {
  const quotation = parsePurchaseQuotation(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.lines)) tradeInvalidResponse();
  return { ...quotation, lines: row.lines.map(parseLine) };
}

export function parseSupplierAccounts(payload: unknown): SupplierAccountOption[] {
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) tradeInvalidResponse();
  return page.items.map((item) => {
    const account = record(item);
    if (!account || !isUUIDv7(account.id) || !isUUIDv7(account.partyId) || !isTradeStatus(account.status)) {
      tradeInvalidResponse();
    }
    return { id: account.id, partyId: account.partyId, status: account.status };
  });
}

function parseLine(payload: unknown): PurchaseQuotationLine {
  const line = record(payload);
  if (
    !line ||
    !isUUIDv7(line.id) ||
    !isUUIDv7(line.clientLineId) ||
    !isUUIDv7(line.uomId) ||
    !isTradeDecimal(line.quantity) ||
    !isTradeDecimal(line.unitPrice) ||
    !isTradeDecimal(line.lineTotal)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: line.id,
    clientLineId: line.clientLineId,
    uomId: line.uomId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    // Draft rows hold a deliberately incomplete server-derived envelope; the
    // label is frozen at issue, so a draft legitimately has none.
    descriptionSnapshot: nullableString(line.descriptionSnapshot, 500),
  };
}

/**
 * `CreatePurchaseQuotationDto`.
 *
 * `terms` is **omitted**: the DTO defaults it to `{}` and `null` is a 400, and
 * there is no published schema for a document terms snapshot (Q32). Unlike a
 * quotation revision, that omission costs nothing here — `issue` does not
 * require non-empty terms.
 */
export function buildCreatePurchaseQuotation(input: {
  supplierPartyId: string;
  currencyCode: string;
  validUntil: string;
  reference: string;
  notes: string;
  lines: Array<{ clientLineId: string; itemId: string; uomId: string; quantity: string }>;
}): CreatePurchaseQuotationRequest {
  const currencyCode = input.currencyCode.trim().toUpperCase();
  if (!isUUIDv7(input.supplierPartyId)) throw new Error("PURCHASE_QUOTATION_FORM_SUPPLIER");
  if (!isCurrencyCode(currencyCode)) throw new Error("PURCHASE_QUOTATION_FORM_CURRENCY");
  if (!isTradeDate(input.validUntil)) throw new Error("PURCHASE_QUOTATION_FORM_VALIDITY");

  const request: CreatePurchaseQuotationRequest = {
    supplierPartyId: input.supplierPartyId,
    currencyCode,
    validUntil: input.validUntil,
    lines: input.lines,
  };
  const reference = input.reference.trim();
  if (reference) request.reference = reference.slice(0, TRADE_REFERENCE_MAX_LENGTH);
  const notes = input.notes.trim();
  if (notes) request.notes = notes.slice(0, TRADE_NOTES_MAX_LENGTH);
  return request;
}

export function isPurchaseQuotationDraft(quotation: PurchaseQuotation): boolean {
  return quotation.lifecycleStatus === "DRAFT";
}

export function supplierOptionLabel(option: SupplierAccountOption): string {
  return option.partyId;
}
