"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { parseCrmStaticDataResponse, type CrmStaticData } from "./static-catalogue-contract";
import { buildStaticCatalogueGroups, filterStaticCatalogueGroups } from "./static-catalogue-groups";

export { parseCrmStaticDataResponse } from "./static-catalogue-contract";
export { buildStaticCatalogueGroups } from "./static-catalogue-groups";
export type { StaticCatalogueGroup } from "./static-catalogue-groups";

export const CRM_STATIC_DATA_PATH = "/api/tenant/crm/v1/static-data";

interface CatalogueState {
  scope: string;
  catalogue: CrmStaticData | null;
  error: NormalizedApiError | null;
  isLoading: boolean;
}

export function useCrmStaticCatalogue() {
  const { lang, t } = useI18n();
  const { user } = useTenantAuth();
  const scope = useAuthScopeKey(user);
  const canRead = hasPermission(user?.permissions ?? [], "crm.settings.read");
  const [state, setState] = useState<CatalogueState>({ scope, catalogue: null, error: null, isLoading: true });
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<{ scope: string; key: string } | null>(null);
  const request = useRef({ generation: 0, controller: null as AbortController | null });

  const reload = useCallback(async () => {
    if (!canRead) return;
    request.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++request.current.generation;
    request.current.controller = controller;
    const current = () => !controller.signal.aborted && generation === request.current.generation;
    setState((previous) => ({ scope, catalogue: previous.scope === scope ? previous.catalogue : null, error: null, isLoading: true }));
    try {
      const response = await axiosClient.get<unknown>(CRM_STATIC_DATA_PATH, {
        signal: controller.signal, cache: "no-store", maxResponseBytes: 2_000_000,
      });
      if (!current()) return;
      const catalogue = parseCrmStaticDataResponse(response.data);
      setState({ scope, catalogue, error: null, isLoading: false });
    } catch (caught) {
      if (!current()) return;
      const error = normalizeApiError(caught);
      // An authoritative denial removes retained reference data, including open details.
      setState((previous) => ({ scope, catalogue: error.status === 403 || previous.scope !== scope ? null : previous.catalogue,
        error, isLoading: false }));
    }
  }, [canRead, scope]);

  useEffect(() => {
    let disposed = false;
    const pending = request.current;
    queueMicrotask(() => { if (!disposed) void reload(); });
    return () => {
      disposed = true;
      pending.generation += 1;
      pending.controller?.abort();
    };
  }, [reload]);

  const inScope = state.scope === scope && canRead;
  const catalogue = inScope ? state.catalogue : null;
  const error = inScope ? state.error : null;
  const allGroups = useMemo(() => catalogue
    ? buildStaticCatalogueGroups(catalogue, lang, t.crmStaticCatalogue.untranslatedLabel, t.crmStaticCatalogue) : [],
  [catalogue, lang, t.crmStaticCatalogue]);
  const groups = useMemo(() => filterStaticCatalogueGroups(allGroups, searchQuery, lang), [allGroups, searchQuery, lang]);
  const selectedGroup = selection?.scope === scope ? allGroups.find((group) => group.key === selection.key) ?? null : null;

  return {
    t, lang, catalogue, allGroups, groups, searchQuery, setSearchQuery,
    isFiltered: searchQuery.trim().length > 0,
    isLoading: canRead && (!inScope || state.isLoading),
    loadError: catalogue === null ? error : null,
    denied: error?.status === 403,
    isStale: catalogue !== null && error !== null,
    selectedGroup, openDetails: (key: string) => setSelection({ scope, key }), closeDetails: () => setSelection(null), reload,
  };
}
