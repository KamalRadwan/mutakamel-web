// Thin re-export during conversion — see docs/build/PHASE-3-COMPONENTS.md#3-feedback.
// Existing imports of ToastProvider/useToast from this path keep working
// unchanged, including inside Tier 1's TenantPortalRuntime.tsx, which this
// rebuild does not edit. Delete this file at the end of phase 4 once every
// consumer imports from @/design-system directly.
export { ToastProvider, useToast } from "@/design-system";
