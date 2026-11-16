import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_NOTES_MAX_LENGTH,
  TRADE_REFERENCE_MAX_LENGTH,
  TRADE_V1,
  isCurrencyCode,
  isTradeDate,
  isTradeDecimal,
  nullableString,
  parseTradeFinalizedDocument,
  record,
  tradeInvalidResponse,
  type TradeFinalizedDocument,
} from "../documents/trade-document-contract";

// Purchase quotations — 9 routes, feature gate `trade.purchasing`. All nine
// target `BRANCH` **and** are Gateway `BRANCH_REQUIRED`, so the header shape is
// validated twice.
//
// This is the one commercial-document family the portal can create and edit in
// full: `CreatePurchaseQuotationDto` carries **no financial evidence at all**.
// The lines are items, units and quantities; the service prices them from the
// selected price book and freezes the display labels at issue. Nothing here has
// to compose a tax or price snapshot, which is what blocks the other five.

export const PURCHASE_QUOTATIONS_PATH = `${TRADE_V1}/purchase-quotations`;

export const PURCHASE_QUOTATION_PERMISSIONS = {
  read: "trade.purchase_quotations.read",
  create: "trade.purchase_quotations.create",
  update: "trade.purchase_quotations.update",
  issue: "trade.purchase_quotations.issue",
} as const;

export interface PurchaseQuotation extends TradeFinalizedDocument<string | null> {
  validUntil: string | null;
}

export interface PurchaseQuotationLine {
  id: string;
  clientLineId: string;
  itemId: string;
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
  partyId: string;
  displayName: string;
}

export interface CreatePurchaseQuotationRequest {
  supplierPartyId: string;
  currencyCode: string;
  validUntil: string;
  reference?: string;
  notes?: string;
  lines: Array<{ clientLineId: string; itemId: string; uomId: string; quantity: string }>;
}

export type UpdatePurchaseQuotationRequest = Omit<CreatePurchaseQuotationRequest, "lines"> & {
  lines?: CreatePurchaseQuotationRequest["lines"];
};

export function supplierAccountsPath(search = ""): TradePath {
  const query = new URLSearchParams({
    limit: "50",
  });
  if (search.trim()) query.set("search", search.trim());
  return `${PURCHASE_QUOTATIONS_PATH}/supplier-options?${query.toString()}` as TradePath;
}

export function parsePurchaseQuotation(payload: unknown): PurchaseQuotation {
  const document = parseTradeFinalizedDocument(payload, { allowUnnumberedDraft: true });
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
    if (!account || !isUUIDv7(account.partyId) ||
        typeof account.displayName !== "string" || !account.displayName.trim()) {
      tradeInvalidResponse();
    }
    return { partyId: account.partyId, displayName: account.displayName };
  });
}

function parseLine(payload: unknown): PurchaseQuotationLine {
  const line = record(payload);
  if (
    !line ||
    !isUUIDv7(line.id) ||
    !isUUIDv7(line.clientLineId) ||
    !isUUIDv7(line.itemId) ||
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
    itemId: line.itemId,
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

export function buildUpdatePurchaseQuotation(
  input: Parameters<typeof buildCreatePurchaseQuotation>[0],
  existing: PurchaseQuotationDetail,
): UpdatePurchaseQuotationRequest {
  const { lines, ...header } = buildCreatePurchaseQuotation(input);
  // The service deletes and recreates every row when lines are supplied.
  // Supplier/currency changes require that replacement to refresh pricing.
  const linesUnchanged =
    lines.length === existing.lines.length &&
    lines.every((line, index) => {
      const original = existing.lines[index];
      return original !== undefined &&
        line.clientLineId === original.clientLineId &&
        line.itemId === original.itemId &&
        line.uomId === original.uomId &&
        line.quantity === original.quantity;
    });
  const pricingUnchanged = header.supplierPartyId === existing.partyId &&
    header.currencyCode === existing.currencyCode;
  return linesUnchanged && pricingUnchanged ? header : { ...header, lines };
}

export function isPurchaseQuotationDraft(quotation: PurchaseQuotation): boolean {
  return quotation.lifecycleStatus === "DRAFT";
}
