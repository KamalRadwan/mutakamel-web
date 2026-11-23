import { inject } from '@angular/core';
import { hasScopedPermission } from '../../../../core/auth/scoped-permission';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';

function permissionVariants(key: string): string[] {
  return [key, `${key}.own`, `${key}.team`, `${key}.all`];
}

/** Call these helpers in an Angular injection context; each reads the current /me. */
export function tenantWide(key: string): boolean {
  const me = inject(TenantScopeState).me();
  return permissionVariants(key).some((variant) => hasTenantWidePermission(me, variant));
}

export function anyGrant(key: string): boolean {
  const me = inject(TenantScopeState).me();
  return !!me && (me.isTenantOwner || hasScopedPermission(me.permissions, key));
}

export function branchGrants(key: string): 'ALL' | Set<string> {
  const me = inject(TenantScopeState).me();
  if (tenantWide(key)) return 'ALL';
  const branches = new Set<string>();
  for (const variant of permissionVariants(key)) {
    if (!me?.permissions.includes(variant)) continue;
    const grant = me.permissionScopes[variant];
    if (!grant) continue;
    for (const branchId of grant.branchIds) branches.add(branchId);
    for (const { branchId, companyId } of me.accessibleBranchCompanies) {
      if (grant.companyIds.includes(companyId)) branches.add(branchId);
    }
  }
  return branches;
}
