import type { AxiosResponse } from "@/lib/api/axiosClient";
import { acceptedAmountUnits as units, acceptedMoney as money, readAcceptedPricing, verifyAcceptedPricing } from "@/shared/api/accepted-pricing";
import { array, contractFailure, date, integer, nullable, object, oneOf, readCommercialResponse, record, text, uuid } from "@/shared/api/commercial-contract";
import { INVOICE_PURPOSES, INVOICE_STATUSES, type CoreSnapshot, type Invoice } from "../types/invoices";

export const INVOICE_DETAIL_MAX_BYTES = 4 * 1024 * 1024;
const currency = text(3, /^[A-Z]{3}$/u);
const headerFields = {
  id: uuid, subscriptionId: uuid, tenantId: uuid, number: text(255, /\S/u), status: oneOf(INVOICE_STATUSES), purpose: oneOf(INVOICE_PURPOSES),
  currencyCode: currency, subtotal: money, taxTotal: money, total: money, settlementCurrencyCode: currency,
  settlementSubtotalUsd: nullable(money), settlementTaxTotalUsd: nullable(money), settlementTotalUsd: nullable(money), amountPaidUsd: money,
  periodStart: nullable(date), periodEnd: nullable(date), issuedAt: nullable(date), dueAt: nullable(date), paidAt: nullable(date), createdAt: date, updatedAt: date,
};
const lineFields = { id: uuid, invoiceId: uuid, description: text(255, /\S/u),
  quantity: text(13, /^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/u), unitPrice: money, lineTotal: money };
const retainedFields = { ...lineFields, quantity: oneOf(["1.00"]),
  baseItemId: uuid, acceptedSeats: integer(1, 100000), acceptedPricingSnapshot: readAcceptedPricing };
const baseLine = object({ ...retainedFields, sourceKind: oneOf(["APPLICATION"]), addonSelectionId: oneOf([null]), addonDefinitionVersionId: oneOf([null]) });
const addonLine = object({ ...retainedFields, sourceKind: oneOf(["ADDON"]), addonSelectionId: uuid, addonDefinitionVersionId: uuid });
const manualLine = object({ ...lineFields, sourceKind: oneOf([null]),
  baseItemId: oneOf([null]), addonSelectionId: oneOf([null]), addonDefinitionVersionId: oneOf([null]), acceptedSeats: oneOf([null]), acceptedPricingSnapshot: oneOf([null]) });
const retainedLine = (value: unknown) => record(value).sourceKind === "APPLICATION" ? baseLine(value) : addonLine(value);
const retainedView = object({ invoice: object(headerFields), lines: array(retainedLine, 200) });
const manualView = object({ invoice: object({ ...headerFields, purpose: oneOf(["MANUAL"]) }), lines: array(manualLine, 200) });
export type RetainedInvoice = ReturnType<typeof retainedView>;
export type ManualInvoice = ReturnType<typeof manualView>;
export type InvoiceCommercial = RetainedInvoice | ManualInvoice;
export function isRetainedInvoice(value: InvoiceCommercial): value is RetainedInvoice {
  return value.lines.length > 0 && value.lines.every(line => line.sourceKind !== null);
}
export type RetainedInvoiceLine = ReturnType<typeof retainedLine>;
const unique = (values: string[]) => { if (new Set(values).size !== values.length) contractFailure(); };

export function readInvoiceCommercial(value: unknown): InvoiceCommercial {
  const raw = record(value);
  const rawLines = array(record, 200)(raw.lines);
  const result = rawLines.length > 0 && rawLines.every(line => line.sourceKind === null) ? manualView(value) : retainedView(value);
  const { invoice, lines } = result;
  if (!lines.length) contractFailure();
  unique(lines.map(line => line.id));
  if (units(invoice.subtotal) + units(invoice.taxTotal) !== units(invoice.total)
    || (invoice.periodStart === null) !== (invoice.periodEnd === null)
    || (invoice.periodStart !== null && Date.parse(invoice.periodEnd!) <= Date.parse(invoice.periodStart))) contractFailure();
  const settlement = [invoice.settlementSubtotalUsd, invoice.settlementTaxTotalUsd, invoice.settlementTotalUsd];
  if (settlement.some(value => value === null) && !settlement.every(value => value === null)) contractFailure();
  if (invoice.settlementTotalUsd !== null && (invoice.settlementCurrencyCode !== "USD"
    || units(invoice.settlementSubtotalUsd!) + units(invoice.settlementTaxTotalUsd!) !== units(invoice.settlementTotalUsd))) contractFailure();
  let subtotal = BigInt(0);
  for (const line of lines) {
    const quantity = BigInt(line.quantity.replace(".", ""));
    if (line.invoiceId !== invoice.id || quantity < BigInt(1)
      || (quantity * units(line.unitPrice) + BigInt(50)) / BigInt(100) !== units(line.lineTotal)) contractFailure();
    subtotal += units(line.lineTotal);
  }
  if (subtotal !== units(invoice.subtotal)) contractFailure();
  if (isRetainedInvoice(result)) {
    if (invoice.currencyCode !== "USD") contractFailure();
    const bases = result.lines.filter(line => line.sourceKind === "APPLICATION");
    const addons = result.lines.filter(line => line.sourceKind === "ADDON");
    if (!bases.length || bases.length > 100 || addons.length > 100) contractFailure();
    unique(bases.map(line => line.baseItemId)); unique(addons.map(line => line.addonSelectionId));
    const parents = new Map(bases.map(line => [line.baseItemId, line]));
    for (const line of addons) {
      const parent = parents.get(line.baseItemId);
      if (!parent || line.acceptedSeats > parent.acceptedSeats || parents.has(line.addonSelectionId)) contractFailure();
    }
    const billingCycle = result.lines[0].acceptedPricingSnapshot.billingCycle;
    for (const line of result.lines) {
      if (line.unitPrice !== line.lineTotal || line.acceptedPricingSnapshot.recurringAmountUsd !== line.lineTotal) contractFailure();
      verifyAcceptedPricing(line.acceptedPricingSnapshot, line.acceptedSeats, line.sourceKind, billingCycle);
    }
  }
  return result;
}

/** The safe detail omits FX metadata and translations; retain that distinction. */
export function adaptInvoiceCommercial(value: InvoiceCommercial): Invoice {
  return { ...value.invoice, tenant: null, commercial: value,
    fxUnitsPerUsd: null, fxRateRevisionId: null, fxObservedAt: null, settlementLockedAt: null,
    lines: value.lines.map(line => ({ id: line.id, invoiceId: line.invoiceId, description: line.description,
      quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })),
  };
}

export function readInvoiceCommercialSnapshot(response: AxiosResponse<unknown>, invoiceId: string): CoreSnapshot<Invoice> {
  const data = readCommercialResponse(response, value => {
    const parsed = readInvoiceCommercial(value);
    if (parsed.invoice.id !== invoiceId.toLowerCase()) contractFailure();
    return adaptInvoiceCommercial(parsed);
  }, false, INVOICE_DETAIL_MAX_BYTES);
  const envelope = record(response.data); // Already validated, including response metadata.
  return { data, correlationId: text(128)(envelope.correlationId), responseTimestamp: date(envelope.timestamp) };
}
