import { type Injector, inject, runInInjectionContext } from '@angular/core';
import type { TranslocoService } from '@jsverse/transloco';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import type { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { anyGrant, branchGrants, tenantWide } from '../../shared/trade-access';
import { ApiError, errorCodeOf, errorKey } from '../../shared/trade-api';
import type { ScopeTarget } from '../policy.model';

export const PROFILE_PERMISSIONS = {
  read: 'trade.document_profiles.read',
  manage: 'trade.document_profiles.manage',
  validate: 'trade.document_profiles.validate',
  publish: 'trade.document_profiles.publish',
} as const;

export function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

export function isPublicationUnavailableError(error: unknown): boolean {
  return (
    errorCodeOf(error) === 'TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE' ||
    (error instanceof ApiError &&
      error.status === 503 &&
      error.code === 'TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE')
  );
}

export function isActivePointerStaleError(error: unknown): boolean {
  return errorCodeOf(error) === 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE';
}

export function isEffectiveOverlapError(error: unknown): boolean {
  const code = errorCodeOf(error);
  if (code === 'TRADE.DOCUMENT_PROFILE.EFFECTIVE_OVERLAP') {
    return true;
  }
  return (
    code === 'TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY' &&
    error instanceof ApiError &&
    error.details?.['reason']?.[0]?.toUpperCase() === 'EFFECTIVE_OVERLAP'
  );
}

export function hasProfileReadGrant(injector: Injector): boolean {
  return runInInjectionContext(injector, () => anyGrant(PROFILE_PERMISSIONS.read));
}

export function hasProfileScopeGrant(
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

export function profileActorDisplayName(
  authorUserId: string | null | undefined,
  me: TenantMe | null,
): string {
  if (!authorUserId) return '—';
  if (me && me.id === authorUserId) {
    const full = `${me.firstName} ${me.lastName}`.trim();
    return full || me.email || authorUserId;
  }
  return authorUserId;
}

export function resolveProfileErrorMessage(transloco: TranslocoService, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return transloco.translate('tradeShared.errors.network');
  }
  if (isEffectiveOverlapError(error)) {
    return transloco.translate('profiles.errors.effectiveOverlap');
  }

  switch (error.code) {
    case 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED':
      return transloco.translate('profiles.errors.compatibilityChanged');
    case 'TRADE.DOCUMENT_PROFILE.CONFIRMATION_MODE_UNSUPPORTED':
      return transloco.translate('profiles.errors.confirmationModeUnsupported');
    case 'TRADE.DOCUMENT_PROFILE.EFFECTIVE_OVERLAP':
      return transloco.translate('profiles.errors.effectiveOverlap');
    case 'TRADE.DOCUMENT_PROFILE.ACTIVATION_FAILED':
      return transloco.translate('profiles.errors.generic');
    case 'TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE':
      return transloco.translate('profiles.errors.publicationUnavailableText');
    case 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE':
      return transloco.translate('profiles.errors.activePointerStaleText');
  }

  const normalized = error.code.replaceAll('.', '_');
  const reason = error.details?.['reason']?.[0];
  if (reason) {
    const reasonKey = `governance.errors.${normalized}_${reason}`;
    const reasonTranslated = transloco.translate(reasonKey);
    if (reasonTranslated !== reasonKey) return reasonTranslated;
  }

  const codeKey = `governance.errors.${normalized}`;
  const codeTranslated = transloco.translate(codeKey);
  if (codeTranslated !== codeKey) return codeTranslated;

  const sharedKey = errorKey(error);
  const sharedTranslated = transloco.translate(sharedKey);
  if (sharedTranslated !== sharedKey) return sharedTranslated;

  return transloco.translate('profiles.errors.generic');
}
