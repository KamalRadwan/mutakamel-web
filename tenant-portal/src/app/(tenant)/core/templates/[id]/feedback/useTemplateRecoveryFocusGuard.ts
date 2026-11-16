"use client";

import { useEffect, useLayoutEffect, useRef, type FocusEvent, type RefObject } from "react";
import { isTemplateFocusTarget } from "./inspector-feedback-context";

/** Scoped composition guard for T18's mount/unblock notice autofocus only. */
export function useTemplateRecoveryFocusGuard({ blocked, current, scope }: {
  blocked: boolean;
  current: () => boolean;
  scope?: RefObject<HTMLElement | null>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previousBlocked = useRef<boolean | null>(null);
  const autoFocusWindow = useRef(false);
  useLayoutEffect(() => {
    autoFocusWindow.current = previousBlocked.current === null || (previousBlocked.current && !blocked);
    previousBlocked.current = blocked;
  });
  // Child passive effects run first: user-directed focus later remains untouched.
  useEffect(() => { autoFocusWindow.current = false; });
  const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    const container = root.current, target = event.relatedTarget;
    if (!autoFocusWindow.current || !container || !(target instanceof HTMLElement)) return;
    // This is the existing T18 main notice, not a retry/error field or dialog.
    const notice = container.querySelector('[role="alert"][tabindex="-1"]');
    if (event.target !== notice || !current() || !isTemplateFocusTarget(target, scope?.current ?? container)) return;
    const dialogs = Array.from(container.ownerDocument.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
    const topDialog = dialogs.at(-1);
    if (topDialog && !topDialog.contains(target)) return;
    autoFocusWindow.current = false;
    target.focus({ preventScroll: true });
  };
  return { root, onFocusCapture };
}
