import type { TenantMe } from './auth-session.model';

/** Workspace-wide right to `key`: the owner, or the key held with a tenant-wide scope (Core's TENANT_WIDE_PERMISSION_REQUIRED rule). */
export function hasTenantWidePermission(me: TenantMe | null | undefined, key: string): boolean {
  if (!me) return false;
  return me.isTenantOwner || (me.permissions.includes(key) && me.permissionScopes[key]?.tenantWide === true);
}
