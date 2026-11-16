"use client";

import { useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import {
  ACQUISITION_SOURCES_PATH, MAX_ACQUISITION_SOURCES, acquisitionSourcePath,
  buildCreateAcquisitionSourceRequest, parseAcquisitionSourceResponse,
  type AcquisitionSource, type CreateAcquisitionSourceInput,
} from "../acquisition-source-contract";
import { useAcquisitionSourceErrors } from "./useAcquisitionSourceErrors";

export function useAcquisitionSourceMutations(
  canManage: boolean,
  count: number,
  reload: () => Promise<boolean>,
  applyCreate: (source: AcquisitionSource) => void,
  applyDelete: (id: string) => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useAcquisitionSourceErrors();
  const busy = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<AcquisitionSource | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  async function uncertain(error: unknown, operation: "create" | "delete") {
    if (error instanceof TenantApiClientError && error.response.status > 0 && error.response.status < 500) return false;
    const refreshed = await reload();
    const messages = {
      create: refreshed ? t.crmAcquisitionSources.createUncertain : t.crmAcquisitionSources.createUncertainStale,
      delete: refreshed ? t.crmAcquisitionSources.deleteUncertain : t.crmAcquisitionSources.deleteUncertainStale,
    };
    setIsCreateOpen(false);
    setSelectedForDelete(null);
    setMutationError(messages[operation]);
    return true;
  }

  async function handleCreate(input: CreateAcquisitionSourceInput): Promise<boolean> {
    if (busy.current) return false;
    if (!canManage) { setMutationError(t.crmAcquisitionSources.iconForbidden); return false; }
    if (count >= MAX_ACQUISITION_SOURCES) { setMutationError(t.crmAcquisitionSources.limitReached); return false; }
    let payload: CreateAcquisitionSourceInput;
    try { payload = buildCreateAcquisitionSourceRequest(input); }
    catch { setMutationError(t.crmAcquisitionSources.invalidNames); return false; }
    busy.current = true;
    setIsCreating(true);
    setMutationError(null);
    try {
      const response = await axiosClient.post<unknown>(ACQUISITION_SOURCES_PATH, payload, {
        cache: "no-store", maxResponseBytes: 100_000, nonReplayable: true, skipAutoIdempotency: true,
      });
      applyCreate(parseAcquisitionSourceResponse(response.data));
      setIsCreateOpen(false);
      toast.success(t.crmAcquisitionSources.created);
      await reload();
      return true;
    } catch (error) {
      if (!await uncertain(error, "create")) {
        setMutationError(errorText(normalizeApiError(error)) ?? t.crmAcquisitionSources.createFailed);
      }
      return false;
    } finally { busy.current = false; setIsCreating(false); }
  }

  async function handleDelete() {
    if (!selectedForDelete || busy.current || deleteBlocked) return;
    if (!canManage) { setMutationError(t.crmAcquisitionSources.iconForbidden); setSelectedForDelete(null); return; }
    const id = selectedForDelete.id;
    busy.current = true;
    setIsDeleting(true);
    setMutationError(null);
    try {
      await axiosClient.delete(acquisitionSourcePath(id), {
        cache: "no-store", maxResponseBytes: 10_000, nonReplayable: true, skipAutoIdempotency: true,
      });
      applyDelete(id);
      setSelectedForDelete(null);
      toast.success(t.crmAcquisitionSources.deleted);
      await reload();
    } catch (error) {
      if (!await uncertain(error, "delete")) {
        const failure = normalizeApiError(error);
        setDeleteBlocked(failure.code === "CRM_ACQUISITION_SOURCE_IN_USE");
        setMutationError(errorText(failure) ?? t.crmAcquisitionSources.deleteFailed);
        if (failure.status === 404) { setSelectedForDelete(null); await reload(); }
      }
    } finally { busy.current = false; setIsDeleting(false); }
  }

  return {
    isCreating, isDeleting, isCreateOpen, selectedForDelete, mutationError, deleteBlocked,
    setMutationError, handleCreate, handleDelete,
    openCreate: () => {
      if (!canManage || busy.current || count >= MAX_ACQUISITION_SOURCES) return;
      setMutationError(null); setIsCreateOpen(true);
    },
    closeCreate: () => { if (!busy.current) { setMutationError(null); setIsCreateOpen(false); } },
    selectForDelete: (source: AcquisitionSource) => {
      if (!canManage || busy.current) return;
      setMutationError(null); setDeleteBlocked(false); setSelectedForDelete(source);
    },
    closeDelete: () => {
      if (!busy.current) { setMutationError(null); setDeleteBlocked(false); setSelectedForDelete(null); }
    },
  };
}
