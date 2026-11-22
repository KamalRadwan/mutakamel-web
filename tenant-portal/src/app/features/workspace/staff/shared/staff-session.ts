import { computed, inject, Service } from '@angular/core';
import { AuthSession } from '../../../../core/auth/auth-session';
import { TenantScopeState, type TenantResourceScope } from '../../../../core/scope/tenant-scope';

@Service()
export class StaffSession {
  private readonly auth = inject(AuthSession);
  private readonly scope = inject(TenantScopeState);

  readonly me = this.scope.me;
  readonly scopeRevision = computed(() => {
    const me = this.me();
    // /me has no revision. Keep the same key when a silent refresh returns identical scope.
    return me ? JSON.stringify([
      me.id, me.permissions, me.permissionScopes,
      me.accessibleCompanies, me.accessibleBranches, me.accessibleBranchCompanies, me.accessScope,
    ]) : null;
  });
  readonly state = computed(() => {
    if (this.me()) return 'ready';
    const status = this.auth.status();
    return status === 'unknown' || status === 'loading' ? 'pending' : 'failed';
  });

  async load() {
    await this.auth.ensureLoaded();
    return this.me();
  }

  isOwner(): boolean {
    return this.me()?.isTenantOwner === true;
  }

  isTenantWide(permission: string): boolean {
    return this.grant(permission)?.tenantWide === true;
  }

  canReadRolePermissions(): boolean {
    return this.can('roles.role.read') && this.can('roles.permission.read');
  }

  canReadBranchPermissions(): boolean {
    return this.isOwner() && this.canReadRolePermissions();
  }

  canUpdateBranchPermissions(): boolean {
    return this.canReadBranchPermissions() && this.isTenantWide('roles.role.update');
  }

  canCreateBranch(companyId: string): boolean {
    const grant = this.grant('org.branch.manage');
    // Ordinary branch creation uses Core's GLOBAL-mode company authority projection.
    return Boolean(grant && this.scope.companies().has(companyId) &&
      (grant.tenantWide === true || grant.companyIds.includes(companyId)));
  }

  can(permission: string, target?: TenantResourceScope): boolean {
    const grant = this.grant(permission);
    if (!grant) return false;

    const companies = this.scope.companies();
    const branchCompanies = this.scope.branchCompanies();
    const read = permission.endsWith('.read');
    if (!target) {
      // An unscoped decision only determines whether an indexed read route can open.
      const accessScope = this.me()?.accessScope;
      return read && (grant.tenantWide === true ||
        (accessScope?.companiesTruncated === true && grant.companyIds.length > 0) ||
        (accessScope?.branchesTruncated === true && grant.branchIds.length > 0) ||
        grant.companyIds.some((id) => companies.has(id)) ||
        grant.branchIds.some((id) => branchCompanies.has(id)));
    }

    if (target.branchId != null) {
      const company = branchCompanies.get(target.branchId);
      return Boolean(company && (target.companyId == null || company === target.companyId) &&
        (grant.tenantWide === true || grant.branchIds.includes(target.branchId)));
    }

    const companyId = target.companyId;
    if (!companyId || !companies.has(companyId)) return false;
    // Core projects parent companies into companyIds. It cannot prove company
    // write authority from this payload; use exact branches or a tenant grant.
    return grant.tenantWide === true || (read && grant.companyIds.includes(companyId)) ||
      (permission === 'org.company.read' &&
        grant.branchIds.some((branchId) => branchCompanies.get(branchId) === companyId));
  }

  private grant(permission: string) {
    const me = this.me();
    if (!me?.permissions.includes(permission)) return undefined;
    return me.permissionScopes[permission];
  }
}
