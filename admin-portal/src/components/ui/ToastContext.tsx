// Re-export shim (docs/design-system/toast-contract.md, Phase 8). The real
// implementation moved to src/design-system/feedback/ (sonner-backed
// instead of hand-rolled state), but this module path and the useToast()
// (title, message?, duration?) signature stay exactly as they were: 149
// call sites across 35 files import from here and are not expected to move.
export { useToast, type AppToastApi } from "@/design-system/feedback/useToast";
export { ToastProvider } from "@/design-system/feedback/ToastProvider";
export type { ToastType } from "@/design-system/feedback/AppToast";
