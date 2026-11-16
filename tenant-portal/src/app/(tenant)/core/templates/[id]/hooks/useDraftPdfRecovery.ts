"use client";

import { useLayoutEffect, useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import type { AcceptedPdfPreview, PdfPreviewJob, PreviewDraftPin } from "../../template-preview-session-contract";

interface SuspendedDraftPdf {
  scope: string;
  source: string;
  fixtureKey: string;
  profileSequence: number;
  accepted: AcceptedPdfPreview & PreviewDraftPin;
  previousStatus: PdfPreviewJob | null;
  expiresAt: number;
}

function createDraftPdfRecovery() {
  let suspended: SuspendedDraftPdf | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const clear = () => {
    if (!suspended) return;
    suspended = null;
    clearTimeout(timer);
    timer = undefined;
    listeners.forEach(listener => listener());
  };
  const expire = () => {
    if (!suspended) return;
    const remaining = suspended.expiresAt - Date.now();
    if (remaining <= 0) clear();
    else timer = setTimeout(expire, Math.min(remaining, 30_000));
  };
  return {
    read: () => suspended,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    suspend(record: SuspendedDraftPdf) {
      if (!Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now() || suspended?.accepted === record.accepted) return;
      clearTimeout(timer);
      suspended = record;
      expire();
      listeners.forEach(listener => listener());
    },
    clear,
  };
}

export type DraftPdfRecovery = ReturnType<typeof createDraftPdfRecovery>;

/** The route visit owns the accepted job while its authorized PDF port remounts. */
export function useDraftPdfRecovery(routeId: string): DraftPdfRecovery {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const recovery = useMemo(createDraftPdfRecovery, [routeId, realtimeAuthGeneration, user?.id]);
  useLayoutEffect(() => {
    const sessionId = getStoredTenantSessionMeta()?.sessionId;
    const stop = subscribeToTenantAuthEvents(event => {
      if (event.kind === "session-ended" ? event.sessionId === sessionId : event.sessionId !== sessionId) recovery.clear();
    });
    return () => { stop(); recovery.clear(); };
  }, [recovery]);
  return recovery;
}
