"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  ACQUISITION_SOURCES_PATH,
  ACQUISITION_SOURCE_REORDER_PATH,
  acquisitionSourcePath,
  buildCreateAcquisitionSourceRequest,
  moveAcquisitionSourceOrder,
  parseAcquisitionSourceResponse,
  parseAcquisitionSourcesResponse,
  type AcquisitionSource,
  type CreateAcquisitionSourceInput,
} from "../acquisition-source-contract";

const CATALOGUE_RESPONSE_LIMIT_BYTES = 1_000_000;

export function useAcquisitionSources() {
  const { lang, t } = useI18n();
  const crmErrorText = useCrmErrorText();
  const { user } = useTenantAuth();
  const canManage =
    user?.permissions.includes("crm.acquisition_sources.manage") ?? false;
  const [items, setItems] = useState<AcquisitionSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // The catalogue fetch's own failure. Handed to DataTable so the error
  // state replaces the empty state rather than stacking with it.
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] =
    useState<AcquisitionSource | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(ACQUISITION_SOURCES_PATH, {
        signal,
        cache: "no-store",
        maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES,
      });
      setItems(parseAcquisitionSourcesResponse(response.data));
      return true;
    } catch (error) {
      if (isAbortError(error)) return false;
      const { status, code } = normalizeApiError(error);
      setQueryError({ status, code });
      return false;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return items.filter(
      ({ nameAr, nameEn }) =>
        !query ||
        nameAr.toLocaleLowerCase().includes(query) ||
        nameEn.toLocaleLowerCase().includes(query),
    );
  }, [items, searchQuery]);

  const handleCreate = async (
    input: CreateAcquisitionSourceInput,
  ): Promise<boolean> => {
    if (!canManage) {
      setMutationError(t.crmAcquisitionSources.iconForbidden);
      return false;
    }
    let payload: CreateAcquisitionSourceInput;
    try {
      payload = buildCreateAcquisitionSourceRequest(input);
    } catch {
      setMutationError(t.crmAcquisitionSources.invalidNames);
      return false;
    }
    setIsCreating(true);
    setMutationError(null);
    try {
      const response = await axiosClient.post<unknown>(
        ACQUISITION_SOURCES_PATH,
        payload,
        {
          cache: "no-store",
          maxResponseBytes: 100_000,
          nonReplayable: true,
          skipAutoIdempotency: true,
        },
      );
      const created = parseAcquisitionSourceResponse(response.data);
      setItems((current) => [
        ...current.filter(({ id }) => id !== created.id),
        created,
      ]);
      setIsCreateOpen(false);
      await load();
      return true;
    } catch (error) {
      if (isAmbiguousMutationError(error)) {
        const reloaded = await load();
        setIsCreateOpen(false);
        setMutationError(
          reloaded
            ? t.crmAcquisitionSources.createUncertain
            : t.crmAcquisitionSources.createUncertainStale,
        );
      } else {
        setMutationError(
          crmErrorText(apiFailure(error)) ?? t.crmAcquisitionSources.createFailed,
        );
      }
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selectedForDelete) return;
    if (!canManage) {
      setMutationError(t.crmAcquisitionSources.iconForbidden);
      setSelectedForDelete(null);
      return;
    }
    const deletedId = selectedForDelete.id;
    setIsDeleting(true);
    setMutationError(null);
    try {
      await axiosClient.delete(acquisitionSourcePath(deletedId), {
        cache: "no-store",
        maxResponseBytes: 10_000,
        nonReplayable: true,
        skipAutoIdempotency: true,
      });
      setItems((current) => current.filter(({ id }) => id !== deletedId));
      setSelectedForDelete(null);
      await load();
    } catch (error) {
      if (isAmbiguousMutationError(error)) {
        const reloaded = await load();
        setSelectedForDelete(null);
        setMutationError(
          reloaded
            ? t.crmAcquisitionSources.deleteUncertain
            : t.crmAcquisitionSources.deleteUncertainStale,
        );
      } else {
        setMutationError(
          crmErrorText(apiFailure(error)) ?? t.crmAcquisitionSources.deleteFailed,
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * `PATCH /acquisition-sources/reorder` — task 8.18.
   *
   * The body is `{ orderedIds }`: the COMPLETE display order, every
   * non-deleted source exactly once. There is no per-source rank field to
   * PATCH — `sortOrder` is an entity field the server owns, never a query
   * parameter and never a writable one.
   *
   * Auto-idempotency is left on: this route is `idempotent: true` in the
   * Gateway contract and answers IDEM_MISSING without the key.
   */
  const handleMove = async (
    source: AcquisitionSource,
    direction: -1 | 1,
  ): Promise<void> => {
    if (!canManage || reorderingId) return;
    const orderedIds = moveAcquisitionSourceOrder(items, source.id, direction);
    if (!orderedIds) return;
    const previous = items;
    setReorderingId(source.id);
    setMutationError(null);
    // Optimistic: re-rank locally so the row moves before the round trip.
    setItems((current) =>
      orderedIds.map((id, index) => {
        const entry = current.find((candidate) => candidate.id === id);
        return { ...(entry as AcquisitionSource), sortOrder: index + 1 };
      }),
    );
    try {
      const response = await axiosClient.patch<unknown>(
        ACQUISITION_SOURCE_REORDER_PATH,
        { orderedIds },
        { cache: "no-store", maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES },
      );
      setItems(parseAcquisitionSourcesResponse(response.data));
    } catch (error) {
      // Rollback AND say why — a silent revert leaves the user watching a
      // change undo itself (docs/design/states.md, state 8).
      setItems(previous);
      setMutationError(error instanceof TenantApiClientError
        ? crmErrorText(apiFailure(error))
        : t.crmAcquisitionSources.reorderFailed);
      await load();
    } finally {
      setReorderingId(null);
    }
  };

  return {
    t,
    lang,
    items: filteredItems,
    // Reorder writes the whole catalogue order, so it must be driven by the
    // unfiltered list; a searched view is not the real order and the controls
    // are suppressed while one is active.
    isFiltered: searchQuery.trim().length > 0,
    hasLoadedItems: items.length > 0,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    isDeleting,
    queryError,
    mutationError,
    canManage,
    isCreateOpen,
    openCreate: () => {
      if (!canManage) return;
      setMutationError(null);
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (isCreating) return;
      setMutationError(null);
      setIsCreateOpen(false);
    },
    selectedForDelete,
    selectForDelete: (item: AcquisitionSource) => {
      if (!canManage) return;
      setMutationError(null);
      setSelectedForDelete(item);
    },
    closeDelete: () => {
      if (isDeleting) return;
      setMutationError(null);
      setSelectedForDelete(null);
    },
    reorderingId,
    handleMove,
    // The icon upload lives in useAcquisitionSourceIcon; this is how its
    // result reaches the list without that hook owning the catalogue.
    applyUpdatedSource: (updated: AcquisitionSource) => {
      setItems((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    },
    handleCreate,
    handleDelete,
    reload: () => load(),
  };
}


function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function apiFailure(error: unknown): NormalizedApiError {
  const { status, code } = normalizeApiError(error);
  return { status, code };
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}
