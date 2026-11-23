import type { CoreQuery } from '../../../../core/api/core-http';
import type { ScopeState } from '../../../../core/scope/scope';
import {
  ApiError,
  TRADE_API_BASE,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  tradeContext,
  type TradeContext,
} from '../trade-api';
import { tradeHttp } from '../trade-http';
import type {
  CountTermsQuery,
  ListTermsQuery,
  TermCounts,
  TermDocumentType,
  TermInput,
  TermOptions,
  TermPage,
  TermPatch,
  TradeTerm,
} from './terms.model';
import { TERM_LIST_LIMITS } from './terms.model';

export const TERMS_API_BASE = `${TRADE_API_BASE}/terms`;

const KNOWN_TERM_ERROR_KEYS: ReadonlySet<string> = new Set([
  'TRADE_VALIDATION_FAILED',
  'TRADE_CONCURRENCY_STALE_VERSION',
  'TRADE_CONCURRENCY_IF_MATCH_REQUIRED',
  'TRADE_IDEMPOTENCY_IN_FLIGHT',
  'TRADE_AUTH_TARGET_DENIED',
  'TRADE_IDEMPOTENCY_KEY_MISSING',
  'TRADE_IDEMPOTENCY_KEY_REQUIRED',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_CONTEXT_MISSING_COMPANY',
  'TRADE_SCOPE_REQUIRED',
  'TRADE_TERMS_NOT_FOUND',
  'TRADE_TERMS_CODE_TAKEN',
  'TRADE_TERMS_TEXT_REQUIRED',
  'TRADE_TERMS_TYPE_FIELD_INVALID',
  'TRADE_TERMS_DEFAULT_INACTIVE',
  'TRADE_TERMS_DEFAULT_IN_USE',
  'TRADE_TERMS_PAYMENT_REQUIRED',
]);

function toContext(ctxOrScope?: TradeContext | ScopeState): TradeContext {
  if (!ctxOrScope) return {};
  if ('company' in ctxOrScope) {
    const company = ctxOrScope.company();
    if (!company?.id) return {};
    return company.branches?.length ? tradeContext(ctxOrScope, 'BRANCH') : tradeContext(ctxOrScope, 'COMPANY');
  }
  return ctxOrScope;
}

function buildListTermsQuery(q: ListTermsQuery): CoreQuery | undefined {
  const query: CoreQuery = {};
  if (q.type !== undefined) query['type'] = q.type;
  if (q.side !== undefined) query['side'] = q.side;
  if (q.active !== undefined) query['active'] = q.active;
  if (q.search !== undefined && q.search !== '') query['search'] = q.search;
  if (q.page !== undefined) query['page'] = q.page;
  if (q.limit !== undefined) query['limit'] = q.limit;
  return Object.keys(query).length > 0 ? query : undefined;
}

// GET /api/tenant/trade/v1/terms?type&side&active&search&page&limit (+ OPTIONAL scope)
// Returns { items, total, page, limit }; limit defaults to 25, max 100.
export async function listTerms(
  q: ListTermsQuery = {},
  ctx?: TradeContext | ScopeState,
): Promise<TermPage> {
  const scope = scopeFor(toContext(ctx), 'OPTIONAL');
  return tradeHttp().read<TermPage>('/terms', buildListTermsQuery(q), { scope });
}

/** Reads every page (limit 100) for screens that show the whole catalogue of one type. */
export async function listAllTerms(
  q: Omit<ListTermsQuery, 'page' | 'limit'> = {},
  ctx?: TradeContext | ScopeState,
): Promise<TradeTerm[]> {
  const limit = TERM_LIST_LIMITS.maxLimit;
  const items: TradeTerm[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listTerms({ ...q, page, limit }, ctx);
    items.push(...result.items);
    if (result.items.length < limit || items.length >= result.total) return items;
  }
}

