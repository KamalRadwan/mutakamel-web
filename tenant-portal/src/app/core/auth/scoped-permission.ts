/** True when `permissions` holds `key` itself or its scoped form `key.own|team|all`, as /me sends scoped CRM keys. */
export function hasScopedPermission(permissions: readonly string[], key: string): boolean {
  return permissions.includes(key) || ['own', 'team', 'all'].some((scope) => permissions.includes(`${key}.${scope}`));
}
