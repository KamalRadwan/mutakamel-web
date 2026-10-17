import { isUUIDv7 } from "@/lib/uuid";
import {
  TRADE_V1,
  isTradeDate,
  isTradeDecimal,
  nullableString,
  optionalUuid,
  parseTradeFinalizedDocument,
  record,
  tradeInvalidResponse,
  type TradeFinalizedDocument,
} from "../documents/trade-document-contract";

// Invoices — 7 routes.
//
// **Not feature-gated.** `TradeInvoicesController` carries no
// `@RequireTradeFeature`; the only entitlement check is `TRADE.MODULE.DISABLED`.
// All five non-PDF routes target `BRANCH` and are Gateway `BRANCH_REQUIRED`.

export const INVOICES_PATH = `${TRADE_V1}/invoices`;

export const INVOICE_PERMISSIONS = {
  read: "trade.invoices.read",
  create: "trade.invoices.create",
  update: "trade.invoices.update",
  issue: "trade.invoices.issue",
} as const;

export interface Invoice extends TradeFinalizedDocument {
  dueDate: string | null;
  /**
   * Always `null` from the API. `FinancialDocumentsService.create` writes
   * `sourceSalesOrderId: null` unconditionally and no route ever sets it, so
   * an invoice cannot be linked back to the order it bills. Recorded as Q81.
   */
  sourceSalesOrderId: string | null;
}

export interface InvoiceLine {
  id: string;
  clientLineId: string;
  itemId?: string | null;
  uomId: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  descriptionSnapshot: string | null;
}

export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
}

export function parseInvoice(payload: unknown): Invoice {
  const document = parseTradeFinalizedDocument(payload);
  const row = record(payload);
  if (!row) tradeInvalidResponse();
  return {
    ...document,
    dueDate:
      row.dueDate == null ? null : isTradeDate(row.dueDate) ? row.dueDate : tradeInvalidResponse(),
    sourceSalesOrderId: optionalUuid(row.sourceSalesOrderId),
  };
}

export function parseInvoiceDetail(payload: unknown): InvoiceDetail {
  const invoice = parseInvoice(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.lines)) tradeInvalidResponse();
  return { ...invoice, lines: row.lines.map(parseLine) };
}

function parseLine(payload: unknown): InvoiceLine {
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
    itemId: optionalUuid(line.itemId),
    uomId: line.uomId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    descriptionSnapshot: nullableString(line.descriptionSnapshot, 500),
  };
}

export interface InvoiceDraftLinePayload {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: string;
  unitPrice: string;
  discountTotal: string;
  chargeTotal: string;
  taxTotal: string;
  lineTotal: string;
  priceSnapshot: Record<string, unknown>;
  taxSnapshot: Record<string, unknown>;
  description?: string;
}

export interface InvoiceDraftContentRequest {
  partyId: string;
  currencyCode: string;
  dueDate?: string;
  reference?: string;
  notes?: string;
  termsSnapshot: Record<string, unknown>;
  totalsSnapshot: {
    subtotal: string;
    discountTotal: string;
    chargeTotal: string;
    taxTotal: string;
    roundingTotal: string;
    grandTotal: string;
    amountPaid: string;
    amountDue: string;
  };
  lines: InvoiceDraftLinePayload[];
}

export function buildInvoiceDraftContent(input: {
  partyId: string;
  currencyCode: string;
  dueDate?: string;
  reference?: string;
  notes?: string;
  termsSnapshot?: Record<string, unknown>;
  totalsSnapshot: InvoiceDraftContentRequest["totalsSnapshot"];
  lines: InvoiceDraftLinePayload[];
}): InvoiceDraftContentRequest {
  const code = input.currencyCode.trim().toUpperCase();
  if (!isUUIDv7(input.partyId.trim())) {
    throw new Error("INVOICE_FORM_CUSTOMER");
  }
  if (!/^[A-Z]{3}$/u.test(code)) {
    throw new Error("INVOICE_FORM_CURRENCY");
  }
  if (input.lines.length === 0) {
    throw new Error("INVOICE_FORM_LINES_EMPTY");
  }
  const due = input.dueDate?.trim() ?? "";
  const ref = input.reference?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";

  return {
    partyId: input.partyId.trim(),
    currencyCode: code,
    ...(due ? { dueDate: due } : {}),
    ...(ref ? { reference: ref.slice(0, 120) } : {}),
    ...(notes ? { notes: notes.slice(0, 8000) } : {}),
    termsSnapshot:
      input.termsSnapshot && Object.keys(input.termsSnapshot).length > 0
        ? input.termsSnapshot
        : { paymentTermDays: 30, paymentMethodHint: "BANK_TRANSFER" },
    totalsSnapshot: {
      ...input.totalsSnapshot,
      amountPaid: "0",
      amountDue: input.totalsSnapshot.grandTotal,
    },
    lines: input.lines,
  };
}