// GET /api/tenant/trade/v1/terms/counts?active (+ OPTIONAL scope)
// Returns { total, byType }.
export async function countTerms(
  q: CountTermsQuery = {},
  ctx?: TradeContext | ScopeState,
): Promise<TermCounts> {
  const scope = scopeFor(toContext(ctx), 'OPTIONAL');
  const query: CoreQuery | undefined = q.active !== undefined ? { active: q.active } : undefined;
  return tradeHttp().read<TermCounts>('/terms/counts', query, { scope });
}

// GET /api/tenant/trade/v1/terms/:id (+ OPTIONAL scope)
export async function getTerm(id: string, ctx?: TradeContext | ScopeState): Promise<TradeTerm> {
  const scope = scopeFor(toContext(ctx), 'OPTIONAL');
  return tradeHttp().read<TradeTerm>(`/terms/${encodeURIComponent(id)}`, undefined, { scope });
}

// POST /api/tenant/trade/v1/terms (x-idempotency-key, + x-mutakamel-company-id)
export async function createTerm(
  input: TermInput,
  idempotencyKey: string = newIdempotencyKey(),
  ctx?: TradeContext | ScopeState,
): Promise<TradeTerm> {
  const scope = scopeFor(toContext(ctx), 'COMPANY');
  const { data } = await tradeHttp().write<TradeTerm>('POST', '/terms', input, {
    key: idempotencyKey,
    scope,
  });
  return data;
}

// PATCH /api/tenant/trade/v1/terms/:id (x-idempotency-key, If-Match, + x-mutakamel-company-id)
// Pass the same key when retrying one user action, so the backend replays it.
export async function updateTerm(
  id: string,
  version: number,
  patch: TermPatch,
  ctx?: TradeContext | ScopeState,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TradeTerm> {
  const scope = scopeFor(toContext(ctx), 'COMPANY');
  const { data } = await tradeHttp().write<TradeTerm>('PATCH', `/terms/${encodeURIComponent(id)}`, patch, {
    key: idempotencyKey,
    ifMatch: ifMatch(version),
    scope,
  });
  return data;
}

// POST /api/tenant/trade/v1/terms/:id/make-default (x-idempotency-key, If-Match, + x-mutakamel-company-id) -> 200
export async function makeDefaultTerm(
  id: string,
  version: number,
  ctx?: TradeContext | ScopeState,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TradeTerm> {
  const scope = scopeFor(toContext(ctx), 'COMPANY');
  const { data } = await tradeHttp().write<TradeTerm>(
    'POST',
    `/terms/${encodeURIComponent(id)}/make-default`,
    undefined,
    {
      key: idempotencyKey,
      ifMatch: ifMatch(version),
      scope,
    },
  );
  return data;
}

// DELETE /api/tenant/trade/v1/terms/:id (x-idempotency-key, If-Match, + x-mutakamel-company-id)
export async function deleteTerm(
  id: string,
  version: number,
  ctx?: TradeContext | ScopeState,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TradeTerm> {
  const scope = scopeFor(toContext(ctx), 'COMPANY');
  const { data } = await tradeHttp().write<TradeTerm>('DELETE', `/terms/${encodeURIComponent(id)}`, undefined, {
    key: idempotencyKey,
    ifMatch: ifMatch(version),
    scope,
  });
  return data;
}

// GET /api/tenant/trade/v1/terms/options?documentType= (+ OPTIONAL scope)
export async function listTermOptions(
  documentType: TermDocumentType,
  ctx?: TradeContext | ScopeState,
): Promise<TermOptions> {
  const scope = scopeFor(toContext(ctx), 'OPTIONAL');
  return tradeHttp().read<TermOptions>('/terms/options', { documentType }, { scope });
}

export function termErrorKey(e: unknown): string {
  if (!(e instanceof ApiError)) {
    return 'tset.errors.generic';
  }
  const normalized = e.code.replaceAll('.', '_');
  if (KNOWN_TERM_ERROR_KEYS.has(normalized)) {
    return `tset.errors.${normalized}`;
  }
  return 'tset.errors.generic';
}
