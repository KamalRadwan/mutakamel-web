import { readCorePage } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { corePost } from "../core-api";
import {
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  parseCorePageMeta,
  record,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
  type CorePageMeta,
} from "../contracts/core-page";
import {
  BILLING_PAGE_SIZE,
  currencyCode,
  invalidBillingResponse,
  nullableDecimal,
  requiredDecimal,
  wireEnum,
} from "./billing-validation";
import { checkoutUrl, parseTenantPayment, type TenantPayment } from "./payment-contract";

// The two immutable histories behind the wallet, and the one write a past-due
// tenant must always be able to make.
//
// `POST /payments/topup` is `@AllowedDuringDunning()` on purpose: paying is
// exactly what a past-due tenant needs to be able to do.

const TENANT_PAYMENTS_PATH = "/api/tenant/core/v1/payments" as const;
const TENANT_TOPUP_PATH = "/api/tenant/core/v1/payments/topup" as const;
const WALLET_LEDGER_PATH = "/api/tenant/core/v1/wallet/ledger" as const;

export interface WalletLedgerEntry {
  id: string;
  direction: string;
  amountUsd: string;
  /** What was actually collected, in the currency it was collected in. */
  sourceAmount: string;
  sourceCurrencyCode: string;
  currencyUnitsPerUsd: string | null;
  balanceAfterUsd: string;
  reason: string;
  actorType: string;
  note: string | null;
  createdAt: string;
}

export function parseWalletLedgerEntry(payload: unknown): WalletLedgerEntry {
  const entry = record(payload);
  if (!entry) invalidBillingResponse();
  const actor = record(entry.actor);
  if (!actor) invalidBillingResponse();
  return {
    id: requiredUuidV7(entry, "id"),
    direction: wireEnum(entry, "direction"),
    amountUsd: requiredDecimal(entry, "amountUsd"),
    sourceAmount: requiredDecimal(entry, "sourceAmount"),
    sourceCurrencyCode: currencyCode(entry, "sourceCurrencyCode"),
    currencyUnitsPerUsd: nullableDecimal(entry, "currencyUnitsPerUsd"),
    balanceAfterUsd: requiredDecimal(entry, "balanceAfterUsd"),
    reason: wireEnum(entry, "reason"),
    actorType: wireEnum(actor, "type"),
    note: entry.note === undefined || entry.note === null ? null : requiredText(entry, "note", 500),
    createdAt: requiredTimestamp(entry, "createdAt"),
  };
}

export interface TopupResult {
  paymentId: string;
  checkoutUrl: string;
  /** True when the Gateway replayed a stored result. It is a success, not a duplicate. */
  replayed: boolean;
}

function mapPage<T>(
  envelope: { data: unknown; meta: unknown },
  parseItem: (value: unknown) => T,
): { items: T[] } & CorePageMeta {
  if (!Array.isArray(envelope.data)) invalidBillingResponse();
  const items = envelope.data.map(parseItem);
  return { items, ...parseCorePageMeta(envelope.meta, items.length) };
}

export async function fetchTenantPayments(
  page: number,
  signal?: AbortSignal,
): Promise<{ items: TenantPayment[] } & CorePageMeta> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(BILLING_PAGE_SIZE),
    sortBy: "createdAt",
    sortDir: "DESC",
  }).toString();
  return mapPage(
    await readCorePage(TENANT_PAYMENTS_PATH, query, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    }),
    parseTenantPayment,
  );
}

export async function fetchWalletLedger(
  page: number,
  signal?: AbortSignal,
): Promise<{ items: WalletLedgerEntry[] } & CorePageMeta> {
  // No `sortBy` here: `getLedger` fixes the sort to `createdAt DESC` itself and
  // `LedgerQueryDto` takes only page, limit and an optional currencyCode.
  const query = new URLSearchParams({
    page: String(page),
    limit: String(BILLING_PAGE_SIZE),
  }).toString();
  return mapPage(
    await readCorePage(WALLET_LEDGER_PATH, query, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    }),
    parseWalletLedgerEntry,
  );
}

/**
 * `POST /payments/topup` — idempotency-required.
 *
 * The result cannot be polled per payment: `GET /billing/payments/:paymentId`
 * requires `purpose === INVOICE_SETTLEMENT` and refuses a top-up outright, so
 * the readback is the payments list. See
 * docs/build/OPEN-QUESTIONS.md#q26--a-wallet-top-ups-status-cannot-be-read-back.
 */
export async function createWalletTopup(
  amount: string,
  code: string,
  idempotencyKey: string,
): Promise<TopupResult> {
  const result = await corePost(
    TENANT_TOPUP_PATH,
    { amount, currencyCode: code },
    {
      headers: { "x-idempotency-key": idempotencyKey },
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    },
  );
  const topup = record(result.data);
  if (!topup) invalidBillingResponse();
  const url = checkoutUrl(topup);
  if (!url) invalidBillingResponse();
  return {
    paymentId: requiredUuidV7(topup, "paymentId"),
    checkoutUrl: url,
    replayed: isIdempotentReplay(result.headers),
  };
}
