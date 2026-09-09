"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { fetchInvoice } from "../../../billing-contract";
import type { InvoiceRead } from "../../../invoice-read";

interface State { key: string; view: InvoiceRead | null; error: NormalizedApiError | null }

/** Exact owner read: never retain old financial facts across a new target or session. */
export function useInvoiceDetail(invoiceId: string) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const allowed = isAuthenticated && !!user?.id && user.isTenantOwner;
  const validTarget = isUUIDv7(invoiceId);
  const key = JSON.stringify([invoiceId, user?.id, realtimeAuthGeneration, allowed, refresh]);
  // Retire the old snapshot permanently, including an A→B→A context change.
  if (state !== null && state.key !== key) setState(null);

  useEffect(() => {
    if (!allowed || !validTarget) return;
    const controller = new AbortController();
    fetchInvoice(invoiceId, controller.signal).then(
      (view) => { if (!controller.signal.aborted) setState({ key, view, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, view: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, validTarget, invoiceId, key]);

  const current = state?.key === key ? state : null;
  const error: NormalizedApiError | null = allowed && !validTarget ? { status: 404, code: "INVOICE_NOT_FOUND" } : current?.error ?? null;
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  return { view: current?.view ?? null, error, isNotFound: error?.status === 404,
    denied: !allowed || error?.status === 403, isLoading: allowed && validTarget && !current,
    isRefreshing: allowed && validTarget && !current, reload };
}
