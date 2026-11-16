"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  ACQUISITION_SOURCES_PATH, MAX_ACQUISITION_SOURCES,
  parseAcquisitionSourcesResponse, type AcquisitionSource,
} from "../acquisition-source-contract";
import { useAcquisitionSourceMutations } from "./useAcquisitionSourceMutations";
import { useAcquisitionSourceOrdering } from "./useAcquisitionSourceOrdering";

const CATALOGUE_RESPONSE_LIMIT_BYTES = 1_000_000;

export function useAcquisitionSources() {
  const { lang, t } = useI18n();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const scope = useAuthScopeKey(user);
  const [writeForbidden, setWriteForbidden] = useState(false);
  const canManage = !writeForbidden && canMutate && (user?.permissions.includes("crm.acquisition_sources.manage") ?? false);
  const [items, setItems] = useState<AcquisitionSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const loadSequence = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const sequence = ++loadSequence.current;
    const current = () => mounted.current && sequence === loadSequence.current && !signal?.aborted;
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(ACQUISITION_SOURCES_PATH, {
        signal, cache: "no-store", maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES,
      });
      const sources = parseAcquisitionSourcesResponse(response.data).sort((a, b) => a.sortOrder - b.sortOrder);
      if (!current()) return false;
      setItems(sources);
      setNeedsReload(false);
      return true;
    } catch (error) {
      if (!current()) return false;
      const { status, code } = normalizeApiError(error);
      setQueryError({ status, code });
      return false;
    } finally {
      if (current()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => { mounted.current = false; controller.abort(); };
  }, [load]);

  const writeBlocked = isLoading || !!queryError || needsReload;
  const mutations = useAcquisitionSourceMutations(canManage && !writeBlocked, items.length, load,
    (source) => setItems((current) => [...current.filter(({ id }) => id !== source.id), source].sort((a, b) => a.sortOrder - b.sortOrder)),
    (id) => setItems((current) => current.filter((source) => source.id !== id)));

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return items.filter(({ nameAr, nameEn }) => !query ||
      nameAr.toLocaleLowerCase().includes(query) || nameEn.toLocaleLowerCase().includes(query));
  }, [items, searchQuery]);

  const ordering = useAcquisitionSourceOrdering({
    items, scope, canManage,
    blocked: writeBlocked || !!searchQuery.trim() || mutations.isCreating || mutations.isDeleting || mutations.isCreateOpen || !!mutations.selectedForDelete,
    apply: setItems, reload: load, setError: mutations.setMutationError, requireReload: () => setNeedsReload(true), forbidWrite: () => setWriteForbidden(true),
  });

  return {
    t, lang, canManage, allItems: items, items: filteredItems, searchQuery, setSearchQuery,
    hasLoadedItems: items.length > 0,
    isFiltered: searchQuery.trim().length > 0,
    isAtLimit: items.length >= MAX_ACQUISITION_SOURCES,
    isLoading, queryError, needsReload, writeBlocked,
    applyUpdatedSource: (updated: AcquisitionSource) => {
      setItems((current) => current.map((source) => source.id === updated.id ? updated : source));
    },
    reload: () => load(),
    ...mutations, ...ordering,
  };
}
