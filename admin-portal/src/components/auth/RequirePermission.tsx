// Re-export shim (docs/design-system/migration.md Phase 12). The real
// implementation moved to src/design-system/patterns/permission-gate/,
// restyled on the new tokens with its discriminated union kept byte-
// identical. This module path and the RequirePermission/useHasPermission
// names stay so existing call sites (src/app/(shell)/backup/layout.tsx,
// useCurrencyRates.ts) and their tests are unaffected.
export {
  PermissionGate as RequirePermission,
  useHasPermission,
} from "@/design-system/patterns/permission-gate/PermissionGate";
