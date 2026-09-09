import { readCoreData, readCorePage, readCoreResponse, type CorePath } from "@/lib/api/envelope";
import { INVOICE_READ_RESPONSE_LIMIT_BYTES, parseInvoiceRead, type InvoiceRead } from "./invoice-read";
import { isAccessMode, type AccessMode } from "@/lib/access-mode";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  parseCorePage,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
  type CorePage,
} from "../contracts/core-page";
import {
  BILLING_PAGE_SIZE,
  currencyCode,
  invalidBillingResponse,
  nullableDecimal,
  nullableTimestamp,
  nullableWireEnum,
  requiredDecimal,
  wireEnum,
} from "./billing-validation";

// The tenant billing surface — `TenantBillingController`
// (../backend/mutakamel-apps/core-app/src/tenant/billing/tenant-billing.controller.ts).
//
// `GET /wallet` is deliberately not called from here: `GET /billing/summary`
// already returns the identical `WalletView` that route serves, so calling both
// would be two round trips for one value. The wallet *ledger* is a different
// resource and is read in `wallet-contract.ts`.
//
// Two rules shape every type below, and both are load-bearing:
//
//   1. These routes are owner-only and carry NO permission strings. The gate is
//      `TenantOwnerGuard` reading `tenant_users.is_tenant_owner`.
//   2. Every money value is an exact decimal string and stays one. It is
//      rendered through `Money` and never coerced — `Number()`, `parseFloat`,
//      `+value` and plain arithmetic all lose precision silently.

const BILLING_SUMMARY_PATH = "/api/tenant/core/v1/billing/summary" as const;
const BILLING_INVOICES_PATH = "/api/tenant/core/v1/billing/invoices" as const;

export function invoicePath(invoiceId: string): CorePath {
  if (!isUUIDv7(invoiceId)) invalidBillingResponse();
  return `${BILLING_INVOICES_PATH}/${encodeURIComponent(invoiceId)}`;
}

interface LegacyInvoiceAmounts {
  currencyCode: string;
  subtotal: string;
  taxTotal: string;
  total: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface TenantInvoice {
  id: string;
  number: string;
  status: string;
  purpose: string;
  currencyCode: string;
  /**
   * The invoice is fully expressed in canonical USD. When false every `*Usd`
   * field is null and only `legacyOriginalAmounts` carries figures — a
   * pre-USD-settlement invoice, not a second balance.
   */
  canonicalUsd: boolean;
  subtotalUsd: string | null;
  taxTotalUsd: string | null;
  totalUsd: string | null;
  amountPaidUsd: string | null;
  outstandingUsd: string | null;
  legacyOriginalAmounts: LegacyInvoiceAmounts | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  /** Present only on the detail route; the list projection omits it. */
  lines: InvoiceLine[] | null;
}

const MAX_INVOICE_LINES = 500;

function parseLegacyAmounts(value: unknown): LegacyInvoiceAmounts | null {
  if (value === undefined || value === null) return null;
  const amounts = record(value);
  if (!amounts) invalidBillingResponse();
  return {
    currencyCode: currencyCode(amounts, "currencyCode"),
    subtotal: requiredDecimal(amounts, "subtotal"),
    taxTotal: requiredDecimal(amounts, "taxTotal"),
    total: requiredDecimal(amounts, "total"),
  };
}

export function parseInvoiceLine(value: unknown): InvoiceLine {
  const line = record(value);
  if (!line) invalidBillingResponse();
  // `descriptionI18n` is attached by InvoicesService.withLocalizedLineDescriptions
  // and is absent on any line whose description did not match its module pattern.
  const i18n = record(line.descriptionI18n);
  return {
    id: requiredUuidV7(line, "id"),
    description: requiredText(line, "description", 255),
    descriptionAr: i18n && typeof i18n.ar === "string" ? i18n.ar : null,
    descriptionEn: i18n && typeof i18n.en === "string" ? i18n.en : null,
    quantity: requiredDecimal(line, "quantity"),
    unitPrice: requiredDecimal(line, "unitPrice"),
    lineTotal: requiredDecimal(line, "lineTotal"),
  };
}

function parseInvoiceLines(value: unknown): InvoiceLine[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > MAX_INVOICE_LINES) invalidBillingResponse();
  return value.map(parseInvoiceLine);
}

