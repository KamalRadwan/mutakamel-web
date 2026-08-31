import type { TradePath } from "@/lib/api/envelope";
import {
  isJsonObject,
  isNullableTradeDecimalString,
  isNullableUuidV7,
  isRowVersion,
  isTimestamp,
  isTradeDecimalString,
  isUuidV7,
  parseTradePage,
  record,
  type TradePage,
} from "../trade-validation";

// docs/api/trade-foundation.md#commercial-accounts--10-routes, verified against
// trade-app/src/modules/commercial-accounts/*.ts and
// packages/database/src/entities/tenant/foundation.entities.ts.
//
// Feature gate: `@RequireAnyTradeFeature(trade.sales, trade.purchasing)` — the
// tenant needs EITHER, unlike every other route on the foundation pages, which
// need `trade.catalog`.

export const ACCOUNTS_PATH = "/api/tenant/trade/v1/commercial-accounts";
export const ACCOUNT_PAGE_SIZE = 25;

/** `^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$` — 16 integer digits, 8 decimals. */
const ACCOUNT_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;

export const ACCOUNT_ROLES = ["CUSTOMER", "SUPPLIER"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/**
 * Account status has **no enum**. `block` writes the literal `"BLOCKED"` and
 * `unblock` writes `"ACTIVE"`; the list filter accepts any string ≤ 32. Two
 * states are proven, a third cannot be ruled out — Q31.
 */
export const ACCOUNT_KNOWN_STATUSES = ["ACTIVE", "BLOCKED"] as const;

export const ACCOUNT_NOT_FOUND_CODE = "TRADE.ACCOUNT.NOT_FOUND";
export const ACCOUNT_ALREADY_EXISTS_CODE = "TRADE.ACCOUNT.ALREADY_EXISTS";
export const ACCOUNT_PARTY_ROLE_INVALID_CODE = "TRADE.ACCOUNT.PARTY_ROLE_INVALID";
export const ACCOUNT_TERM_INVALID_CODE = "TRADE.ACCOUNT.TERM_INVALID";
export const ACCOUNT_CREDIT_LIMIT_INVALID_CODE = "TRADE.ACCOUNT.CREDIT_LIMIT_INVALID";
export const ACCOUNT_BLOCK_TRANSITION_INVALID_CODE = "TRADE.ACCOUNT.BLOCK_TRANSITION_INVALID";
export const BRANCH_RULE_EXISTS_CODE = "TRADE.ACCOUNT.BRANCH_RULE_ALREADY_EXISTS";
export const BRANCH_RULE_NOT_FOUND_CODE = "TRADE.ACCOUNT.BRANCH_RULE_NOT_FOUND";
export const BRANCH_RULE_WEAKENS_CODE = "TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY";
/** **503**, not a 409: the evaluation could not be made, it was not refused. */
export const CREDIT_EXPOSURE_UNAVAILABLE_CODE = "TRADE.CREDIT.EXPOSURE_UNAVAILABLE";

export interface CommercialAccount {
  id: string;
  partyId: string;
  companyId: string;
  accountRole: string;
  paymentTermsId: string | null;
  /** `numeric(24,8)` — an exact decimal string. Never `Number()` it. */
  creditLimit: string | null;
  creditCurrencyCode: string | null;
  priceBookId: string | null;
  creditPolicyVersionId: string | null;
  terms: Record<string, unknown>;
  status: string;
  blockReasonCode: string | null;
  version: number;
  updatedAt: string;
}

export interface AccountBranchRule {
  id: string;
  branchId: string;
  narrowingRules: Record<string, unknown>;
  status: string;
  version: number;
}

export interface AccountFormValues {
  partyId: string;
  accountRole: AccountRole;
  paymentTermsId: string;
  creditLimit: string;
  creditCurrencyCode: string;
  priceBookId: string;
  creditPolicyVersionId: string;
  terms: string;
}

export const EMPTY_ACCOUNT_FORM: AccountFormValues = {
  partyId: "",
  accountRole: "CUSTOMER",
  paymentTermsId: "",
  creditLimit: "",
  creditCurrencyCode: "",
  priceBookId: "",
  creditPolicyVersionId: "",
  terms: "",
};

export function toAccountForm(account: CommercialAccount): AccountFormValues {
  return {
    partyId: account.partyId,
    accountRole: isAccountRole(account.accountRole) ? account.accountRole : "CUSTOMER",
    paymentTermsId: account.paymentTermsId ?? "",
    // Kept as the exact string the server sent. `fixedDecimalText` strips
    // trailing zeros, so `10.50` arrives as `"10.5"` — never re-pad it, and
    // never compare it to a locally formatted value.
    creditLimit: account.creditLimit ?? "",
    creditCurrencyCode: account.creditCurrencyCode ?? "",
    priceBookId: account.priceBookId ?? "",
    creditPolicyVersionId: account.creditPolicyVersionId ?? "",
    terms: Object.keys(account.terms).length ? JSON.stringify(account.terms, null, 2) : "",
  };
}

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && (ACCOUNT_ROLES as readonly string[]).includes(value);
}

