import { type Injector, inject, runInInjectionContext } from '@angular/core';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import type { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { anyGrant, branchGrants, tenantWide } from '../../shared/trade-access';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import type { ScopeTarget } from '../automation-shared/automation.model';

export const EXTENSION_PERMISSIONS = {
  read: 'trade.extensions.read',
  manage: 'trade.extensions.manage',
  publish: 'trade.extensions.publish',
} as const;

export function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

export function isExtensionNotFoundError(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.status === 404) ||
    errorCodeOf(error) === 'TRADE.EXTENSION.DEFINITION_NOT_FOUND'
  );
}

export function isExtensionConflictError(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code === 'TRADE.CONCURRENCY.STALE_VERSION' || code === 'TRADE.EXTENSION.PROFILE_CONFLICT';
}

export function isIdempotencyMismatch(code: string | null): boolean {
  return code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH';
}

export function hasExtensionReadGrant(injector: Injector): boolean {
  return runInInjectionContext(injector, () => anyGrant(EXTENSION_PERMISSIONS.read));
}

export function hasExtensionScopeGrant(
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
  if (!company?.id) return grants.size > 0;
  const branchId = company.branches.length > 0 ? scopeState.branch()?.id : undefined;
  if (target === 'BRANCH') {
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


export function parseExtensionScope(raw: string | undefined): ScopeTarget {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'TENANT' || upper === 'BRANCH') return upper;
  return 'COMPANY';
}
