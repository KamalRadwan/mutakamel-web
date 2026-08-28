"use client";

import { useCallback, useRef, useState } from "react";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { controlPlaneAuditApi } from "../api/control-plane-audit-api";
import type { ControlPlaneAuditEventDetail } from "../types/control-plane-audit";

export type AuditEventDetailStatus = "IDLE" | "LOADING" | "READY" | "UNAVAILABLE";

/**
 * Fetches the full evidence (before/after/diff/metadata) for one audit
 * event on demand, since the list response omits it. `load` is idempotent
 * once a request has started or succeeded, so opening/closing the evidence
 * panel repeatedly does not refetch.
 */
export function useAuditEventDetail(eventId: string) {
  const [status, setStatus] = useState<AuditEventDetailStatus>("IDLE");
  const [data, setData] = useState<ControlPlaneAuditEventDetail | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestedRef = useRef(false);

  const load = useCallback(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    setStatus("LOADING");
    controlPlaneAuditApi
      .getById(eventId)
      .then((result) => {
        setData(result);
        setStatus("READY");
      })
      .catch((requestError: unknown) => {
        setError(normalizeApiError(requestError));
        setStatus("UNAVAILABLE");
        requestedRef.current = false;
      });
  }, [eventId]);

  const retry = useCallback(() => {
    requestedRef.current = false;
    load();
  }, [load]);

  return { status, data, error, load, retry };
}
