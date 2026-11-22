import type { BulkJobSubmitResult } from '../../../shared/bulk-jobs/bulk-jobs.model';
import type { TradeContext } from '../shared/trade-api';
import type { Page } from '../shared/trade-foundation.model';
import {
  fakeBulkResolveTowerExceptions,
  fakeGetTowerCounts,
  fakeGetTowerException,
  fakeListTowerExceptions,
  fakeResolveTowerException,
} from './tower.fake';
import type {
  BulkResolveExceptionsInput,
  ListTowerExceptionsQuery,
  ResolveExceptionInput,
  TowerCounts,
  TowerCountsQuery,
  TowerException,
} from './tower.model';

export const TOWER_QUERY_KEYS = {
  all: ['trade', 'automation', 'tower'] as const,
  counts: () => ['trade', 'automation', 'tower', 'counts'] as const,
  list: (q?: ListTowerExceptionsQuery) =>
    ['trade', 'automation', 'tower', 'list', q ?? {}] as const,
  detail: (id: string) => ['trade', 'automation', 'tower', 'detail', id] as const,
};

// List, counts and bulk carry the scope context headers (contextHeaders(ctx)): TENANT none,
// COMPANY company, BRANCH company + branch. Scope is never a query param; only branchId (company
// context only) and includeBranches narrow it.

// GET /api/tenant/trade/v1/control-tower/exceptions/counts
//   ?severity&category&sourceType&createdFrom&createdTo&includeBranches&branchId
//   -> { total, byStatus, bySeverity, byCategory, resolvedToday }
export function getCounts(ctx: TradeContext, q: TowerCountsQuery = {}): Promise<TowerCounts> {
  return fakeGetTowerCounts(ctx, q);
}

// GET /api/tenant/trade/v1/control-tower/exceptions
//   ?page&limit&status=A,B&severity&category&sourceType&createdFrom&createdTo&includeBranches&branchId&sort
export function listExceptions(
  ctx: TradeContext,
  q: ListTowerExceptionsQuery = {},
): Promise<Page<TowerException>> {
  return fakeListTowerExceptions(ctx, q);
}

// GET /api/tenant/trade/v1/control-tower/exceptions/:id
export function getException(id: string): Promise<TowerException> {
  return fakeGetTowerException(id);
}

// POST /api/tenant/trade/v1/control-tower/exceptions/:id/resolve
//   body { resolutionCode, reasonCode, note?, evidence } (forbidNonWhitelisted)
export function resolve(
  id: string,
  input: ResolveExceptionInput,
  ifMatch: number,
  idempotencyKey: string,
): Promise<TowerException> {
  return fakeResolveTowerException(id, input, { ifMatch, idempotencyKey });
}

// POST /api/tenant/trade/v1/bulk-jobs (module: trading.control-tower-exceptions, action: RESOLVE)
//   scope = the scope context; a QUERY selection takes the list filters (+ includeBranches, branchId).
export function bulkResolve(
  ctx: TradeContext,
  input: BulkResolveExceptionsInput,
  idempotencyKey: string,
): Promise<BulkJobSubmitResult> {
  return fakeBulkResolveTowerExceptions(ctx, input, idempotencyKey);
}
