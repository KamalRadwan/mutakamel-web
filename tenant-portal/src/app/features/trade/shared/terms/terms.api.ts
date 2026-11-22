import type { ScopeState } from '../../../../core/scope/scope';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { ApiError, TRADE_API_BASE, ifMatch, newIdempotencyKey, tradeContext, type TradeContext } from '../trade-api';
import {
  fakeCountTerms,
  fakeCreateTerm,
  fakeDeleteTerm,
  fakeGetTerm,
  fakeListTermOptions,
  fakeListTerms,
  fakeMakeDefaultTerm,
  fakeUpdateTerm,
} from './terms.fake';
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
  'TRADE_IDEMPOTENCY_KEY_REQUIRED',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_TERMS_NOT_FOUND',
  'TRADE_TERMS_CODE_TAKEN',
  'TRADE_TERMS_TEXT_REQUIRED',
  'TRADE_TERMS_TYPE_FIELD_INVALID',
  'TRADE_TERMS_DEFAULT_INACTIVE',
  'TRADE_TERMS_DEFAULT_IN_USE',
  'TRADE_TERMS_PAYMENT_REQUIRED',
]);

function readStoredCompanyId(): string {
  const fromStorage = (storage: Storage | undefined): string | null => {
    try {
      const raw = storage?.getItem('scope');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { companyId?: unknown };
      if (typeof parsed?.companyId === 'string' && FAKE_COMPANIES.some((c) => c.id === parsed.companyId)) {
        return parsed.companyId;
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    fromStorage(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined) ??
    fromStorage(typeof localStorage !== 'undefined' ? localStorage : undefined) ??
    FAKE_COMPANIES[0].id
  );
}

function resolveCompanyId(ctxOrScope?: TradeContext | ScopeState): string {
  if (ctxOrScope && 'company' in ctxOrScope && typeof ctxOrScope.company === 'function') {
    return tradeContext(ctxOrScope, 'COMPANY').companyId ?? FAKE_COMPANIES[0].id;
  }
  const directCompanyId = (ctxOrScope as { companyId?: string | null } | undefined)?.companyId;
  if (directCompanyId) {
    return directCompanyId;
  }
  return readStoredCompanyId();
}

// GET /api/tenant/trade/v1/terms?type&side&active&search&page&limit (+ x-mutakamel-company-id)
// Returns { items, total, page, limit }; limit defaults to 25, max 100.
export async function listTerms(
  q: ListTermsQuery = {},
  ctx?: TradeContext | ScopeState,
): Promise<TermPage> {
  return fakeListTerms(resolveCompanyId(ctx), q);
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

// GET /api/tenant/trade/v1/terms/counts?active (ONE request, + x-mutakamel-company-id)
// Returns { total, byType }.
export async function countTerms(
  q: CountTermsQuery = {},
  ctx?: TradeContext | ScopeState,
): Promise<TermCounts> {
  return fakeCountTerms(resolveCompanyId(ctx), q);
}

// GET /api/tenant/trade/v1/terms/:id (+ x-mutakamel-company-id)
export async function getTerm(id: string, ctx?: TradeContext | ScopeState): Promise<TradeTerm> {
  return fakeGetTerm(resolveCompanyId(ctx), id);
}

// POST /api/tenant/trade/v1/terms (x-idempotency-key, + x-mutakamel-company-id)
export async function createTerm(
  input: TermInput,
  idempotencyKey: string,
  ctx?: TradeContext | ScopeState,
): Promise<TradeTerm> {
  return fakeCreateTerm(resolveCompanyId(ctx), input, idempotencyKey);
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
  return fakeUpdateTerm(resolveCompanyId(ctx), id, ifMatch(version), patch, idempotencyKey);
}

// POST /api/tenant/trade/v1/terms/:id/make-default (x-idempotency-key, If-Match, + x-mutakamel-company-id) -> 200
export async function makeDefaultTerm(
  id: string,
  version: number,
  ctx?: TradeContext | ScopeState,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TradeTerm> {
  return fakeMakeDefaultTerm(resolveCompanyId(ctx), id, ifMatch(version), idempotencyKey);
}

// DELETE /api/tenant/trade/v1/terms/:id (x-idempotency-key, If-Match, + x-mutakamel-company-id)
// Returns 200 with the soft-deleted term.
export async function deleteTerm(
  id: string,
  version: number,
  ctx?: TradeContext | ScopeState,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TradeTerm> {
  return fakeDeleteTerm(resolveCompanyId(ctx), id, ifMatch(version), idempotencyKey);
}

// GET /api/tenant/trade/v1/terms/options?documentType= (+ x-mutakamel-company-id)
export async function listTermOptions(
  documentType: TermDocumentType,
  ctx?: TradeContext | ScopeState,
): Promise<TermOptions> {
  return fakeListTermOptions(resolveCompanyId(ctx), documentType);
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
