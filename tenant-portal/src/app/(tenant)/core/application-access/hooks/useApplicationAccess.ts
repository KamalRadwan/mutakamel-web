"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { readApplicationAccess } from "../application-access-api";
import { validateApplicationAccessRequest, type ApplicationAccessRequest, type ApplicationAccessView } from "../application-access-contract";

interface ReadState { key: string; view: ApplicationAccessView | null; error: NormalizedApiError | null }

export function useApplicationAccess(request: ApplicationAccessRequest) {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<ReadState | null>(null);
  const area = request.kind.endsWith("_CONFIGURATION") ? "configuration" : "activation";
  // These controllers explicitly declare ANY, without CRM-style scoped suffixes.
  const canRead = isAuthenticated && !!user && (user.isTenantOwner
    || user.permissions.some((permission) => permission === `applications.${area}.read` || permission === `applications.${area}.manage`));
  const canReadConfiguration = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.some((permission) =>
    permission === "applications.configuration.read" || permission === "applications.configuration.manage"));
  const scopePath = "branchId" in request ? `branches/${request.branchId}` : `companies/${request.companyId}`;
  const configurationHref = canReadConfiguration && area !== "configuration" && "addonKey" in request
    ? `/core/application-access/${scopePath}/application-activations/${request.applicationKey}/addons/${request.addonKey}/configuration` : null;
  const inputKey = JSON.stringify(request);
  const key = JSON.stringify([inputKey, user?.id, realtimeAuthGeneration, user?.permissions, user?.isTenantOwner, reloadToken, canRead]);
  if (state !== null && state.key !== key) setState(null);

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    const input = validateApplicationAccessRequest(JSON.parse(inputKey));
    readApplicationAccess(input, controller.signal).then(
      (view) => { if (!controller.signal.aborted) setState({ key, view, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, view: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [canRead, inputKey, key]);

  // Do not render old scope/session facts even for the render before effect cleanup.
  const current = state?.key === key ? state : null;
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  return {
    requestedKey: inputKey, snapshotKey: current?.key ?? null,
    t, lang, reload, configurationHref, view: current?.view ?? null, error: current?.error ?? null,
    loading: canRead && !current, denied: !canRead || current?.error?.status === 403,
  };
}
