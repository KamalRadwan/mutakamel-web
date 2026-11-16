import type { TemplateInspectorDialogLifecycle } from "./useTemplateInspectorDialog";

/** Bind an existing T01/T02 close state once; owner-specific discard runs only after admission. */
export function createTemplateInspectorExitAdmission(lifecycle: TemplateInspectorDialogLifecycle, handlers: {
  change: (open: boolean) => void;
  discardClose: () => void;
}) {
  const { onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown } = lifecycle;
  return {
    // The non-DOM before-close port must never be spread onto DialogContent.
    contentLifecycle: { onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown },
    change: (open: boolean) => { if (open || lifecycle.onBeforeClose()) handlers.change(open); },
    discardClose: () => { if (lifecycle.onBeforeClose()) handlers.discardClose(); },
  };
}
