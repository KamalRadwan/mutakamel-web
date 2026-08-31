"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  parseLeadStageCatalogueResponse,
  type LeadStageItem,
  type UpdateLeadStageFormData,
} from "../lead-stage-contract";
import { useLeadStageMutations } from "./useLeadStageMutations";

export type { LeadStageItem } from "../lead-stage-contract";

const CATALOGUE_PATH = "/api/tenant/crm/v1/lead-stages";

async function readCatalogue(signal?: AbortSignal): Promise<LeadStageItem[]> {
  const response = await axiosClient.get<unknown>(CATALOGUE_PATH, {
    signal,
    cache: "no-store",
    maxResponseBytes: 256 * 1024,
  });
  return parseLeadStageCatalogueResponse(response.data);
}

/**
 * The lead-stage catalogue: list, filter and dialog state.
 *
 * The four mutations live in `useLeadStageMutations` — the split
 * docs/architecture/file-architecture.md schedules for whichever phase next
 * edits this file, which task 8.17 is.
 */
export function useLeadStages() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.lead_stages.manage") ?? false;
  const [items, setItems] = useState<LeadStageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The catalogue fetch's own failure. Handed to DataTable so the error
  // state replaces the empty state rather than stacking with it.
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadStageItem | null>(
    null,
  );
  const [selectedForEdit, setSelectedForEdit] = useState<LeadStageItem | null>(
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

  const mutations = useLeadStageMutations({
    canManage,
    setItems,
    reconcile: reconcileCatalogue,
    notify: setError,
    onCreated: () => setIsCreateOpen(false),
  });

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.nameAr, item.nameEn, item.flag, item.category].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [items, searchQuery]);

  return {
    t,
    lang,
    items: filteredItems,
    isLoading,
    error,
    loadError,
    canManage,
    searchQuery,
    setSearchQuery,
    isCreating: mutations.isCreating,
    isDeleting: mutations.isDeleting,
    isUpdating: mutations.isUpdating,
    settingDefaultId: mutations.settingDefaultId,
    createError: mutations.createError,
    deleteError: mutations.deleteError,
    editError: mutations.editError,
    isCreateOpen,
    openCreate: () => {
      mutations.clearCreateError();
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (mutations.isCreating) return;
      mutations.clearCreateError();
      setIsCreateOpen(false);
    },
    selectedForDelete,
    openDelete: (stage: LeadStageItem) => {
      mutations.clearDeleteError();
      setSelectedForDelete(stage);
    },
    closeDelete: () => {
      if (mutations.isDeleting) return;
      mutations.clearDeleteError();
      setSelectedForDelete(null);
    },
    selectedForEdit,
    openEdit: (stage: LeadStageItem) => {
      if (!canManage) return;
      mutations.clearEditError();
      setSelectedForEdit(stage);
    },
    closeEdit: () => {
      if (mutations.isUpdating) return;
      mutations.clearEditError();
      setSelectedForEdit(null);
    },
    handleCreate: mutations.create,
    handleUpdate: async (form: UpdateLeadStageFormData): Promise<boolean> => {
      const target = selectedForEdit;
      if (!target) return false;
      const ok = await mutations.update(target, form);
      if (ok) setSelectedForEdit(null);
      return ok;
    },
    handleDelete: async () => {
      const target = selectedForDelete;
      if (!target) return;
      if (await mutations.remove(target)) setSelectedForDelete(null);
    },
    handleSetDefault: mutations.setDefault,
    fetchStages,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
