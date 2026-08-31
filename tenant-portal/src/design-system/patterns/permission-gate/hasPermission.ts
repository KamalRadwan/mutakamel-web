const SCOPES = ["own", "team", "all"] as const;

// Mirrors the scoped-match semantics in src/lib/navigation/tenant-routes.ts's
// canAccessCrmRoute — kept as a small standalone helper here rather than
// importing that module, since it also carries CRM-specific route wiring
// this pattern has no business depending on.
function matchesOne(permissions: readonly string[], required: string, scoped: boolean): boolean {
  return permissions.some(
    (permission) =>
      permission === required || (scoped && SCOPES.some((scope) => permission === `${required}.${scope}`)),
  );
}

// Client-side check only — advisory, never authoritative. The backend
// re-checks every request; this improves the experience, it does not
// enforce anything. See docs/design/patterns.md#permissiongate.
export function hasPermission(
  permissions: readonly string[],
  require: string | string[],
  scoped = false,
): boolean {
  const required = Array.isArray(require) ? require : [require];
  // ALL semantics unless the caller opts into ANY at the call site.
  return required.every((permission) => matchesOne(permissions, permission, scoped));
}
