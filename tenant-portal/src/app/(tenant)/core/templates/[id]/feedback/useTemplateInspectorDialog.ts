"use client";

import { useRef, type ComponentPropsWithoutRef, type RefObject } from "react";
import type { DialogContent } from "@/design-system";
import type { DesignerInteractionController } from "../../designer-interaction-controller";
import type { InspectorLocalState } from "../inspector/inspector-ports";
import { useInspectorDialog } from "../inspector/useInspectorLocalState";
import { isTemplateFocusTarget } from "./inspector-feedback-context";

export type InspectorGestureOwner = Pick<DesignerInteractionController, "getSnapshot" | "cancel">;
export type TemplateInspectorDialogLifecycle = Pick<ComponentPropsWithoutRef<typeof DialogContent>,
  "onOpenAutoFocus" | "onCloseAutoFocus" | "onEscapeKeyDown"> & { readonly onBeforeClose: () => boolean };

/** Only actual current model cancellation; viewport/pointer ownership stays with T01. */
export function useTemplateInspectorDialog(current: () => boolean, root: RefObject<HTMLElement | null>, gestures: InspectorGestureOwner): TemplateInspectorDialogLifecycle {
  const returnTo = useRef<HTMLElement | null>(null);
  const onBeforeClose = () => {
    if (!current()) return false;
    gestures.cancel();
    return current() && !gestures.getSnapshot().active;
  };
  return {
    onBeforeClose,
    onOpenAutoFocus: event => {
      const container = root.current;
      if (!current() || !container) { event.preventDefault(); return; }
      const focused = container.ownerDocument.activeElement;
      returnTo.current = focused instanceof HTMLElement && container.contains(focused) ? focused : null;
    },
    onCloseAutoFocus: event => {
      event.preventDefault();
      const target = returnTo.current, container = root.current;
      returnTo.current = null;
      if (!current() || !target || !container || !isTemplateFocusTarget(target, container)) return;
      const document = target.ownerDocument, focused = document.activeElement;
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
      const topDialog = dialogs.at(-1);
      if (topDialog && !topDialog.contains(target)) return;
      if (focused && focused !== document.body && focused !== document.documentElement && focused !== target && focused.isConnected) return;
      target.focus();
    },
    onEscapeKeyDown: event => {
      if (event.defaultPrevented) return;
      if (!current()) { event.preventDefault(); return; }
      if (gestures.getSnapshot().active) {
        event.preventDefault(); event.stopPropagation(); gestures.cancel();
      }
    },
  };
}

/** Reuse T02's actual dirty/Continue/Discard state, with one synchronous exit gate. */
export function useTemplateInspectorCloseDialog(lifecycle: TemplateInspectorDialogLifecycle, onChange?: (state: InspectorLocalState) => void) {
  const dialog = useInspectorDialog(onChange);
  return { ...dialog,
    change: (next: boolean) => { if (next || lifecycle.onBeforeClose()) dialog.change(next); },
    discardClose: () => { if (lifecycle.onBeforeClose()) dialog.discardClose(); },
  };
}
