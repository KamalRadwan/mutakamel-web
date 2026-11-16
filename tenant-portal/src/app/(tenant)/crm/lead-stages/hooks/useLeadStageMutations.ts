"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import {
  LEAD_STAGES_PATH,
  buildCreateLeadStageRequest,
  buildUpdateLeadStageRequest,
  isProtectedLeadStage,
  parseLeadStageResponse,
  type CreateLeadStageFormData,
  type LeadStageItem,
  type UpdateLeadStageFormData,
} from "../lead-stage-contract";
import { NON_REPLAYABLE_MUTATION, isAmbiguousLeadStageMutation } from "./lead-stage-requests";
import { useLeadStageErrorText } from "./useLeadStageErrorText";
import { useLeadStageOrdering } from "./useLeadStageOrdering";

export interface LeadStageCataloguePort {
  canManage: boolean;
  setItems: Dispatch<SetStateAction<LeadStageItem[]>>;
  reconcile: () => Promise<boolean>;
  notify: (message: string) => void;
  onCreated: () => void;
}

export function useLeadStageMutations(catalogue: LeadStageCataloguePort) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useLeadStageErrorText();
  const { canManage, setItems, reconcile, notify, onCreated } = catalogue;
  const lock = useRef(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // A ref closes the double-click window before React commits pending state.
  const beginWrite = () => {
    if (!canManage || lock.current) return false;
    lock.current = true;
    setIsMutating(true);
    return true;
  };
  const endWrite = () => {
    lock.current = false;
    setIsMutating(false);
  };
  const ordering = useLeadStageOrdering({ ...catalogue, beginWrite, endWrite });

  const create = async (form: CreateLeadStageFormData): Promise<boolean> => {
    if (!canManage) return false;
    let payload: ReturnType<typeof buildCreateLeadStageRequest>;
    try { payload = buildCreateLeadStageRequest(form); }
    catch { setCreateError(t.crmLeadStages.createInvalid); return false; }
    if (!beginWrite()) return false;
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await axiosClient.post<unknown>(LEAD_STAGES_PATH, payload, NON_REPLAYABLE_MUTATION);
      try {
        parseLeadStageResponse(response.data);
      } catch {
        notify((await reconcile()) ? t.crmLeadStages.createAmbiguousReloaded : t.crmLeadStages.createAmbiguousStale);
        onCreated();
        return false;
      }
      // Creation inserts before terminal anchors, changing their ranks too.
      // Only the complete read can confirm the resulting catalogue order.
      if (await reconcile()) toast.success(t.crmLeadStages.stageCreated);
      else notify(t.crmLeadStages.createRefreshFailed);
      onCreated();
      return true;
    } catch (caught) {
      if (isAmbiguousLeadStageMutation(caught)) {
        notify((await reconcile()) ? t.crmLeadStages.createAmbiguousReloaded : t.crmLeadStages.createAmbiguousStale);
        onCreated();
      } else {
        const failure = normalizeApiError(caught);
        if (failure.code === "LEAD_STAGE_LIMIT_EXCEEDED") {
          await reconcile();
          notify(errorText(failure));
          onCreated();
        } else setCreateError(errorText(failure));
      }
      return false;
    } finally {
      setIsCreating(false);
      endWrite();
    }
  };

  const update = async (target: LeadStageItem, form: UpdateLeadStageFormData): Promise<boolean> => {
    if (!canManage) return false;
    let payload: Record<string, unknown>;
    try { payload = buildUpdateLeadStageRequest(form, target); }
    catch { setEditError(t.crmLeadStages.editInvalid); return false; }
    if (Object.keys(payload).length === 0) return true;
    if (!beginWrite()) return false;
    setIsUpdating(true);
    setEditError(null);
    try {
      const response = await axiosClient.patch<unknown>(`${LEAD_STAGES_PATH}/${encodeURIComponent(target.id)}`, payload, NON_REPLAYABLE_MUTATION);
      try {
        const updated = parseLeadStageResponse(response.data, target.id);
        setItems((current) => current.map((stage) => stage.id === updated.id ? updated : stage));
        toast.success(t.crmLeadStages.stageSaved);
      } catch {
        notify((await reconcile()) ? t.crmLeadStages.editAmbiguousReloaded : t.crmLeadStages.editAmbiguousStale);
      }
      return true;
    } catch (caught) {
      if (isAmbiguousLeadStageMutation(caught)) {
        notify((await reconcile()) ? t.crmLeadStages.editAmbiguousReloaded : t.crmLeadStages.editAmbiguousStale);
        return true;
      }
      const failure = normalizeApiError(caught);
      if (failure.status === 404 || failure.status === 409 || failure.status === 422) await reconcile();
      if (failure.status === 404 || failure.code === "LEAD_STAGE_PROTECTED") {
        notify(errorText(failure));
        return true;
      }
      setEditError(errorText(failure));
      return false;
    } finally {
      setIsUpdating(false);
      endWrite();
    }
  };

  const remove = async (target: LeadStageItem): Promise<boolean> => {
    if (!canManage) return false;
    if (isProtectedLeadStage(target) || target.isDefault) {
      setDeleteError(isProtectedLeadStage(target) ? t.crmLeadStages.protectedHint : t.crmConfigActionHints.defaultStageDelete);
      return false;
    }
    if (!beginWrite()) return false;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteBlocked(false);
    try {
      await axiosClient.delete(`${LEAD_STAGES_PATH}/${encodeURIComponent(target.id)}`, NON_REPLAYABLE_MUTATION);
      setItems((current) => current.filter(({ id }) => id !== target.id).map((stage, index) => ({ ...stage, sortOrder: index + 1 })));
      toast.success(t.crmLeadStages.stageDeleted);
      return true;
    } catch (caught) {
      if (isAmbiguousLeadStageMutation(caught)) {
        notify((await reconcile()) ? t.crmLeadStages.deleteAmbiguousReloaded : t.crmLeadStages.deleteAmbiguousStale);
        return true;
      }
      const failure = normalizeApiError(caught);
      if (failure.status === 404 || failure.status === 409 || failure.status === 422) await reconcile();
      if (failure.status === 404 || failure.status === 422) {
        notify(errorText(failure));
        return true;
      }
      setDeleteError(errorText(failure));
      setDeleteBlocked(failure.code === "LEAD_STAGE_IN_USE");
      return false;
    } finally {
      setIsDeleting(false);
      endWrite();
    }
  };

  return {
    isMutating, isCreating, isDeleting, isUpdating, ...ordering,
    createError, deleteError, deleteBlocked, editError,
    clearCreateError: () => setCreateError(null),
    clearDeleteError: () => { setDeleteError(null); setDeleteBlocked(false); },
    clearEditError: () => setEditError(null),
    create, update, remove,
  };
}
