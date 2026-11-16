"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

const hasDialog = () => !!document.querySelector('[role="dialog"], [role="alertdialog"]');
const available = (element: HTMLElement | null): element is HTMLElement => !!element?.isConnected
  && element !== document.body && element !== document.documentElement
  && !element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[inert], [aria-hidden="true"]');

export function useCustomFieldDialogFocus(open: boolean) {
  const fallback = useRef<HTMLInputElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  const wasOpen = useRef(open);
  const cancelRestore = useRef<(() => void) | null>(null);
  const setFallbackElement = useCallback((element: HTMLInputElement | null) => { fallback.current = element; }, []);

  const capture = useCallback(() => {
    cancelRestore.current?.();
    // Nested discard confirmations belong to the original opening action.
    if (openRef.current) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  useLayoutEffect(() => {
    openRef.current = open;
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
      // Radix retains its trap through exit animation, including nested confirmations.
      if (cancelled || openRef.current || hasDialog()) return;
      observer.disconnect();
      frame = requestAnimationFrame(() => {
        if (cancelled || openRef.current || hasDialog()) return;
        const active = document.activeElement;
        if (available(active instanceof HTMLElement ? active : null)) return;
        const target = available(opener.current) ? opener.current : fallback.current;
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

  return { capture, setFallbackElement };
}
