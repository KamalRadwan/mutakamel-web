"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { commercialReceiptReferenceSchema, type CommercialApplyReceipt, type CommercialReceiptReference } from "../commercial-apply";
import { readCommercialReceipt } from "../commercial-receipt-read";

interface State { key: string; receipt: CommercialApplyReceipt | null; error: NormalizedApiError | null }

export function useCommercialReceipt({ previewId, preparationId }: CommercialReceiptReference) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const allowed = isAuthenticated && !!user?.id && user.isTenantOwner;
  const validTarget = commercialReceiptReferenceSchema.safeParse({ previewId, preparationId }).success;
  const key = JSON.stringify([previewId, preparationId, user?.id, realtimeAuthGeneration, allowed, refresh]);
  // A prior actor, session or target must never restore old financial facts while a fresh read is pending.
  if (state !== null && state.key !== key) setState(null);

  useEffect(() => {
    if (!allowed || !validTarget) return;
    const controller = new AbortController();
    readCommercialReceipt({ previewId, preparationId }, controller.signal).then(
      (receipt) => { if (!controller.signal.aborted) setState({ key, receipt, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, receipt: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, validTarget, previewId, preparationId, key]);

  const current = state?.key === key ? state : null;
  const error = current?.error ?? null;
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  return { receipt: current?.receipt ?? null, error, reload,
    isNotFound: allowed && (!validTarget || error?.status === 404),
    denied: !allowed || error?.status === 403, isLoading: allowed && validTarget && !current };
}
