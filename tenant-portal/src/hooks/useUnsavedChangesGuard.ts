"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Matches Next's OnNavigateEventHandler argument — node_modules/next/dist/client/app-dir/link.d.ts. */
// Internal: callers get this shape inferred through `linkGuard`, so exporting
// it only creates an unreferenced public name.
interface GuardedNavigateEvent {
  preventDefault: () => void;
}

export interface UnsavedChangesGuard {
  /** True while a navigation is held, waiting for the user to answer. */
  isPrompting: boolean;
  /** Run any in-app navigation through this — it fires straight through when clean. */
  guard: (navigate: () => void) => void;
  /** Spread onto a <Link> as `onNavigate` to hold that link's navigation. */
  linkGuard: (href: string) => (event: GuardedNavigateEvent) => void;
  /** The user chose to leave. Runs the held navigation. */
  confirmLeave: () => void;
  /** The user chose to stay. Drops the held navigation. */
  cancelLeave: () => void;
}

// The page-level counterpart to FormDrawer's dirty guard, which only covers
// closing the drawer. A form that lives on a page — not in a drawer — loses
// its edits to a sidebar click, and nothing in FormDrawer can see that.
//
// What this actually covers, and what it does not:
//
//   covered  reload, tab close, and navigation away from the origin, via the
//            native beforeunload prompt (the browser's own wording; a page
//            cannot supply text there any more)
//   covered  any navigation the page routes through `guard()`, and any
//            <Link> given `linkGuard(href)` as its onNavigate
//   NOT      browser Back/Forward. The App Router exposes no cancellable
//            navigation event for popstate, and the history entry is already
//            gone by the time a listener runs. Faking it by pushing a
//            sacrificial entry corrupts the user's history, so it is left
//            uncovered and stated here rather than half-built.
//
// The hook owns no UI. The page renders ConfirmActionModal from isPrompting,
// so the confirm text comes from the page's own dictionary keys.
export function useUnsavedChangesGuard(isDirty: boolean): UnsavedChangesGuard {
  const router = useRouter();
  const [isPrompting, setIsPrompting] = useState(false);
  // The held navigation lives in a ref, not in state: running it is a side
  // effect, and a state updater that navigates fires twice under StrictMode.
  const pendingRef = useRef<(() => void) | null>(null);
  // The stable handlers below must read the CURRENT dirty flag, not the one
  // captured when they were created. Synced in an effect rather than during
  // render — a ref written during render is a React violation, and effects
  // flush before any user event can reach a handler.
  const dirtyRef = useRef(isDirty);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const guard = useCallback((navigate: () => void) => {
    if (!dirtyRef.current) {
      navigate();
      return;
    }
    pendingRef.current = navigate;
    setIsPrompting(true);
  }, []);

  const linkGuard = useCallback(
    (href: string) => (event: GuardedNavigateEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      pendingRef.current = () => router.push(href);
      setIsPrompting(true);
    },
    [router],
  );

  const confirmLeave = useCallback(() => {
    // Clear before running: the held navigation unmounts this page, and a
    // second confirm arriving in between must not replay it.
    const held = pendingRef.current;
    pendingRef.current = null;
    setIsPrompting(false);
    held?.();
  }, []);

  const cancelLeave = useCallback(() => {
    pendingRef.current = null;
    setIsPrompting(false);
  }, []);

  return { isPrompting, guard, linkGuard, confirmLeave, cancelLeave };
}
