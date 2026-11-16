"use client";

import { useEffect, useRef } from "react";
import { subscribeTenantLeadRealtime } from "@/context/tenant-lead-realtime";

// LB-5-PORTAL: bounded burst coalescing, even on continuously active boards.
const DEBOUNCE_MS = 200;
const MAX_WAIT_MS = 1_000;
const MAX_REVISIONS = 512;

export function useLeadRealtimeInvalidation({
  generation,
  branchId,
  reconcile,
}: {
  generation: string | null;
  branchId: string | null;
  reconcile: (signal: AbortSignal) => Promise<unknown>;
}): void {
  const reconcileRef = useRef(reconcile);
  useEffect(() => { reconcileRef.current = reconcile; }, [reconcile]);

  useEffect(() => {
    if (!generation || !branchId) return;
    const controller = new AbortController();
    const revisions = new Map<string, { revision: bigint; kinds: Set<string> }>();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let maxWait: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let dirty = false;

    const clearTimers = () => {
      clearTimeout(debounce);
      clearTimeout(maxWait);
      debounce = undefined;
      maxWait = undefined;
    };
    const run = async (): Promise<void> => {
      clearTimers();
      if (controller.signal.aborted || inFlight || !dirty) return;
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      dirty = false;
      inFlight = true;
      try {
        await reconcileRef.current(controller.signal);
      } catch {
        // REST hooks own errors (including 403). A socket never grants access
        // or starts an automatic retry loop after an authoritative denial.
      } finally {
        inFlight = false;
        if (!controller.signal.aborted && dirty) void run();
      }
    };
    const invalidate = () => {
      dirty = true;
      if (inFlight) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => { void run(); }, DEBOUNCE_MS);
      maxWait ??= setTimeout(() => { void run(); }, MAX_WAIT_MS);
    };
    const unsubscribe = subscribeTenantLeadRealtime((event) => {
      if (event.generation !== generation) return;
      if (event.kind === "changed") {
        if (event.payload.branchId !== branchId) return;
        const { leadId, revision, changeKind } = event.payload;
        const nextRevision = BigInt(revision);
        const previous = revisions.get(leadId);
        if (previous && (previous.revision > nextRevision ||
          (previous.revision === nextRevision && previous.kinds.has(changeKind)))) return;
        const kinds = previous?.revision === nextRevision ? previous.kinds : new Set<string>();
        kinds.add(changeKind);
        revisions.delete(leadId);
        revisions.set(leadId, { revision: nextRevision, kinds });
        if (revisions.size > MAX_REVISIONS) revisions.delete(revisions.keys().next().value!);
      } else {
        revisions.clear();
      }
      // An unloaded lead can enter the current filter; IDs never select rows to patch.
      invalidate();
    });
    const foreground = () => {
      if (navigator.onLine && document.visibilityState === "visible") {
        revisions.clear();
        invalidate();
      }
    };
    window.addEventListener("online", foreground);
    window.addEventListener("focus", foreground);
    window.addEventListener("pageshow", foreground);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      controller.abort();
      clearTimers();
      unsubscribe();
      revisions.clear();
      window.removeEventListener("online", foreground);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("pageshow", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [branchId, generation]);
}
