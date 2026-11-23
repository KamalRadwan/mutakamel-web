import { type Injector, inject, runInInjectionContext } from '@angular/core';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { anyGrant, branchGrants, tenantWide } from '../../shared/trade-access';
import { ApiError, type TradeContext, errorCodeOf } from '../../shared/trade-api';
import type { TowerException } from '../tower.model';

export const TOWER_PERMISSIONS = {
  read: 'trade.control_tower.read',
  resolve: 'trade.control_tower.resolve',
} as const;

const FILTER_SCOPE_DENIED_REASONS = new Set([
  'branch_not_accessible',
  'branch_filter_requires_company',
  'include_branches_requires_company',
]);

export function isTowerFilterScopeError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === 'TRADE.CONTROL_TOWER.SCOPE_DENIED' &&
    FILTER_SCOPE_DENIED_REASONS.has(error.details?.['reason']?.[0] ?? '')
  );
}

export function isTowerForbiddenError(error: unknown): boolean {
  return (
    (error instanceof ApiError || error instanceof CoreApiError) &&
    error.status === 403 &&
    !isTowerFilterScopeError(error)
  );
}

export function isTowerNotReadyError(error: unknown): boolean {
  const code = errorCodeOf(error);
  return (
    code === 'TRADE.CONTROL_TOWER.PROJECTION_UNAVAILABLE' ||
    code === 'TRADE.CONTROL_TOWER.OWNER_UNAVAILABLE'
  );
}

export function isTowerTargetStaleError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'TRADE.CONTROL_TOWER.TARGET_STALE'
  );
}

export function isTowerQueryInvalidError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'TRADE.CONTROL_TOWER.QUERY_INVALID';
}

export function isIdempotencyMismatch(code: string | null): boolean {
  return code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH';
}

export function hasTowerReadGrant(injector: Injector): boolean {
  return runInInjectionContext(injector, () => anyGrant(TOWER_PERMISSIONS.read));
}

export function hasTowerGrantForContext(
  injector: Injector,
  key: string,
  ctx: TradeContext,
): boolean {
  if (!ctx.companyId && !ctx.branchId) {
    return runInInjectionContext(injector, () => tenantWide(key));
  }
  const grants = runInInjectionContext(injector, () => branchGrants(key));
  if (grants === 'ALL') return true;
  if (ctx.branchId) {
    return grants.has(ctx.branchId);
  }
  const companyId = ctx.companyId;
  if (!companyId) return false;
  const me = runInInjectionContext(injector, () => inject(TenantScopeState).me());
  if (!me) return false;
  const variants = [key, `${key}.own`, `${key}.team`, `${key}.all`];
  return variants.some(
    (variant) =>
      me.permissions.includes(variant) &&
      !!me.permissionScopes[variant]?.companyIds.includes(companyId),
  );
}

export function contextForException(
  ex: Pick<TowerException, 'companyId' | 'branchId'>,
): TradeContext {
  return {
    ...(ex.companyId ? { companyId: ex.companyId } : {}),
    ...(ex.branchId ? { branchId: ex.branchId } : {}),
  };
}
