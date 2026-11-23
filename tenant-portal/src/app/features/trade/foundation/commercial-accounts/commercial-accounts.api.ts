import type { CoreQuery } from '../../../../core/api/core-http';
import {
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../../shared/trade-api';
import type { CommercialAccountRole, Page } from '../../shared/trade-foundation.model';
import { tradeCore, tradeHttp } from '../../shared/trade-http';
import type {
  AccountCountsQuery,
  AccountDetail,
  AccountLookups,
  AccountParty,
  AccountStatusCounts,
  AccountStatusTransitionInput,
  AccountWithParty,
  BranchRule,
  BranchRuleList,
  BranchRuleListItem,
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

interface WireAccountParty {
  id: string;
  displayName: string;
  displayNameAr?: string | null;
  partyType: 'INDIVIDUAL' | 'PERSON' | 'ORGANIZATION';
  code?: string | null;
}

interface WirePriceBookOption {
  id: string;
  companyId?: string;
  code?: string;
  name: string;
  purpose: 'SALES' | 'PURCHASE';
  currencyCode: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface CoreDirectoryPartyRole {
  roleType: string;
  status?: string;
  branchId?: string | null;
}

interface CoreDirectoryParty {
  id: string;
  displayName: string;
  displayNameAr?: string | null;
  partyType: 'PERSON' | 'INDIVIDUAL' | 'ORGANIZATION';
  status?: string;
  branchId?: string | null;
  code?: string | null;
  roles?: readonly CoreDirectoryPartyRole[];
}

function normalizeParty(party: WireAccountParty | null | undefined): AccountParty | null {
  if (!party) return null;
  return {
    id: party.id,
    displayName: party.displayName,
    displayNameAr: party.displayNameAr ?? null,
    partyType: party.partyType === 'ORGANIZATION' ? 'ORGANIZATION' : 'INDIVIDUAL',
    code: party.code ?? null,
  };
}

function normalizeAccount<T extends { party?: WireAccountParty | null }>(
  row: T,
): Omit<T, 'party'> & { party: AccountParty | null } {
  return {
    ...row,
    party: normalizeParty(row.party),
  };
}

function normalizePriceBook(row: WirePriceBookOption, companyId?: string): PriceBookOption {
  return {
    id: row.id,
    companyId: row.companyId ?? companyId ?? '',
    ...(row.code !== undefined ? { code: row.code } : {}),
    name: row.name,
    purpose: row.purpose,
    currencyCode: row.currencyCode,
    status: row.status,
  };
}

function normalizeDirectoryParty(
  item: CoreDirectoryParty,
  requestedRole?: CommercialAccountRole,
): DirectoryParty {
  const rolesSet = new Set<CommercialAccountRole>();
  for (const role of item.roles ?? []) {
    if (role.status !== undefined && role.status !== 'ACTIVE') continue;
    if (role.roleType === 'CUSTOMER' || role.roleType === 'SUPPLIER') {
      rolesSet.add(role.roleType);
    }
  }
  if (rolesSet.size === 0 && requestedRole && item.roles === undefined) {
    rolesSet.add(requestedRole);
  }
  return {
    id: item.id,
    displayName: item.displayName,
    displayNameAr: item.displayNameAr?.trim() || item.displayName,
    partyType: item.partyType === 'ORGANIZATION' ? 'ORGANIZATION' : 'INDIVIDUAL',
    code: item.code ?? null,
    roles: Array.from(rolesSet),
    status: 'ACTIVE',
    branchId: item.branchId ?? null,
  };
}

function buildTransitionPayload(body: AccountStatusTransitionInput): AccountStatusTransitionInput {
  const reasonNote = body.reasonNote?.trim();
  const evidenceRef = body.evidenceRef?.trim();
  return {
    reasonCodeId: body.reasonCodeId,
    ...(reasonNote ? { reasonNote } : {}),
    ...(evidenceRef ? { evidenceRef } : {}),
  };
}

// GET /api/tenant/trade/v1/commercial-accounts?page&limit&accountRole&status&search&sort&direction (OPTIONAL scope)
export async function listAccounts(
  ctx: TradeContext,
  query: ListAccountsQuery = {},
): Promise<Page<AccountWithParty>> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const q: CoreQuery = {};
  if (query.page !== undefined) q['page'] = query.page;
  if (query.limit !== undefined) q['limit'] = query.limit;
  if (query.accountRole !== undefined) q['accountRole'] = query.accountRole;
  if (query.status !== undefined) q['status'] = query.status;
  const search = query.search?.trim();
  if (search) q['search'] = search;
  if (query.sort !== undefined) q['sort'] = query.sort;
  if (query.direction !== undefined) q['direction'] = query.direction;

  const res = await tradeHttp().read<Page<Omit<AccountWithParty, 'party'> & { party?: WireAccountParty | null }>>(
    '/commercial-accounts',
    Object.keys(q).length > 0 ? q : undefined,
    { scope },
  );
  return {
    ...res,
    items: res.items.map((row) => normalizeAccount(row)),
  };
}

// GET /api/tenant/trade/v1/commercial-accounts/status-counts?accountRole&search (OPTIONAL scope)
export function countAccounts(
  ctx: TradeContext,
  query: AccountCountsQuery = {},
): Promise<AccountStatusCounts> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const q: CoreQuery = {};
  if (query.accountRole !== undefined) q['accountRole'] = query.accountRole;
  const search = query.search?.trim();
  if (search) q['search'] = search;

  return tradeHttp().read<AccountStatusCounts>(
    '/commercial-accounts/status-counts',
    Object.keys(q).length > 0 ? q : undefined,
    { scope },
  );
}

// GET /api/tenant/trade/v1/commercial-accounts/:id (OPTIONAL scope)
export async function getAccount(ctx: TradeContext, id: string): Promise<AccountDetail> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const res = await tradeHttp().read<Omit<AccountDetail, 'party'> & { party?: WireAccountParty | null }>(
    `/commercial-accounts/${encodeURIComponent(id)}`,
    undefined,
    { scope },
  );
  return normalizeAccount(res);
}