export function accountPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${ACCOUNTS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function accountBranchRulesPath(id: string): TradePath {
  return `${accountPath(id)}/branch-rules` as TradePath;
}

export function accountBranchRulePath(id: string, branchId: string): TradePath {
  if (!isUuidV7(branchId)) invalidResponse();
  return `${accountBranchRulesPath(id)}/${encodeURIComponent(branchId)}` as TradePath;
}

export function accountCreditPath(id: string): TradePath {
  return `${accountPath(id)}/evaluate-credit` as TradePath;
}

export function accountTransitionPath(id: string, target: "block" | "unblock"): TradePath {
  return `${accountPath(id)}/${target}` as TradePath;
}

export function accountsListPath(page: number, role?: AccountRole, status?: string): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(ACCOUNT_PAGE_SIZE) });
  if (role) query.set("accountRole", role);
  if (status) query.set("status", status);
  return `${ACCOUNTS_PATH}?${query.toString()}` as TradePath;
}

function optionalUuid(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (!isUuidV7(trimmed)) throw new Error("ACCOUNT_FORM_PARTY");
  return trimmed;
}

function optionalCredit(values: AccountFormValues) {
  const limit = values.creditLimit.trim();
  const currency = values.creditCurrencyCode.trim().toUpperCase();
  if (limit && !ACCOUNT_DECIMAL_PATTERN.test(limit)) throw new Error("ACCOUNT_FORM_CREDIT");
  if (currency && !CURRENCY_PATTERN.test(currency)) throw new Error("ACCOUNT_FORM_CURRENCY");
  return {
    ...(limit ? { creditLimit: limit } : {}),
    ...(currency ? { creditCurrencyCode: currency } : {}),
  };
}

function optionalTerms(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = record(JSON.parse(trimmed) as unknown);
    if (!parsed) throw new Error("ACCOUNT_FORM_TERMS");
    return parsed;
  } catch {
    throw new Error("ACCOUNT_FORM_TERMS");
  }
}

/** `CreateCommercialAccountDto`. `partyId` and `accountRole` are required. */
export function buildCreateAccountRequest(values: AccountFormValues) {
  const partyId = values.partyId.trim();
  if (!isUuidV7(partyId)) throw new Error("ACCOUNT_FORM_PARTY");
  const terms = optionalTerms(values.terms);
  return {
    partyId,
    accountRole: values.accountRole,
    ...optionalCredit(values),
    ...(optionalUuid(values.paymentTermsId) ? { paymentTermsId: values.paymentTermsId.trim() } : {}),
    ...(optionalUuid(values.priceBookId) ? { priceBookId: values.priceBookId.trim() } : {}),
    ...(optionalUuid(values.creditPolicyVersionId)
      ? { creditPolicyVersionId: values.creditPolicyVersionId.trim() }
      : {}),
    ...(terms ? { terms } : {}),
  };
}

/**
 * `UpdateCommercialAccountDto` — the same minus `partyId` and `accountRole`.
 *
 * `terms` has **no default here**, unlike on create, so omitting it leaves the
 * stored value alone rather than clearing it to `{}`.
 */
export function buildUpdateAccountRequest(values: AccountFormValues) {
  const terms = optionalTerms(values.terms);
  return {
    ...optionalCredit(values),
    ...(optionalUuid(values.paymentTermsId) ? { paymentTermsId: values.paymentTermsId.trim() } : {}),
    ...(optionalUuid(values.priceBookId) ? { priceBookId: values.priceBookId.trim() } : {}),
    ...(optionalUuid(values.creditPolicyVersionId)
      ? { creditPolicyVersionId: values.creditPolicyVersionId.trim() }
      : {}),
    ...(terms ? { terms } : {}),
  };
}

export function buildCreditRequest(amount: string, currencyCode: string) {
  const proposedAmount = amount.trim();
  const currency = currencyCode.trim().toUpperCase();
  if (!ACCOUNT_DECIMAL_PATTERN.test(proposedAmount)) throw new Error("CREDIT_FORM_AMOUNT");
  if (!CURRENCY_PATTERN.test(currency)) throw new Error("ACCOUNT_FORM_CURRENCY");
  return { proposedAmount, currencyCode: currency };
}

