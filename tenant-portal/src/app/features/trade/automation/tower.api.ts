import type { CoreQuery } from '../../../core/api/core-http';
import type { BulkJobSubmitResult } from '../../../shared/bulk-jobs/bulk-jobs.model';
import {
  ApiError,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../shared/trade-api';
import { tradeHttp } from '../shared/trade-http';
import type {
  BulkResolveExceptionsInput,
  ListTowerExceptionsQuery,
  ResolveExceptionInput,
  TowerCounts,
  TowerCountsQuery,
  TowerException,
  TowerExceptionPage,
} from './tower.model';

export const TOWER_QUERY_KEYS = {
  all: ['trade', 'automation', 'tower'] as const,
  counts: () => ['trade', 'automation', 'tower', 'counts'] as const,
  list: (q?: ListTowerExceptionsQuery) =>
    ['trade', 'automation', 'tower', 'list', q ?? {}] as const,
  detail: (id: string) => ['trade', 'automation', 'tower', 'detail', id] as const,
};

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function requireIfMatchHeader(version: number): string {
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  return ifMatch(version);
}

function addIfPresent(
  target: CoreQuery,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value === undefined || value === '') return;
  target[key] = value;
}

function buildCountsQuery(q: TowerCountsQuery): CoreQuery | undefined {
  const query: CoreQuery = {};
  addIfPresent(query, 'severity', q.severity);
  addIfPresent(query, 'category', q.category);
  addIfPresent(query, 'sourceType', q.sourceType);
  addIfPresent(query, 'createdFrom', q.createdFrom);
  addIfPresent(query, 'createdTo', q.createdTo);
  addIfPresent(query, 'branchId', q.branchId);
  addIfPresent(query, 'includeBranches', q.includeBranches);
  addIfPresent(query, 'sort', q.sort);
  return Object.keys(query).length > 0 ? query : undefined;
}

function buildListQuery(q: ListTowerExceptionsQuery): CoreQuery | undefined {
  const query: CoreQuery = buildCountsQuery(q) ?? {};
  if (q.status && q.status.length > 0) {
    query['status'] = q.status.join(',');
  }
  addIfPresent(query, 'page', q.page);
  addIfPresent(query, 'limit', q.limit);
  return Object.keys(query).length > 0 ? query : undefined;
}

// List, counts and detail carry the scope context headers (scopeFor(ctx, 'OPTIONAL')):
// TENANT none, COMPANY company, BRANCH company + branch. Scope is never a query param;
// only branchId (company context only) and includeBranches narrow it.

// GET /api/tenant/trade/v1/control-tower/exceptions/counts
//   ?severity&category&sourceType&createdFrom&createdTo&includeBranches&branchId&sort
//   -> { total, byStatus, bySeverity, byCategory, resolvedToday }
export function getCounts(ctx: TradeContext, q: TowerCountsQuery = {}): Promise<TowerCounts> {
  return tradeHttp().read<TowerCounts>(
    '/control-tower/exceptions/counts',
    buildCountsQuery(q),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/control-tower/exceptions
//   ?page&limit&status=A,B&severity&category&sourceType&createdFrom&createdTo&includeBranches&branchId&sort
export function listExceptions(
  ctx: TradeContext,
  q: ListTowerExceptionsQuery = {},
): Promise<TowerExceptionPage> {
  return tradeHttp().read<TowerExceptionPage>(
    '/control-tower/exceptions',
    buildListQuery(q),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/control-tower/exceptions/:id
export function getException(id: string, ctx: TradeContext = {}): Promise<TowerException> {
  return tradeHttp().read<TowerException>(
    `/control-tower/exceptions/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// POST /api/tenant/trade/v1/control-tower/exceptions/:id/resolve
//   body { resolutionCode, reasonCode, note?, evidence } (forbidNonWhitelisted; never send deprecated reason)
export async function resolve(
  id: string,
  input: ResolveExceptionInput,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<TowerException> {
  const body: ResolveExceptionInput = {
    resolutionCode: input.resolutionCode,
    reasonCode: input.reasonCode,
    ...(input.note !== undefined && input.note !== null ? { note: input.note } : {}),
    evidence: input.evidence,
  };
  const { data } = await tradeHttp().write<TowerException>(
    'POST',
    `/control-tower/exceptions/${encodeSeg(id)}/resolve`,
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// B13 is out of the MVP (owner 2026-11-23): bulk resolve stays hidden and unlinked.
export function bulkResolve(
  _ctx: TradeContext,
  _input: BulkResolveExceptionsInput,
  _idempotencyKey: string,
): Promise<BulkJobSubmitResult> {
  return Promise.reject(new ApiError(501, 'TRADE.CONTROL_TOWER.BULK_RESOLVE_DISABLED'));
}
