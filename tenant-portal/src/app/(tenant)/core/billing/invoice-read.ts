import { z } from "zod";
import { acceptedPricingConsistent, acceptedPricingSchema, commercialReadMoney as money, commercialReadUuid as uuid, moneyUnits as units } from "../subscription/subscription-pricing";

// Core admin/invoices/invoice-commercial-read.{contract,openapi}.ts and accepted-invoice-source.ts.
export const INVOICE_READ_RESPONSE_LIMIT_BYTES = 4 * 1024 * 1024;
const timestamp = z.iso.datetime().max(30);
const currency = z.string().regex(/^[A-Z]{3}$/u);
const description = z.string().max(255).refine((value) => value.trim().length > 0);
const header = z.object({
  id: uuid, subscriptionId: uuid, tenantId: uuid, number: description,
  status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]),
  purpose: z.enum(["TRIAL_ACTIVATION", "RENEWAL", "PRORATION", "MANUAL"]),
  currencyCode: currency, subtotal: money, taxTotal: money, total: money, settlementCurrencyCode: currency,
  settlementSubtotalUsd: money.nullable(), settlementTaxTotalUsd: money.nullable(), settlementTotalUsd: money.nullable(), amountPaidUsd: money,
  periodStart: timestamp.nullable(), periodEnd: timestamp.nullable(), issuedAt: timestamp.nullable(), dueAt: timestamp.nullable(), paidAt: timestamp.nullable(),
  createdAt: timestamp, updatedAt: timestamp,
}).strict();
const commonLine = { id: uuid, invoiceId: uuid, description,
  quantity: z.string().regex(/^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/u), unitPrice: money, lineTotal: money };
const retainedFields = { ...commonLine, quantity: z.literal("1.00"),
  baseItemId: uuid, acceptedSeats: z.number().int().min(1).max(100_000), acceptedPricingSnapshot: acceptedPricingSchema };
const retainedLine = z.discriminatedUnion("sourceKind", [
  z.object({ ...retainedFields, sourceKind: z.literal("APPLICATION"), addonSelectionId: z.null(), addonDefinitionVersionId: z.null() }).strict(),
  z.object({ ...retainedFields, sourceKind: z.literal("ADDON"), addonSelectionId: uuid, addonDefinitionVersionId: uuid }).strict(),
]);
const manualLine = z.object({ ...commonLine,
  sourceKind: z.null(), baseItemId: z.null(), addonSelectionId: z.null(), addonDefinitionVersionId: z.null(),
  acceptedSeats: z.null(), acceptedPricingSnapshot: z.null() }).strict();
const view = z.object({ invoice: header,
  lines: z.union([z.array(retainedLine).min(1).max(200), z.array(manualLine).min(1).max(200)]),
}).strict();
const envelope = z.object({ success: z.literal(true), data: view, correlationId: z.string().max(128), timestamp }).strict();
export type InvoiceRead = z.infer<typeof view>;

function consistent(value: InvoiceRead): boolean {
  const { invoice, lines } = value;
  if (new Set(lines.map((line) => line.id)).size !== lines.length
    || units(invoice.subtotal) + units(invoice.taxTotal) !== units(invoice.total)
    || (invoice.periodStart === null) !== (invoice.periodEnd === null)
    || (invoice.periodStart !== null && Date.parse(invoice.periodEnd!) <= Date.parse(invoice.periodStart))) return false;
  const settlement = [invoice.settlementSubtotalUsd, invoice.settlementTaxTotalUsd, invoice.settlementTotalUsd];
  if (settlement.some((amount) => amount === null) && !settlement.every((amount) => amount === null)) return false;
  if (invoice.settlementTotalUsd !== null && (invoice.settlementCurrencyCode !== "USD"
    || units(invoice.settlementSubtotalUsd!) + units(invoice.settlementTaxTotalUsd!) !== units(invoice.settlementTotalUsd))) return false;
  let subtotal = BigInt(0);
  for (const line of lines) {
    const quantity = BigInt(line.quantity.replace(".", ""));
    // invoices.pricing.ts: non-negative half-up rounding, never a second displayed total.
    if (line.invoiceId !== invoice.id || quantity < BigInt(1)
      || (quantity * units(line.unitPrice) + BigInt(50)) / BigInt(100) !== units(line.lineTotal)) return false;
    subtotal += units(line.lineTotal);
  }
  if (subtotal !== units(invoice.subtotal)) return false;
  const accepted = lines.filter((line) => line.sourceKind !== null);
  if (accepted.length !== lines.length) return accepted.length === 0 && invoice.purpose === "MANUAL";
  if (invoice.currencyCode !== "USD") return false;
  const bases = accepted.filter((line) => line.sourceKind === "APPLICATION");
  const addons = accepted.filter((line) => line.sourceKind === "ADDON");
  const parents = new Map(bases.map((line) => [line.baseItemId, line]));
  if (!bases.length || bases.length > 100 || addons.length > 100 || parents.size !== bases.length
    || new Set(addons.map((line) => line.addonSelectionId)).size !== addons.length
    || addons.some((line) => !parents.has(line.baseItemId) || parents.has(line.addonSelectionId)
      || line.acceptedSeats > parents.get(line.baseItemId)!.acceptedSeats)) return false;
  const cycle = accepted[0].acceptedPricingSnapshot.billingCycle;
  return accepted.every((line) => line.unitPrice === line.lineTotal
    && line.acceptedPricingSnapshot.recurringAmountUsd === line.lineTotal && line.acceptedPricingSnapshot.billingCycle === cycle
    && acceptedPricingConsistent(line.acceptedPricingSnapshot, line.acceptedSeats, line.sourceKind === "ADDON"));
}

export function parseInvoiceRead(body: unknown, target: { invoiceId: string; tenantId?: string }): InvoiceRead {
  if (!uuid.safeParse(target.invoiceId).success
    || (target.tenantId !== undefined && !uuid.safeParse(target.tenantId).success)) invalid();
  try {
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > INVOICE_READ_RESPONSE_LIMIT_BYTES) invalid();
    const parsed = envelope.safeParse(body);
    if (!parsed.success || parsed.data.data.invoice.id !== target.invoiceId
      || (target.tenantId !== undefined && parsed.data.data.invoice.tenantId !== target.tenantId)
      || !consistent(parsed.data.data)) invalid();
    return parsed.data.data;
  } catch { return invalid(); }
}
function invalid(): never { throw new Error("The retained invoice response could not be verified."); }
