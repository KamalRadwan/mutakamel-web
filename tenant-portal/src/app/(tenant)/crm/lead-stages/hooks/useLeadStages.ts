"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  buildCreateLeadStageRequest,
  parseLeadStageCatalogueResponse,
  parseLeadStageResponse,
  type CreateLeadStageFormData,
  type LeadStageItem,
} from "../lead-stage-contract";

export type { CreateLeadStageFormData, LeadStageItem } from "../lead-stage-contract";

const CATALOGUE_PATH = "/api/tenant/crm/v1/lead-stages";
const NON_REPLAYABLE_MUTATION = {
  nonReplayable: true,
  skipAutoIdempotency: true,
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
} as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}

async function readCatalogue(signal?: AbortSignal): Promise<LeadStageItem[]> {
  const response = await axiosClient.get<unknown>(CATALOGUE_PATH, {
    signal,
    cache: "no-store",
    maxResponseBytes: 256 * 1024,
  });
  return parseLeadStageCatalogueResponse(response.data);
}

export function useLeadStages() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.lead_stages.manage") ?? false;
  const [items, setItems] = useState<LeadStageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The catalogue fetch's own failure. Handed to DataTable so the error
  // state replaces the empty state rather than stacking with it.
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadStageItem | null>(
    null,
  );

  const reconcileCatalogue = useCallback(async (): Promise<boolean> => {
    try {
      setItems(await readCatalogue());
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchStages = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setLoadError(null);
    try {
      setItems(await readCatalogue(signal));
    } catch (caught) {
      if (isAbortError(caught)) return;
      setItems([]);
      setLoadError(normalizeApiError(caught));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchStages(controller.signal);
    });
    return () => controller.abort();
  }, [fetchStages]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.nameAr, item.nameEn, item.flag, item.category].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [items, searchQuery]);

  const openCreate = () => {
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (isCreating) return;
    setCreateError(null);
    setIsCreateOpen(false);
  };

  const openDelete = (stage: LeadStageItem) => {
    setDeleteError(null);
    setSelectedForDelete(stage);
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setDeleteError(null);
    setSelectedForDelete(null);
  };

  const handleCreate = async (
    form: CreateLeadStageFormData,
  ): Promise<boolean> => {
    if (isCreating) return false;
    if (!canManage) {
      setCreateError("You do not have permission to manage lead stages.");
      return false;
    }
    let payload: ReturnType<typeof buildCreateLeadStageRequest>;
    try {
      payload = buildCreateLeadStageRequest(form);
    } catch (caught) {
      setCreateError(errorMessage(caught, "Invalid lead-stage details."));
      return false;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await axiosClient.post<unknown>(
        CATALOGUE_PATH,
        payload,
        NON_REPLAYABLE_MUTATION,
      );
      try {
        const created = parseLeadStageResponse(response.data);
        setItems((current) => {
          const retained = current
            .filter(({ id }) => id !== created.id)
            .map((stage) =>
              created.isDefault ? { ...stage, isDefault: false } : stage,
            );
          return [...retained, created].sort(
            (left, right) => left.sortOrder - right.sortOrder,
          );
        });
      } catch {
        const reloaded = await reconcileCatalogue();
        setError(
          reloaded
            ? "The stage was created, but its response was invalid. The catalogue was reloaded."
            : "The stage was created, but its response was invalid and the catalogue could not be reloaded.",
        );
      }
      setIsCreateOpen(false);
      return true;
    } catch (caught) {
      if (isAmbiguousMutationError(caught)) {
        const reloaded = await reconcileCatalogue();
        setIsCreateOpen(false);
        setError(
          reloaded
            ? "The creation result is uncertain. The stage catalogue was refreshed; review it before submitting again."
            : "The creation result is uncertain and the stage catalogue could not be refreshed. Reload before trying again.",
        );
      } else {
        setCreateError(errorMessage(caught, "Unable to create the lead stage."));
      }
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedForDelete || isDeleting) return;
    if (!canManage) {
      setError("You do not have permission to manage lead stages.");
      setDeleteError(null);
      setSelectedForDelete(null);
      return;
    }
    const target = selectedForDelete;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await axiosClient.delete(
        `${CATALOGUE_PATH}/${encodeURIComponent(target.id)}`,
        NON_REPLAYABLE_MUTATION,
      );
      setItems((current) =>
        current
          .filter(({ id }) => id !== target.id)
          .map((stage, index) => ({ ...stage, sortOrder: index + 1 })),
      );
      setDeleteError(null);
      setSelectedForDelete(null);
    } catch (caught) {
      if (isAmbiguousMutationError(caught)) {
        const reloaded = await reconcileCatalogue();
        setSelectedForDelete(null);
        setError(
          reloaded
            ? "The deletion result is uncertain. The stage catalogue was refreshed; review it before trying again."
            : "The deletion result is uncertain and the stage catalogue could not be refreshed. Reload before trying again.",
        );
      } else {
        setDeleteError(errorMessage(caught, "Unable to delete the lead stage."));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (stage: LeadStageItem) => {
    if (
      !stage.isActive ||
      stage.isDefault ||
      stage.flag === "CONVERTED" ||
      settingDefaultId
    ) {
      return;
    }
    if (!canManage) {
      setError("You do not have permission to manage lead stages.");
      return;
    }
    setSettingDefaultId(stage.id);
    setError(null);
    try {
      const response = await axiosClient.post<unknown>(
        `${CATALOGUE_PATH}/${encodeURIComponent(stage.id)}/default`,
        undefined,
        NON_REPLAYABLE_MUTATION,
      );
      try {
        const updated = parseLeadStageResponse(response.data);
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === updated.id
              ? { ...updated, isDefault: true }
              : { ...candidate, isDefault: false },
          ),
        );
      } catch {
        const reloaded = await reconcileCatalogue();
        setError(
          reloaded
            ? "The default changed, but its response was invalid. The catalogue was reloaded."
            : "The default changed, but its response was invalid and the catalogue could not be reloaded.",
        );
      }
    } catch (caught) {
      await reconcileCatalogue();
      setError(errorMessage(caught, "Unable to set the default lead stage."));
    } finally {
      setSettingDefaultId(null);
    }
  };

  return {
    t,
    lang,
    items: filteredItems,
    isLoading,
    isCreating,
    isDeleting,
    settingDefaultId,
    error,
    loadError,
    createError,
    deleteError,
    canManage,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    openCreate,
    closeCreate,
    selectedForDelete,
    openDelete,
    closeDelete,
    handleCreate,
    handleDelete,
    handleSetDefault,
    fetchStages,
  };
}
