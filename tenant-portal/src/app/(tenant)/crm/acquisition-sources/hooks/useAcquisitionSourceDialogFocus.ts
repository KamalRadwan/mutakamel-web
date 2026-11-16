"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

type SourceAction = "edit" | "icon" | "menu";
const actionId = (sourceId: string, action: SourceAction) => `source-${action}-${sourceId}`;
const dialogSelector = '[role="dialog"], [role="alertdialog"]';
const available = (element: HTMLElement | null): element is HTMLElement => !!element?.isConnected
  && element !== document.body && element !== document.documentElement
  && !element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[inert], [aria-hidden="true"]');

export function useAcquisitionSourceDialogFocus(open: boolean) {
  const fallbackRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  const opening = useRef(false);
  const wasOpen = useRef(open);
  const cancelRestore = useRef<(() => void) | null>(null);
  const setFallbackElement = useCallback((element: HTMLInputElement | null) => { fallbackRef.current = element; }, []);

  const capture = useCallback((element?: HTMLElement | null) => {
    cancelRestore.current?.();
    // Delete's in-use recovery opens Edit without replacing the original row opener.
    if (openRef.current) return;
    opener.current = element ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    opening.current = true;
  }, []);

  useLayoutEffect(() => {
    openRef.current = open;
    opening.current = false;
    cancelRestore.current?.();
    if (open) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    let frame: number | undefined;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
    const restore = () => {
      // Controlled Radix dialogs can retain their focus trap during exit animation.
      if (cancelled || openRef.current || document.querySelector(dialogSelector)) return;
      observer.disconnect();
      frame = requestAnimationFrame(() => {
        if (cancelled || openRef.current || document.querySelector(dialogSelector)) return;
        const active = document.activeElement;
        if (active && active !== document.body && active !== document.documentElement) return;
        const target = available(opener.current) ? opener.current : fallbackRef.current;
        if (available(target)) target.focus({ preventScroll: true });
        opener.current = null;
      });
    };
    const observer = new MutationObserver(restore);
    observer.observe(document.body, { childList: true, subtree: true });
    cancelRestore.current = stop;
    restore();
    return stop;
  }, [open]);

  return {
    setFallbackElement,
    actionId,
    capture,
    captureAction: (sourceId: string, action: SourceAction) => capture(document.getElementById(actionId(sourceId, action))),
    onMenuCloseAutoFocus: (event: Event) => { if (opening.current || openRef.current) event.preventDefault(); },
  };
}
