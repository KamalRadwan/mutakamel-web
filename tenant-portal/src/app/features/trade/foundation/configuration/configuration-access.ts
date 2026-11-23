import { type Injector, runInInjectionContext } from '@angular/core';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import type { ScopeState } from '../../../../core/scope/scope';
import { anyGrant, branchGrants, tenantWide } from '../../shared/trade-access';
import { ApiError } from '../../shared/trade-api';
import type { ScopeTarget } from './configuration.model';

export function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

export function isIdempotencyMismatch(code: string | null): boolean {
  return code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH';
}

export function hasConfigReadGrant(injector: Injector): boolean {
  return runInInjectionContext(injector, () => anyGrant('trade.configuration.read'));
}

export function canCreateConfigDefinition(injector: Injector): boolean {
  return runInInjectionContext(injector, () => tenantWide('trade.configuration.manage'));
}

export function hasConfigScopeGrant(
  injector: Injector,
  scopeState: ScopeState,
  key: string,
  target: ScopeTarget,
): boolean {
  if (target === 'TENANT') {
    return runInInjectionContext(injector, () => tenantWide(key));
  }
  const grants = runInInjectionContext(injector, () => branchGrants(key));
  if (grants === 'ALL') return true;
  const company = scopeState.company();
  const branchId = company?.branches.length ? scopeState.branch()?.id : undefined;
  if (target === 'BRANCH') {
    return Boolean(branchId && grants.has(branchId));
  }
  if (!company?.id) return grants.size > 0;
  if (branchId && grants.has(branchId)) return true;
  return !branchId && company.branches.some((branch) => grants.has(branch.id));
}
