import { contextHeaders, ifMatch, type TradeContext } from '../../shared/trade-api';
import type { CommercialAccountRole, Page } from '../../shared/trade-foundation.model';
import {
  fakeBlockAccount,
  fakeCountAccounts,
  fakeCreateAccount,
  fakeCreateBranchRule,
  fakeEvaluateCredit,
  fakeGetAccount,
  fakeGetCreditSummary,
  fakeListAccountLookups,
  fakeListAccounts,
  fakeListBranchRules,
  fakeListCreditPolicies,
  fakeListParties,
  fakeListPriceBooks,
  fakeUnblockAccount,
  fakeUpdateAccount,
  fakeUpdateBranchRule,
} from './commercial-accounts.fake';
import type {
  AccountCountsQuery,
  AccountDetail,
  AccountLookups,
  AccountStatusCounts,
  AccountStatusTransitionInput,
  AccountWithParty,
  BranchRule,
  CreateAccountInput,
  CreateBranchRuleInput,
  CreditDecision,
  CreditPolicy,
  CreditSummary,
  DirectoryParty,
  EvaluateCreditInput,
  ListAccountsQuery,
  PriceBookOption,
  UpdateAccountPatch,
  UpdateAccountResult,
  UpdateBranchRuleInput,
} from './commercial-accounts.model';

let partiesCachePromise: Promise<DirectoryParty[]> | null = null;

function companyHeaders(ctx: TradeContext): Record<string, string> {
  return contextHeaders({ companyId: ctx.companyId });
}

function branchHeaders(ctx: TradeContext): Record<string, string> {
  return contextHeaders(ctx);
}

// GET /api/tenant/trade/v1/commercial-accounts?page&limit&accountRole&status&search&sort&direction (headers: company, branch)
export async function listAccounts(
  ctx: TradeContext,
  query: ListAccountsQuery = {},
): Promise<Page<AccountWithParty>> {
  return fakeListAccounts(branchHeaders(ctx), query);
}

// GET /api/tenant/trade/v1/commercial-accounts/status-counts?accountRole&search (headers: company, branch)
export async function countAccounts(
  ctx: TradeContext,
  query: AccountCountsQuery = {},
): Promise<AccountStatusCounts> {
  return fakeCountAccounts(branchHeaders(ctx), query);
}

// GET /api/tenant/trade/v1/commercial-accounts/:id (headers: company, branch)
export async function getAccount(ctx: TradeContext, id: string): Promise<AccountDetail> {
  return fakeGetAccount(branchHeaders(ctx), id);
}

// POST /api/tenant/trade/v1/commercial-accounts -> 201 (headers: company, x-idempotency-key)
export async function createAccount(
  ctx: TradeContext,
  body: CreateAccountInput,
  idempotencyKey: string,
): Promise<AccountWithParty> {
  const headers: Record<string, string> = {
    ...companyHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
  };
  return fakeCreateAccount(headers, body);
}

// PATCH /api/tenant/trade/v1/commercial-accounts/:id -> 200 (headers: company, x-idempotency-key, If-Match)
export async function updateAccount(
  ctx: TradeContext,
  id: string,
  version: number,
  patch: UpdateAccountPatch,
  idempotencyKey: string,
): Promise<UpdateAccountResult> {
  const headers: Record<string, string> = {
    ...companyHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
    'If-Match': ifMatch(version),
  };
  return fakeUpdateAccount(headers, id, patch);
}

