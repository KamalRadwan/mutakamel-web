"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  isProtectedLeadStage,
  LEAD_STAGE_LIMIT,
  protectedLeadStageIds,
  type LeadStageItem,
  type UpdateLeadStageFormData,
} from "../lead-stage-contract";
import { readLeadStageCatalogue } from "../../shared/lead-stage-catalogue";
import { useLeadStageMutations } from "./useLeadStageMutations";

export type { LeadStageItem } from "../lead-stage-contract";

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
  const { canMutate } = useAccessMode();
  const canManage = canMutate && (user?.permissions.includes("crm.lead_stages.manage") ?? false);
  const [items, setItems] = useState<LeadStageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [needsReload, setNeedsReload] = useState(false);
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
      setItems(await readLeadStageCatalogue());
      setNeedsReload(false);
      return true;
    } catch {
      setNeedsReload(true);
      return false;
    }
  }, []);

  const fetchStages = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setLoadError(null);
    try {
      setItems(await readLeadStageCatalogue(signal));
      setNeedsReload(false);
    } catch (caught) {
      if (isAbortError(caught)) return;
      setItems([]);
      setNeedsReload(true);
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
    canManage: canManage && !isLoading && !needsReload && !loadError,
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
  const fixedStageIds = useMemo(() => protectedLeadStageIds(items), [items]);

  return {
    t,
    lang,
    items: filteredItems,
    isLoading,
    error,
    loadError,
    canManage,
    writesBlocked: isLoading || needsReload || loadError !== null || mutations.isMutating,
    atCapacity: items.length >= LEAD_STAGE_LIMIT,
    needsReload,
    searchQuery,
    setSearchQuery,
    // A reorder writes the WHOLE catalogue order, so it is driven by the
    // unfiltered list and the controls are suppressed while a search narrows
    // the view — the visible order would not be the order being written.
    isFiltered: searchQuery.trim().length > 0,
    fixedStageIds,
    isCreating: mutations.isCreating,
    isMutating: mutations.isMutating,
    isDeleting: mutations.isDeleting,
    isUpdating: mutations.isUpdating,
    isReordering: mutations.isReordering,
    settingDefaultId: mutations.settingDefaultId,
    createError: mutations.createError,
    deleteError: mutations.deleteError,
    deleteBlocked: mutations.deleteBlocked,
    editError: mutations.editError,
    isCreateOpen,
    openCreate: () => {
      if (!canManage || isLoading || needsReload || loadError || mutations.isMutating || items.length >= LEAD_STAGE_LIMIT) return;
      mutations.clearCreateError();
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (mutations.isCreating) return;
      mutations.clearCreateError();
      setIsCreateOpen(false);
    },
    selectedForDelete: items.find(({ id }) => id === selectedForDelete?.id) ?? selectedForDelete,
    openDelete: (stage: LeadStageItem) => {
      if (!canManage || isLoading || needsReload || loadError || mutations.isMutating || isProtectedLeadStage(stage) || stage.isDefault) return;
      mutations.clearDeleteError();
      setSelectedForDelete(stage);
    },
    closeDelete: () => {
      if (mutations.isDeleting) return;
      mutations.clearDeleteError();
      setSelectedForDelete(null);
    },
    selectedForEdit: items.find(({ id }) => id === selectedForEdit?.id) ?? selectedForEdit,
    openEdit: (stage: LeadStageItem) => {
      if (!canManage || isLoading || needsReload || loadError || mutations.isMutating || isProtectedLeadStage(stage)) return;
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
      const target = items.find(({ id }) => id === selectedForEdit?.id) ?? selectedForEdit;
      if (!target) return false;
      const ok = await mutations.update(target, form);
      if (ok) setSelectedForEdit(null);
      return ok;
    },
    handleDelete: async () => {
      const target = items.find(({ id }) => id === selectedForDelete?.id) ?? selectedForDelete;
      if (!target) return;
      if (await mutations.remove(target)) setSelectedForDelete(null);
    },
    handleSetDefault: mutations.setDefault,
    // The table hands back the whole visible order; it is the unfiltered
    // catalogue that is validated against and re-ranked.
    handleReorder: (orderedIds: string[]) => mutations.reorder(items, orderedIds),
    fetchStages,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
