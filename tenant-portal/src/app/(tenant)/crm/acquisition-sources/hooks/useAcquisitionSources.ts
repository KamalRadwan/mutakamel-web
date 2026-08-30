"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  ACQUISITION_SOURCES_PATH,
  acquisitionSourcePath,
  buildCreateAcquisitionSourceRequest,
  parseAcquisitionSourceResponse,
  parseAcquisitionSourcesResponse,
  type AcquisitionSource,
  type CreateAcquisitionSourceInput,
} from "../acquisition-source-contract";

const CATALOGUE_RESPONSE_LIMIT_BYTES = 1_000_000;

export function useAcquisitionSources() {
  const { lang, t } = useI18n();
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
      setQueryError(normalizeApiError(error));
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
      setMutationError("You do not have permission to manage acquisition sources.");
      return false;
    }
    let payload: CreateAcquisitionSourceInput;
    try {
      payload = buildCreateAcquisitionSourceRequest(input);
    } catch (error) {
      setMutationError(
        errorMessage(error, "Invalid acquisition-source details."),
      );
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
            ? "The creation result is uncertain. The catalogue was refreshed; review it before submitting again."
            : "The creation result is uncertain and the catalogue could not be refreshed. Reload before trying again.",
        );
      } else {
        setMutationError(
          errorMessage(error, "Unable to create acquisition source."),
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
      setMutationError("You do not have permission to manage acquisition sources.");
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
            ? "The deletion result is uncertain. The catalogue was refreshed; review it before trying again."
            : "The deletion result is uncertain and the catalogue could not be refreshed. Reload before trying again.",
        );
      } else {
        setMutationError(
          errorMessage(error, "Unable to delete acquisition source."),
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    t,
    lang,
    items: filteredItems,
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
    handleCreate,
    handleDelete,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}
