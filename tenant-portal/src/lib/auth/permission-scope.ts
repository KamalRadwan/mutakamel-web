export interface PermissionScope {
  tenantWide: boolean;
  companyIds: string[];
  branchIds: string[];
}

export interface PermissionTarget {
  tenantWide?: boolean;
  companyId?: string | null;
  branchId?: string;
}

interface PermissionSubject {
  permissions: readonly string[];
  permissionScopes?: Record<string, PermissionScope>;
}

// core-app/src/common/tenant-access/tenant-permission-resolver.ts
const MAX_PERMISSION_PROJECTION = 500;

/** Advisory reflection of Core's active grants, never inferred from accessScope. */
export function can(
  user: PermissionSubject | null | undefined,
  key: string,
  target: PermissionTarget = {},
): boolean {
  if (!user?.permissions.includes(key) || !user.permissionScopes ||
    !Object.hasOwn(user.permissionScopes, key)) return false;
  const scope = user.permissionScopes[key];
  if (!scope) return false;
  if (target.tenantWide || target.companyId === null) return scope.tenantWide;
  if (target.companyId !== undefined && !scope.tenantWide &&
    !scope.companyIds.includes(target.companyId)) return false;
  if (target.branchId !== undefined && !scope.tenantWide &&
    !scope.branchIds.includes(target.branchId)) return false;
  return scope.tenantWide || scope.companyIds.length > 0 || scope.branchIds.length > 0;
}

/** Core bounds permission keys and each explicit scope collection to 500. */
export function isPermissionScopes(
  value: unknown,
  permissions: readonly string[],
): value is Record<string, PermissionScope> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > MAX_PERMISSION_PROJECTION || entries.length !== permissions.length ||
    new Set(permissions).size !== permissions.length) return false;
  return entries.every(([key, scope]: [string, unknown]) => {
    if (!key || !permissions.includes(key) || !scope || typeof scope !== "object" ||
      Array.isArray(scope)) return false;
    const candidate = scope as Record<string, unknown>;
    return typeof candidate.tenantWide === "boolean" &&
      isScopeIds(candidate.companyIds) && isScopeIds(candidate.branchIds);
  });
}

function isScopeIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_PERMISSION_PROJECTION &&
    value.every((id: unknown) => typeof id === "string" && id.length > 0) &&
    new Set(value).size === value.length;
}
