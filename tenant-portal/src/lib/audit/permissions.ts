// core-app/src/tenant/audit/tenant-audit.controller.ts: RequireAnyPermissions.
const AUDIT_READ_PERMISSIONS = ["audit.read", "audit.read.branch", "audit.read.own"] as const;

export function canReadAudit(permissions: readonly string[]): boolean {
  return AUDIT_READ_PERMISSIONS.some((permission) => permissions.includes(permission));
}