export function parseTenantInvoice(value: unknown): TenantInvoice {
  const invoice = record(value);
  if (!invoice) invalidBillingResponse();
  return {
    id: requiredUuidV7(invoice, "id"),
    number: requiredText(invoice, "number", 64),
    status: wireEnum(invoice, "status"),
    purpose: wireEnum(invoice, "purpose"),
    currencyCode: currencyCode(invoice, "currencyCode"),
    canonicalUsd: requiredBoolean(invoice, "canonicalUsd"),
    subtotalUsd: nullableDecimal(invoice, "subtotalUsd"),
    taxTotalUsd: nullableDecimal(invoice, "taxTotalUsd"),
    totalUsd: nullableDecimal(invoice, "totalUsd"),
    amountPaidUsd: nullableDecimal(invoice, "amountPaidUsd"),
    outstandingUsd: nullableDecimal(invoice, "outstandingUsd"),
    legacyOriginalAmounts: parseLegacyAmounts(invoice.legacyOriginalAmounts),
    periodStart: nullableTimestamp(invoice, "periodStart"),
    periodEnd: nullableTimestamp(invoice, "periodEnd"),
    issuedAt: nullableTimestamp(invoice, "issuedAt"),
    dueAt: nullableTimestamp(invoice, "dueAt"),
    paidAt: nullableTimestamp(invoice, "paidAt"),
    lines: parseInvoiceLines(invoice.lines),
  };
}

/**
 * **One wallet per tenant, always USD.** `WalletService.toView` hard-codes
 * `BASE_CURRENCY`; a non-USD amount anywhere in this module is a display or
 * collection value backed by FX evidence, never a second balance.
 */
export interface TenantWallet {
  currencyCode: string;
  balanceUsd: string;
  reservedBalanceUsd: string;
  availableBalanceUsd: string;
  status: string;
}

export function parseTenantWallet(value: unknown): TenantWallet {
  const wallet = record(value);
  if (!wallet) invalidBillingResponse();
  return {
    currencyCode: currencyCode(wallet, "currencyCode"),
    balanceUsd: requiredDecimal(wallet, "balanceUsd"),
    reservedBalanceUsd: requiredDecimal(wallet, "reservedBalanceUsd"),
    availableBalanceUsd: requiredDecimal(wallet, "availableBalanceUsd"),
    status: wireEnum(wallet, "status"),
  };
}

export interface BillingSubscriptionSummary {
  id: string;
  status: string;
  billingCycle: string | null;
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string;
  activationScheduledAt: string | null;
  totalPriceUsd: string | null;
  /** Null when the server sent a mode this build does not know — treated as unresolved. */
  accessMode: AccessMode | null;
}

export interface BillingSummary {
  subscription: BillingSubscriptionSummary;
  wallet: TenantWallet;
  outstandingInvoice: TenantInvoice | null;
}

export function parseBillingSummary(payload: unknown): BillingSummary {
  const summary = record(payload);
  if (!summary) invalidBillingResponse();
  const subscription = record(summary.subscription);
  if (!subscription) invalidBillingResponse();
  return {
    subscription: {
      id: requiredUuidV7(subscription, "id"),
      status: wireEnum(subscription, "status"),
      billingCycle: nullableWireEnum(subscription, "billingCycle"),
      startedAt: requiredTimestamp(subscription, "startedAt"),
      trialEndsAt: nullableTimestamp(subscription, "trialEndsAt"),
      currentPeriodStart: nullableTimestamp(subscription, "currentPeriodStart"),
      currentPeriodEnd: requiredTimestamp(subscription, "currentPeriodEnd"),
      activationScheduledAt: nullableTimestamp(subscription, "activationScheduledAt"),
      totalPriceUsd: nullableDecimal(subscription, "totalPriceUsd"),
      accessMode: isAccessMode(subscription.accessMode) ? subscription.accessMode : null,
    },
    wallet: parseTenantWallet(summary.wallet),
    outstandingInvoice:
      summary.outstandingInvoice === null || summary.outstandingInvoice === undefined
        ? null
        : parseTenantInvoice(summary.outstandingInvoice),
  };
}

export async function fetchBillingSummary(signal?: AbortSignal): Promise<BillingSummary> {
  return parseBillingSummary(
    await readCoreData(BILLING_SUMMARY_PATH, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function fetchInvoices(
  page: number,
  signal?: AbortSignal,
): Promise<CorePage<TenantInvoice>> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(BILLING_PAGE_SIZE),
    sortBy: "createdAt",
    sortDir: "DESC",
  });
  const envelope = await readCorePage(BILLING_INVOICES_PATH, query.toString(), {
    signal,
    cache: "no-store",
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseCorePage(envelope, parseTenantInvoice);
}

export async function fetchInvoice(
  invoiceId: string,
  signal?: AbortSignal,
): Promise<InvoiceRead> {
  const response = await readCoreResponse(invoicePath(invoiceId), {
    signal, cache: "no-store", maxResponseBytes: INVOICE_READ_RESPONSE_LIMIT_BYTES,
  });
  // The authenticated host/session is the tenant boundary; /auth/me exposes no tenantId.
  return parseInvoiceRead(response.data, { invoiceId: invoiceId.toLowerCase() });
}
