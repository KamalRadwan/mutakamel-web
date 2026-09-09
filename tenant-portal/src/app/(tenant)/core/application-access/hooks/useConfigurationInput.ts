"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { configurationTarget, readConfigurationInput, type ConfigurationInputView, type ConfigurationTarget } from "../configuration-input-api";

interface State { key: string; view: ConfigurationInputView | null; error: NormalizedApiError | null }

export function useConfigurationInput(request: ConfigurationTarget, refreshKey: string | null) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.some((permission) =>
    permission === "applications.configuration.read" || permission === "applications.configuration.manage"));
  const requestKey = JSON.stringify(request);
  const key = JSON.stringify([requestKey, user?.id, realtimeAuthGeneration, user?.permissions, user?.isTenantOwner, refreshKey, allowed]);
  const [state, setState] = useState<State | null>(null);
  if (state !== null && state.key !== key) setState(null);
  useEffect(() => {
    if (!allowed || refreshKey === null) return;
    const controller = new AbortController();
    readConfigurationInput(configurationTarget(JSON.parse(requestKey)), controller.signal).then(
      (view) => { if (!controller.signal.aborted) setState({ key, view, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, view: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, key, requestKey, refreshKey]);
  const current = state?.key === key ? state : null;
  return { view: current?.view ?? null, error: current?.error ?? null, snapshotKey: current?.key ?? null,
    loading: allowed && refreshKey !== null && !current, denied: !allowed || current?.error?.status === 403 };
}
