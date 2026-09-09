"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { commercialUuid7 } from "../commercial-command-fields";
import type { CommercialOperationReceipt } from "../commercial-operation";
import { readCommercialOperation } from "../commercial-operation-read";

interface State { key: string; operation: CommercialOperationReceipt | null; error: NormalizedApiError | null }

export function useCommercialOperation(operationId: string) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const allowed = isAuthenticated && !!user?.id && user.isTenantOwner;
  const validTarget = commercialUuid7.safeParse(operationId).success;
  const key = JSON.stringify([operationId, user?.id, realtimeAuthGeneration, allowed, refresh]);
  if (state !== null && state.key !== key) setState(null);

  useEffect(() => {
    if (!allowed || !validTarget) return;
    const controller = new AbortController();
    readCommercialOperation(operationId, controller.signal).then(
      (operation) => { if (!controller.signal.aborted) setState({ key, operation, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, operation: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, validTarget, operationId, key]);

  const current = state?.key === key ? state : null;
  const error = current?.error ?? null;
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  return { operation: current?.operation ?? null, error, reload,
    isNotFound: allowed && (!validTarget || error?.status === 404),
    denied: !allowed || error?.status === 403, isLoading: allowed && validTarget && !current };
}
