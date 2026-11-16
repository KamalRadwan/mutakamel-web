"use client";

import { useCallback, useRef, useState, type RefObject } from "react";

export function restoreTemplateFocus(
  event: Event,
  trigger: HTMLButtonElement | null,
  fallback: HTMLElement | null,
) {
  const target = trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length ? trigger : fallback;
  if (!target?.isConnected || !target.getClientRects().length) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
}

export function useTemplateDrawerIntent(
  authority: string,
  readAuthority: () => string | null,
  fallback: RefObject<HTMLElement | null>,
) {
  const [entry, setEntry] = useState<{ mode: "create" | "starters"; scopeKey?: string } | null>(null);
  const opener = useRef<{ trigger: HTMLButtonElement | null; scopeKey?: string } | null>(null);
  const retireScope = useCallback((scopeKey: string) => {
    if (opener.current?.scopeKey !== undefined && opener.current.scopeKey !== scopeKey) opener.current = null;
    setEntry(current => current?.scopeKey !== undefined && current.scopeKey !== scopeKey ? { mode: "create" } : current);
  }, []);
  return {
    entry,
    retireScope,
    open: (mode: "create" | "starters", trigger: HTMLButtonElement | null, scopeKey?: string) => {
      if (readAuthority() !== authority) return;
      opener.current = { trigger, scopeKey };
      setEntry({ mode, scopeKey });
    },
    close: () => setEntry(null),
    restore: (event: Event, scopeKey: string) => {
      const previous = opener.current;
      opener.current = null;
      if (readAuthority() !== authority) {
        const target = fallback.current;
        const doc = target?.ownerDocument;
        const focused = doc?.activeElement;
        if (!focused?.isConnected || focused === doc?.body || focused === doc?.documentElement) {
          restoreTemplateFocus(event, null, target);
        }
        return;
      }
      const trigger = previous && (previous.scopeKey === undefined || previous.scopeKey === scopeKey)
        ? previous.trigger : null;
      restoreTemplateFocus(event, trigger, fallback.current);
    },
  };
}