// POST /api/tenant/trade/v1/commercial-accounts -> 201 (COMPANY scope, x-idempotency-key)
export async function createAccount(
  ctx: TradeContext,
  body: CreateAccountInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AccountWithParty> {
  const scope = scopeFor(ctx, 'COMPANY');
  const payload: CreateAccountInput = {
    partyId: body.partyId,
    accountRole: body.accountRole,
    creditLimit: body.creditLimit ?? null,
    creditCurrencyCode: body.creditCurrencyCode ?? null,
    priceBookId: body.priceBookId ?? null,
    creditPolicyVersionId: body.creditPolicyVersionId ?? null,
    terms: body.terms ? { ...body.terms } : {},
  };
  const { data } = await tradeHttp().write<Omit<AccountWithParty, 'party'> & { party?: WireAccountParty | null }>(
    'POST',
    '/commercial-accounts',
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope,
    },
  );
  return normalizeAccount(data);
}

// PATCH /api/tenant/trade/v1/commercial-accounts/:id -> 200 (COMPANY scope, x-idempotency-key, If-Match)
export async function updateAccount(
  ctx: TradeContext,
  id: string,
  version: number,
  patch: UpdateAccountPatch,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<UpdateAccountResult> {
  const scope = scopeFor(ctx, 'COMPANY');
  const payload: UpdateAccountPatch = {
    ...(patch.creditLimit !== undefined ? { creditLimit: patch.creditLimit } : {}),
    ...(patch.creditCurrencyCode !== undefined ? { creditCurrencyCode: patch.creditCurrencyCode } : {}),
    ...(patch.priceBookId !== undefined ? { priceBookId: patch.priceBookId } : {}),
    ...(patch.creditPolicyVersionId !== undefined ? { creditPolicyVersionId: patch.creditPolicyVersionId } : {}),
    ...(patch.terms !== undefined ? { terms: { ...patch.terms } } : {}),
  };
  const { data } = await tradeHttp().write<Omit<UpdateAccountResult, 'party'> & { party?: WireAccountParty | null }>(
    'PATCH',
    `/commercial-accounts/${encodeURIComponent(id)}`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return normalizeAccount(data);
}

// GET /api/tenant/trade/v1/commercial-accounts/:id/branch-rules -> { items } (OPTIONAL scope)
export async function listBranchRules(ctx: TradeContext, id: string): Promise<BranchRuleListItem[]> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const { items } = await tradeHttp().read<BranchRuleList>(
    `/commercial-accounts/${encodeURIComponent(id)}/branch-rules`,
    undefined,
    { scope },
  );
  return items;
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/branch-rules -> 201 (BRANCH scope, x-idempotency-key)
export async function createBranchRule(
  ctx: TradeContext,
  id: string,
  body: CreateBranchRuleInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<BranchRule> {
  const scope = scopeFor(ctx, 'BRANCH');
  const payload: CreateBranchRuleInput = {
    branchId: body.branchId,
    narrowingRules: { ...body.narrowingRules },
  };
  const { data } = await tradeHttp().write<BranchRule>(
    'POST',
    `/commercial-accounts/${encodeURIComponent(id)}/branch-rules`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope,
    },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/commercial-accounts/:id/branch-rules/:branchId -> 200 (BRANCH scope, x-idempotency-key, If-Match)
export async function updateBranchRule(
  ctx: TradeContext,
  id: string,
  branchId: string,
  ruleVersion: number,
  body: UpdateBranchRuleInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<BranchRule> {
  const scope = scopeFor(ctx, 'BRANCH');
  const payload: UpdateBranchRuleInput = {
    narrowingRules: { ...body.narrowingRules },
    ...(body.status !== undefined ? { status: body.status } : {}),
  };
  const { data } = await tradeHttp().write<BranchRule>(
    'PATCH',
    `/commercial-accounts/${encodeURIComponent(id)}/branch-rules/${encodeURIComponent(branchId)}`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(ruleVersion),
      scope,
    },
  );
  return data;
}

// GET /api/tenant/trade/v1/commercial-accounts/:id/credit-summary?currencyCode= (OPTIONAL scope)
export function getCreditSummary(
  ctx: TradeContext,
  id: string,
  currencyCode?: string,
): Promise<CreditSummary> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const trimmed = currencyCode?.trim();
  return tradeHttp().read<CreditSummary>(
    `/commercial-accounts/${encodeURIComponent(id)}/credit-summary`,
    trimmed ? { currencyCode: trimmed } : undefined,
    { scope },
  );
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/evaluate-credit -> 200 (OPTIONAL scope, x-idempotency-key)
export async function evaluateCredit(
  ctx: TradeContext,
  id: string,
  body: EvaluateCreditInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<CreditDecision> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const payload: EvaluateCreditInput = {
    proposedAmount: body.proposedAmount,
    currencyCode: body.currencyCode,
  };
  const { data } = await tradeHttp().write<CreditDecision>(
    'POST',
    `/commercial-accounts/${encodeURIComponent(id)}/evaluate-credit`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope,
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/block -> 200 (COMPANY scope, x-idempotency-key, If-Match)
export async function blockAccount(
  ctx: TradeContext,
  id: string,
  version: number,
  body: AccountStatusTransitionInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AccountWithParty> {
  const scope = scopeFor(ctx, 'COMPANY');
  const { data } = await tradeHttp().write<Omit<AccountWithParty, 'party'> & { party?: WireAccountParty | null }>(
    'POST',
    `/commercial-accounts/${encodeURIComponent(id)}/block`,
    buildTransitionPayload(body),
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return normalizeAccount(data);
}

// POST /api/tenant/trade/v1/commercial-accounts/:id/unblock -> 200 (COMPANY scope, x-idempotency-key, If-Match)
export async function unblockAccount(
  ctx: TradeContext,
  id: string,
  version: number,
  body: AccountStatusTransitionInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AccountWithParty> {
  const scope = scopeFor(ctx, 'COMPANY');
  const { data } = await tradeHttp().write<Omit<AccountWithParty, 'party'> & { party?: WireAccountParty | null }>(
    'POST',
    `/commercial-accounts/${encodeURIComponent(id)}/unblock`,
    buildTransitionPayload(body),
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return normalizeAccount(data);
}

// GET /api/tenant/trade/v1/commercial-accounts/lookups?role&search&limit -> { creditPolicies, priceBooks } (OPTIONAL scope)
export async function listAccountLookups(
  ctx: TradeContext,
  role?: CommercialAccountRole,
  options: { search?: string; limit?: number } = {},
): Promise<AccountLookups> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const q: CoreQuery = {};
  if (role !== undefined) q['role'] = role;
  const search = options.search?.trim();
  if (search) q['search'] = search;
  if (options.limit !== undefined) q['limit'] = options.limit;

  const res = await tradeHttp().read<{ creditPolicies: CreditPolicy[]; priceBooks: WirePriceBookOption[] }>(
    '/commercial-accounts/lookups',
    Object.keys(q).length > 0 ? q : undefined,
    { scope },
  );
  return {
    creditPolicies: res.creditPolicies ?? [],
    priceBooks: (res.priceBooks ?? []).map((book) => normalizePriceBook(book, ctx.companyId)),
  };
}

// GET /api/tenant/trade/v1/commercial-accounts/lookups -> { creditPolicies } (OPTIONAL scope)
export async function listCreditPolicies(ctx: TradeContext): Promise<CreditPolicy[]> {
  const lookups = await listAccountLookups(ctx);
  return lookups.creditPolicies;
}

// GET /api/tenant/trade/v1/commercial-accounts/lookups?role= -> { priceBooks } (OPTIONAL scope)
export async function listPriceBooks(ctx: TradeContext, role?: CommercialAccountRole): Promise<PriceBookOption[]> {
  const lookups = await listAccountLookups(ctx, role);
  return lookups.priceBooks;
}

// EXTERNAL (Core): GET /api/tenant/core/v1/directory/parties?roleType=&search=&page=&limit=
export async function listParties(
  role?: CommercialAccountRole,
  options: { search?: string; page?: number; limit?: number } = {},
): Promise<DirectoryParty[]> {
  const trimmedSearch = options.search?.trim();
  const rawLimit = options.limit;
  const limit =
    rawLimit !== undefined && Number.isFinite(rawLimit)
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 100;

  if (options.page !== undefined) {
    const query: CoreQuery = {
      status: 'ACTIVE',
      ...(role ? { roleType: role } : {}),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      page: options.page,
      limit,
    };
    const res = await tradeCore().readPage<CoreDirectoryParty>('/api/tenant/core/v1/directory/parties', query);
    return res.data.map((item) => normalizeDirectoryParty(item, role));
  }

  const all: DirectoryParty[] = [];
  for (let page = 1; ; page += 1) {
    const query: CoreQuery = {
      status: 'ACTIVE',
      ...(role ? { roleType: role } : {}),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      page,
      limit,
    };
    const res = await tradeCore().readPage<CoreDirectoryParty>('/api/tenant/core/v1/directory/parties', query);
    all.push(...res.data.map((item) => normalizeDirectoryParty(item, role)));
    if (!res.meta.hasNext || res.data.length === 0) {
      break;
    }
  }
  return all;
}
