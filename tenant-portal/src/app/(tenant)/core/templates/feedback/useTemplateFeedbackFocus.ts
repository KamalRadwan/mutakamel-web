"use client";

import { useEffect, useRef } from "react";

/** Restore a lost reading position without interrupting another live control. */
export function useTemplateFeedbackFocus(active: boolean) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = target.current;
    if (!active || !element || element.closest('[inert], [aria-hidden="true"]')) return;
    const document = element.ownerDocument;
    const focused = document.activeElement;
    // Radix owns the modal focus lifecycle. A page-level error must not
    // compete with an open dialog, including its initial autofocus effect.
    if (document.querySelector('[role="dialog"]:not([hidden]):not([data-state="closed"]), [role="alertdialog"]:not([hidden]):not([data-state="closed"])')) return;
    if (focused && focused !== document.body && focused !== document.documentElement && focused.isConnected) return;
    element.focus();
  }, [active]);
  return target;
}
