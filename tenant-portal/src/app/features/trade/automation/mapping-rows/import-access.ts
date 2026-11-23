import { type Injector, inject, runInInjectionContext } from '@angular/core';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import type { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { anyGrant, branchGrants } from '../../shared/trade-access';
import { ApiError, type TradeContext, errorCodeOf, tradeContext } from '../../shared/trade-api';

export const IMPORT_PERMISSIONS = {
  read: 'trade.import.read',
  manage: 'trade.import.manage',
  execute: 'trade.import.execute',
} as const;

export function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

export function isIdempotencyMismatch(code: string | null): boolean {
  return code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH';
}

export function isQueryInvalidError(error: unknown): boolean {
  return errorCodeOf(error) === 'TRADE.CONTROL_TOWER.QUERY_INVALID';
}

export function hasImportReadGrant(injector: Injector): boolean {
  return runInInjectionContext(injector, () => anyGrant(IMPORT_PERMISSIONS.read));
}

export function hasImportScopeGrant(
  injector: Injector,
  scopeState: ScopeState,
  key: string,
  target?: 'TENANT' | 'COMPANY' | 'BRANCH',
): boolean {
  const grants = runInInjectionContext(injector, () => branchGrants(key));
  if (grants === 'ALL') return true;
  const company = scopeState.company();
  if (!company?.id) return grants.size > 0;
  const branchId = company.branches.length > 0 ? scopeState.branch()?.id : undefined;
  const effectiveTarget = target ?? (branchId ? 'BRANCH' : 'COMPANY');
  if (effectiveTarget === 'BRANCH') {
    return Boolean(branchId && grants.has(branchId));
  }
  if (branchId && grants.has(branchId)) return true;
  if (company.branches.some((branch) => grants.has(branch.id))) return true;
  const me = runInInjectionContext(injector, () => inject(TenantScopeState).me());
  const variants = [key, `${key}.own`, `${key}.team`, `${key}.all`];
  return variants.some(
    (variant) =>
      !!me?.permissions.includes(variant) &&
      !!me.permissionScopes[variant]?.companyIds.includes(company.id),
  );
}

export function importContext(scopeState: ScopeState): TradeContext {
  const companyId = scopeState.company()?.id;
  if (!companyId) return {};
  return tradeContext(scopeState, scopeState.branch()?.id ? 'BRANCH' : 'COMPANY');
}