export function parseAccountResponse(payload: unknown): CommercialAccount {
  const account = record(payload);
  if (
    !account ||
    !isUuidV7(account.id) ||
    !isUuidV7(account.partyId) ||
    !isUuidV7(account.companyId) ||
    typeof account.accountRole !== "string" ||
    !isNullableUuidV7(account.paymentTermsId) ||
    !isNullableTradeDecimalString(account.creditLimit) ||
    !isNullableUuidV7(account.priceBookId) ||
    !isNullableUuidV7(account.creditPolicyVersionId) ||
    !isJsonObject(account.terms) ||
    typeof account.status !== "string" ||
    !isRowVersion(account.version) ||
    !isTimestamp(account.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: account.id,
    partyId: account.partyId,
    companyId: account.companyId,
    accountRole: account.accountRole,
    paymentTermsId: (account.paymentTermsId as string | null | undefined) ?? null,
    creditLimit: (account.creditLimit as string | null | undefined) ?? null,
    creditCurrencyCode:
      typeof account.creditCurrencyCode === "string" ? account.creditCurrencyCode : null,
    priceBookId: (account.priceBookId as string | null | undefined) ?? null,
    creditPolicyVersionId: (account.creditPolicyVersionId as string | null | undefined) ?? null,
    terms: account.terms,
    status: account.status,
    blockReasonCode: typeof account.blockReasonCode === "string" ? account.blockReasonCode : null,
    version: account.version,
    updatedAt: account.updatedAt,
  };
}

export function parseAccountsResponse(payload: unknown): TradePage<CommercialAccount> {
  return parseTradePage(payload, parseAccountResponse, invalidResponse);
}

export function parseBranchRuleResponse(payload: unknown): AccountBranchRule {
  const rule = record(payload);
  if (
    !rule ||
    !isUuidV7(rule.id) ||
    !isUuidV7(rule.branchId) ||
    !isJsonObject(rule.narrowingRules) ||
    typeof rule.status !== "string" ||
    !isRowVersion(rule.version)
  ) {
    invalidResponse();
  }
  return {
    id: rule.id,
    branchId: rule.branchId,
    narrowingRules: rule.narrowingRules,
    status: rule.status,
    version: rule.version,
  };
}

export interface CreditDecision {
  receiptId: string;
  outcome: string;
  reasonCode: string;
  effectiveLimit: string | null;
  exposureAmount: string | null;
  proposedAmount: string;
  remainingAmount: string | null;
  currencyCode: string;
  orderingHold: boolean;
  asOf: string | null;
  explanation: string;
}

/**
 * `evaluate-credit` returns the **decision receipt entity**, not the decision.
 *
 * `CommercialAccountsService.evaluateCreditInTransaction` saves a
 * `TradeDecisionReceiptEntity` and returns it, with the decision under
 * `result`. The contract page documents the route but not this shape, so it
 * was read from source. Every money field inside `result` is a decimal string.
 */
export function parseCreditDecision(payload: unknown): CreditDecision {
  const receipt = record(payload);
  const result = record(receipt?.result);
  if (
    !receipt ||
    !result ||
    !isUuidV7(receipt.id) ||
    typeof receipt.explanation !== "string" ||
    typeof result.outcome !== "string" ||
    typeof result.reasonCode !== "string" ||
    typeof result.currencyCode !== "string" ||
    typeof result.orderingHold !== "boolean" ||
    !isTradeDecimalString(result.proposedAmount) ||
    !isNullableTradeDecimalString(result.effectiveLimit) ||
    !isNullableTradeDecimalString(result.exposureAmount) ||
    !isNullableTradeDecimalString(result.remainingAmount)
  ) {
    invalidResponse();
  }
  return {
    receiptId: receipt.id,
    outcome: result.outcome,
    reasonCode: result.reasonCode,
    effectiveLimit: (result.effectiveLimit as string | null | undefined) ?? null,
    exposureAmount: (result.exposureAmount as string | null | undefined) ?? null,
    proposedAmount: result.proposedAmount,
    remainingAmount: (result.remainingAmount as string | null | undefined) ?? null,
    currencyCode: result.currencyCode,
    orderingHold: result.orderingHold,
    asOf: typeof result.asOf === "string" ? result.asOf : null,
    explanation: receipt.explanation,
  };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade commercial account response.");
}