// GET /api/tenant/trade/v1/commercial-accounts/:id/branch-rules -> { items } (headers: company, branch); the page reads the rules
export async function listBranchRules(ctx: TradeContext, id: string): Promise<BranchRule[]> {
  const { items } = await fakeListBranchRules(branchHeaders(ctx), id);
  return items;
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/branch-rules -> 201 (headers: company, branch, x-idempotency-key)
export async function createBranchRule(
  ctx: TradeContext,
  id: string,
  body: CreateBranchRuleInput,
  idempotencyKey: string,
): Promise<BranchRule> {
  const headers: Record<string, string> = {
    ...branchHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
  };
  return fakeCreateBranchRule(headers, id, body);
}

// PATCH /api/tenant/trade/v1/commercial-accounts/:id/branch-rules/:branchId -> 200 (headers: company, branch, x-idempotency-key, If-Match)
export async function updateBranchRule(
  ctx: TradeContext,
  id: string,
  branchId: string,
  ruleVersion: number,
  body: UpdateBranchRuleInput,
  idempotencyKey: string,
): Promise<BranchRule> {
  const headers: Record<string, string> = {
    ...branchHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
    'If-Match': ifMatch(ruleVersion),
  };
  return fakeUpdateBranchRule(headers, id, branchId, body);
}

// GET /api/tenant/trade/v1/commercial-accounts/:id/credit-summary?currencyCode= (headers: company, branch)
export async function getCreditSummary(
  ctx: TradeContext,
  id: string,
  currencyCode: string,
): Promise<CreditSummary> {
  return fakeGetCreditSummary(branchHeaders(ctx), id, currencyCode);
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/evaluate-credit -> 200 (headers: company, branch, x-idempotency-key)
export async function evaluateCredit(
  ctx: TradeContext,
  id: string,
  body: EvaluateCreditInput,
  idempotencyKey: string,
): Promise<CreditDecision> {
  const headers: Record<string, string> = {
    ...branchHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
  };
  return fakeEvaluateCredit(headers, id, body);
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/block -> 200 (headers: company, x-idempotency-key, If-Match)
export async function blockAccount(
  ctx: TradeContext,
  id: string,
  version: number,
  body: AccountStatusTransitionInput,
  idempotencyKey: string,
): Promise<AccountWithParty> {
  const headers: Record<string, string> = {
    ...companyHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
    'If-Match': ifMatch(version),
  };
  return fakeBlockAccount(headers, id, body);
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/unblock -> 200 (headers: company, x-idempotency-key, If-Match)
export async function unblockAccount(
  ctx: TradeContext,
  id: string,
  version: number,
  body: AccountStatusTransitionInput,
  idempotencyKey: string,
): Promise<AccountWithParty> {
  const headers: Record<string, string> = {
    ...companyHeaders(ctx),
    'x-idempotency-key': idempotencyKey,
    'If-Match': ifMatch(version),
  };
  return fakeUnblockAccount(headers, id, body);
}

// GET /api/tenant/trade/v1/commercial-accounts/lookups?role= -> { creditPolicies, priceBooks } (headers: company, branch)
export async function listAccountLookups(
  ctx: TradeContext,
  role?: CommercialAccountRole,
): Promise<AccountLookups> {
  return fakeListAccountLookups(branchHeaders(ctx), role);
}

// GET /api/tenant/trade/v1/commercial-accounts/lookups -> { creditPolicies } (headers: company, branch)
export async function listCreditPolicies(ctx: TradeContext): Promise<CreditPolicy[]> {
  return fakeListCreditPolicies(branchHeaders(ctx));
}

// GET /api/tenant/trade/v1/commercial-accounts/lookups?role= -> { priceBooks } (headers: company, branch)
export async function listPriceBooks(ctx: TradeContext, role?: CommercialAccountRole): Promise<PriceBookOption[]> {
  return fakeListPriceBooks(branchHeaders(ctx), role);
}

// GET /api/tenant/core/v1/directory/parties?roleType=&status=ACTIVE
export async function listParties(role?: CommercialAccountRole): Promise<DirectoryParty[]> {
  if (!partiesCachePromise) {
    partiesCachePromise = fakeListParties().catch((err) => {
      partiesCachePromise = null;
      throw err;
    });
  }
  const all = await partiesCachePromise;
  return role ? all.filter((party) => party.roles.includes(role)) : all;
}
