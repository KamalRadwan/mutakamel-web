"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOptionalTradeScope, type TradeScopeChange } from "../../useTradeScope";

export type QuotationPendingChange = TradeScopeChange | { kind: "navigate"; value: string; entryKey?: string };
interface ScopeNavigation extends EventTarget {
  traverseTo: (key: string) => { committed: Promise<unknown>; finished: Promise<unknown> };
}
interface ScopeNavigationEvent extends Event {
  navigationType: string; hashChange: boolean;
  destination: { key: string; url: string; sameDocument: boolean };
}

export function useQuotationScopeProtection(options: {
  enabled: boolean;
  dirty: boolean;
  locked: boolean;
  blocked: boolean;
  save: () => Promise<boolean>;
  reset: () => void;
}) {
  const scope = useOptionalTradeScope();
  const router = useRouter();
  const confirmedEntry = useRef<string | null>(null);
  const register = scope?.registerContextGuard;
  const apply = scope?.applyContextChange;
  const [pending, setPending] = useState<QuotationPendingChange | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const guard = useCallback((change: TradeScopeChange) => {
    if (options.locked || options.blocked) return false;
    if (!options.dirty) return true;
    setPending(change);
    return false;
  }, [options.blocked, options.dirty, options.locked]);
  useEffect(() => {
    if (!options.enabled || !register) return;
    return register(guard, options.locked || options.blocked);
  }, [guard, options.blocked, options.enabled, options.locked, register]);

  useEffect(() => {
    if (!options.enabled || (!options.dirty && !options.blocked)) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target instanceof Element ? event.target : null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      event.preventDefault(); event.stopPropagation();
      if (!options.blocked) setPending({ kind: "navigate", value: url.pathname + url.search + url.hash });
    };
    const navigation = (window as Window & { navigation?: ScopeNavigation }).navigation;
    const traverse = (event: Event) => {
      const next = event as ScopeNavigationEvent;
      if (next.navigationType !== "traverse") return;
      if (next.destination.key === confirmedEntry.current) { confirmedEntry.current = null; return; }
      if (!next.cancelable || next.defaultPrevented || !next.destination.sameDocument || next.hashChange) return;
      const url = new URL(next.destination.url);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      next.preventDefault();
      if (!options.blocked) setPending({ kind: "navigate", value: url.pathname + url.search + url.hash,
        entryKey: next.destination.key });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    navigation?.addEventListener("navigate", traverse);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
      navigation?.removeEventListener("navigate", traverse);
    };
  }, [options.blocked, options.dirty, options.enabled]);

  const confirm = useCallback(async (saveFirst: boolean) => {
    if (!pending || options.blocked || isChanging) return;
    setIsChanging(true);
    try {
      if (saveFirst && !await options.save()) { setPending(null); return; }
      options.reset();
      if (pending.kind === "navigate") {
        const navigation = (window as Window & { navigation?: ScopeNavigation }).navigation;
        if (pending.entryKey && navigation) {
          confirmedEntry.current = pending.entryKey;
          const resumed = navigation.traverseTo(pending.entryKey);
          void Promise.allSettled([resumed.committed, resumed.finished]);
        } else router.push(pending.value);
      } else apply?.(pending);
      setPending(null);
    } finally { setIsChanging(false); }
  }, [apply, isChanging, options, pending, router]);
  return { pending, isChanging, confirm, cancel: () => setPending(null) };
}
