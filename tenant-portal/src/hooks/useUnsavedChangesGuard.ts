"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface UnsavedChangesGuard {
  isDiscardOpen: boolean;
  requestDiscard: (action: () => void) => void;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
}

// The installed TypeScript DOM library predates the Navigation API.
interface GuardedNavigateEvent extends Event {
  navigationType: string;
  hashChange: boolean;
  destination: { key: string; url: string; sameDocument: boolean };
}
interface GuardedNavigation extends EventTarget {
  traverseTo: (key: string) => { committed: Promise<unknown>; finished: Promise<unknown> };
}

function resolveGuardedNavigationHref(
  event: MouseEvent,
  currentLocation: Location,
): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;

  if (anchor.hasAttribute("download") || anchor.getAttribute("aria-disabled") === "true") {
    return null;
  }
  const targetAttr = anchor.getAttribute("target");
  if (targetAttr && targetAttr.toLowerCase() !== "_self") return null;

  const rawHref = anchor.getAttribute("href")?.trim();
  if (!rawHref || rawHref.startsWith("#")) return null;

  let destination: URL;
  try {
    destination = new URL(rawHref, currentLocation.href);
  } catch {
    return null;
  }

  if (destination.protocol !== "http:" && destination.protocol !== "https:") return null;
  if (destination.origin !== currentLocation.origin) return null;

  // Same-page hash jumps and self-links keep the current form state mounted.
  if (
    destination.pathname === currentLocation.pathname &&
    destination.search === currentLocation.search
  ) {
    return null;
  }

  const nextHref = `${destination.pathname}${destination.search}${destination.hash}`;
  if (!nextHref.startsWith("/") || nextHref.startsWith("//")) return null;
  return nextHref;
}

/**
 * Shared dirty-form discard guard for stateful settings screens.
 *
 * Guards explicit in-page reset/reload actions via `requestDiscard`, registers
 * `beforeunload` only while dirty, and intercepts ordinary same-origin anchor
 * navigations in capture phase before `next/link` consumes the click.
 *
 * Native cancellable same-document traversals protect Back/Forward without
 * rewriting Next's history. Browsers can allow an escape traversal; older
 * engines without Navigation API retain the anchor and beforeunload guards.
 * Callers wrap their own imperative actions with `requestDiscard`.
 */
export function useUnsavedChangesGuard(isDirty: boolean): UnsavedChangesGuard {
  const router = useRouter();
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const [wasDirty, setWasDirty] = useState(isDirty);
  if (wasDirty !== isDirty) {
    setWasDirty(isDirty);
    if (!isDirty && isDiscardOpen) {
      setIsDiscardOpen(false);
    }
  }

  const requestDiscard = useCallback(
    (action: () => void): void => {
      if (!isDirty) {
        pendingActionRef.current = null;
        setIsDiscardOpen(false);
        action();
        return;
      }
      pendingActionRef.current = action;
      setIsDiscardOpen(true);
    },
    [isDirty],
  );

  const confirmDiscard = useCallback((): void => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsDiscardOpen(false);
    action?.();
  }, []);

  const cancelDiscard = useCallback((): void => {
    pendingActionRef.current = null;
    setIsDiscardOpen(false);
  }, []);

  useEffect(() => {
    if (!isDirty) {
      pendingActionRef.current = null;
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const nextHref = resolveGuardedNavigationHref(event, window.location);
      if (!nextHref) return;
      event.preventDefault();
      pendingActionRef.current = () => {
        router.push(nextHref);
      };
      setIsDiscardOpen(true);
    };

    const navigation = (window as Window & { navigation?: GuardedNavigation }).navigation;
    let confirmedEntry: string | null = null;
    const handleNavigate = (event: Event) => {
      const next = event as GuardedNavigateEvent;
      if (next.navigationType !== "traverse") return;
      if (next.destination.key === confirmedEntry) {
        confirmedEntry = null;
        return;
      }
      if (!next.cancelable || next.defaultPrevented || !next.destination.sameDocument || next.hashChange) return;
      const url = new URL(next.destination.url);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      next.preventDefault();
      pendingActionRef.current = () => {
        confirmedEntry = next.destination.key;
        const resumed = navigation!.traverseTo(confirmedEntry);
        void Promise.allSettled([resumed.committed, resumed.finished]);
      };
      setIsDiscardOpen(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    navigation?.addEventListener("navigate", handleNavigate);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
      navigation?.removeEventListener("navigate", handleNavigate);
      pendingActionRef.current = null;
    };
  }, [isDirty, router]);

  return {
    isDiscardOpen,
    requestDiscard,
    confirmDiscard,
    cancelDiscard,
  };
}
