import { type Injector, inject, runInInjectionContext } from '@angular/core';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import type { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { anyGrant, branchGrants, tenantWide } from '../../shared/trade-access';
import { ApiError } from '../../shared/trade-api';
import type { ScopeTarget } from '../webhooks.model';

export const WEBHOOK_PERMISSIONS = {
  read: 'trade.webhooks.read',
  manage: 'trade.webhooks.manage',
  replay: 'trade.webhooks.replay',
} as const;

export function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

export function isIdempotencyMismatch(code: string | null): boolean {
  return code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH';
}

export function hasWebhookReadGrant(injector: Injector): boolean {
  return runInInjectionContext(injector, () => anyGrant(WEBHOOK_PERMISSIONS.read));
}

export function hasWebhookScopeGrant(
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
