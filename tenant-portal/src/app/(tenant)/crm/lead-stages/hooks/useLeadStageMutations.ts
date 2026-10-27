"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
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
import {
  NON_REPLAYABLE_MUTATION,
  isAmbiguousLeadStageMutation,
} from "./lead-stage-requests";
import { useLeadStageOrdering } from "./useLeadStageOrdering";

/**
 * What the mutations need from the catalogue they change.
 *
 * Kept to four members on purpose: the mutations own their own busy and error
 * state, and reach the list only to splice a confirmed result or to hand back
 * a notice the screen shows above the table.
 */
export interface LeadStageCataloguePort {
  canManage: boolean;
  setItems: Dispatch<SetStateAction<LeadStageItem[]>>;
  /** Refetches the catalogue; false when even that failed. */
  reconcile: () => Promise<boolean>;
  /** The screen-level notice, for outcomes no single dialog owns. */
  notify: (message: string) => void;
  onCreated: () => void;
}

/**
 * Create, update and delete for lead stages; reorder and set-default are
 * `useLeadStageOrdering`, composed in here so the screen sees one surface.
 *
 * Split out of `useLeadStages` here rather than as its own task: that hook is
 * the "~310 lines, marginal, split when next edited" entry in
 * docs/architecture/file-architecture.md#the-300-line-rule-and-its-three-exemptions,
 * and Phase 8 is the phase that next edited it — task 8.17 added the update.
 * The split follows the shape that page prescribes for `useLeads`: list state
 * in one hook, the mutations in another.
 */
export function useLeadStageMutations(catalogue: LeadStageCataloguePort) {
  const { t } = useI18n();
  const errorText = useCrmErrorText();
  const { canManage, setItems, reconcile, notify, onCreated } = catalogue;
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const ordering = useLeadStageOrdering(catalogue);

  const create = async (form: CreateLeadStageFormData): Promise<boolean> => {
    if (isCreating) return false;
    if (!canManage) {
      setCreateError(t.crmLeadStages.manageForbidden);
      return false;
    }
    let payload: ReturnType<typeof buildCreateLeadStageRequest>;
    try {
      payload = buildCreateLeadStageRequest(form);
    } catch {
      setCreateError(t.crmLeadStages.createInvalid);
      return false;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await axiosClient.post<unknown>(
        LEAD_STAGES_PATH,
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
        notify(
          (await reconcile())
            ? t.crmLeadStages.createInvalidResponseReloaded
            : t.crmLeadStages.createInvalidResponseStale,
        );
      }
      onCreated();
      return true;
    } catch (caught) {
      if (isAmbiguousLeadStageMutation(caught)) {
        const reloaded = await reconcile();
        onCreated();
        notify(
          `${errorText(normalizeApiError(caught))} ${reloaded
            ? t.crmLeadStages.createAmbiguousReloaded
            : t.crmLeadStages.createAmbiguousStale}`,
        );
      } else {
        setCreateError(errorText(normalizeApiError(caught)) ?? t.crmLeadStages.createFailed);
      }
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * `PATCH /lead-stages/:id` — task 8.17. Only changed fields are sent, and
   * the NEW-stage and default-stage protections are mirrored in the contract
   * builder so a refusal the server would issue never costs a round trip.
   */
  const update = async (
    target: LeadStageItem,
    form: UpdateLeadStageFormData,
  ): Promise<boolean> => {
    if (isUpdating) return false;
    if (!canManage) {
      setEditError(t.crmLeadStages.manageForbidden);
      return false;
    }
    let payload: Record<string, unknown>;
    try {
      payload = buildUpdateLeadStageRequest(form, target);
    } catch {
      setEditError(t.crmLeadStages.editInvalid);
      return false;
    }
    if (Object.keys(payload).length === 0) return true;
    setIsUpdating(true);
    setEditError(null);
    try {
      const response = await axiosClient.patch<unknown>(
        `${LEAD_STAGES_PATH}/${encodeURIComponent(target.id)}`,
        payload,
        NON_REPLAYABLE_MUTATION,
      );
      try {
        const updated = parseLeadStageResponse(response.data);
        setItems((current) =>
          current
            .map((stage) => (stage.id === updated.id ? updated : stage))
            .sort((left, right) => left.sortOrder - right.sortOrder),
        );
      } catch {
        notify(
          (await reconcile())
            ? t.crmLeadStages.editInvalidResponseReloaded
            : t.crmLeadStages.editInvalidResponseStale,
        );
      }
      return true;
    } catch (caught) {
      if (isAmbiguousLeadStageMutation(caught)) {
        notify(
          `${errorText(normalizeApiError(caught))} ${(await reconcile())
            ? t.crmLeadStages.editAmbiguousReloaded
            : t.crmLeadStages.editAmbiguousStale}`,
        );
        return true;
      }
      setEditError(errorText(normalizeApiError(caught)) ?? t.crmLeadStages.editFailed);
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const remove = async (target: LeadStageItem): Promise<boolean> => {
    if (isDeleting) return false;
    if (isProtectedLeadStage(target)) {
      setDeleteError(t.crmLeadStages.protectedHint);
      return false;
    }
    if (!canManage) {
      notify(t.crmLeadStages.manageForbidden);
      setDeleteError(null);
      return true;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await axiosClient.delete(
        `${LEAD_STAGES_PATH}/${encodeURIComponent(target.id)}`,
        NON_REPLAYABLE_MUTATION,
      );
      setItems((current) =>
        current
          .filter(({ id }) => id !== target.id)
          .map((stage, index) => ({ ...stage, sortOrder: index + 1 })),
      );
      return true;
    } catch (caught) {
      if (isAmbiguousLeadStageMutation(caught)) {
        notify(
          `${errorText(normalizeApiError(caught))} ${(await reconcile())
            ? t.crmLeadStages.deleteAmbiguousReloaded
            : t.crmLeadStages.deleteAmbiguousStale}`,
        );
        return true;
      }
      setDeleteError(errorText(normalizeApiError(caught)) ?? t.crmLeadStages.deleteFailed);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isCreating,
    isDeleting,
    isUpdating,
    ...ordering,
    createError,
    deleteError,
    editError,
    clearCreateError: () => setCreateError(null),
    clearDeleteError: () => setDeleteError(null),
    clearEditError: () => setEditError(null),
    create,
    update,
    remove,
  };
}
