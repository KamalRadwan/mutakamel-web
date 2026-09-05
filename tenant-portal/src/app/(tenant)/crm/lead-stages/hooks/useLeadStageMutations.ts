"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import {
  buildCreateLeadStageRequest,
  buildLeadStageReorderRequest,
  buildUpdateLeadStageRequest,
  parseLeadStageCatalogueResponse,
  parseLeadStageResponse,
  type CreateLeadStageFormData,
  type LeadStageItem,
  type UpdateLeadStageFormData,
} from "../lead-stage-contract";

const CATALOGUE_PATH = "/api/tenant/crm/v1/lead-stages";
const REORDER_PATH = `${CATALOGUE_PATH}/reorder`;
const NON_REPLAYABLE_MUTATION = {
  nonReplayable: true,
  skipAutoIdempotency: true,
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
} as const;
// Reorder is the one write here the Gateway declares `idempotent: true`
// (crm.lead.stages.reorder.patch), and it answers IDEM_MISSING without the
// key — so auto-idempotency stays on and the replay of a retried drop is the
// server's job, not a second reordering.
const REPLAYABLE_MUTATION = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
} as const;

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
 * Create, update, delete and set-default for lead stages.
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
  const { canManage, setItems, reconcile, notify, onCreated } = catalogue;
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const create = async (form: CreateLeadStageFormData): Promise<boolean> => {
    if (isCreating) return false;
    if (!canManage) {
      setCreateError(t.crmLeadStages.manageForbidden);
      return false;
    }
    let payload: ReturnType<typeof buildCreateLeadStageRequest>;
    try {
      payload = buildCreateLeadStageRequest(form);
    } catch (caught) {
      setCreateError(errorMessage(caught, t.crmLeadStages.createInvalid));
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
        notify(
          (await reconcile())
            ? t.crmLeadStages.createInvalidResponseReloaded
            : t.crmLeadStages.createInvalidResponseStale,
        );
      }
      onCreated();
      return true;
    } catch (caught) {
      if (isAmbiguousMutationError(caught)) {
        const reloaded = await reconcile();
        onCreated();
        notify(
          reloaded
            ? t.crmLeadStages.createAmbiguousReloaded
            : t.crmLeadStages.createAmbiguousStale,
        );
      } else {
        setCreateError(errorMessage(caught, t.crmLeadStages.createFailed));
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
        `${CATALOGUE_PATH}/${encodeURIComponent(target.id)}`,
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
      if (isAmbiguousMutationError(caught)) {
        notify(
          (await reconcile())
            ? t.crmLeadStages.editAmbiguousReloaded
            : t.crmLeadStages.editAmbiguousStale,
        );
        return true;
      }
      setEditError(errorMessage(caught, t.crmLeadStages.editFailed));
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const remove = async (target: LeadStageItem): Promise<boolean> => {
    if (isDeleting) return false;
    if (!canManage) {
      notify(t.crmLeadStages.manageForbidden);
      setDeleteError(null);
      return true;
    }
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
      return true;
    } catch (caught) {
      if (isAmbiguousMutationError(caught)) {
        notify(
          (await reconcile())
            ? t.crmLeadStages.deleteAmbiguousReloaded
            : t.crmLeadStages.deleteAmbiguousStale,
        );
        return true;
      }
      setDeleteError(errorMessage(caught, t.crmLeadStages.deleteFailed));
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * `PATCH /lead-stages/reorder` — the drop, and the earlier/later buttons.
   *
   * The body is the COMPLETE order, every non-deleted stage exactly once:
   * `sortOrder` is a field the server owns and there is no per-stage rank to
   * PATCH — sending individual updates races and can leave two stages sharing a
   * rank (docs/api/crm-catalogues.md).
   */
  const reorder = async (
    stages: readonly LeadStageItem[],
    orderedIds: string[],
  ): Promise<void> => {
    if (isReordering) return;
    if (!canManage) {
      notify(t.crmLeadStages.manageForbidden);
      return;
    }
    let payload: ReturnType<typeof buildLeadStageReorderRequest>;
    try {
      payload = buildLeadStageReorderRequest(stages, orderedIds);
    } catch {
      notify(t.crmLeadStages.reorderInvalid);
      return;
    }
    const previous = [...stages];
    setIsReordering(true);
    // Optimistic: the row lands where it was dropped, re-ranked exactly the way
    // the endpoint renumbers — dense and one-based.
    setItems(
      payload.orderedIds.map((id, index) => ({
        ...previous.find((stage) => stage.id === id)!,
        sortOrder: index + 1,
      })),
    );
    try {
      const response = await axiosClient.patch<unknown>(
        REORDER_PATH,
        payload,
        REPLAYABLE_MUTATION,
      );
      setItems(parseLeadStageCatalogueResponse(response.data));
    } catch (caught) {
      // Roll back AND say why: a silent revert leaves the user watching their
      // own change undo itself (docs/design/states.md, state 8).
      setItems(previous);
      notify(errorMessage(caught, t.crmLeadStages.reorderFailed));
      await reconcile();
    } finally {
      setIsReordering(false);
    }
  };

  const setDefault = async (stage: LeadStageItem): Promise<void> => {
    // CONVERTED can never be the default (LEAD_STAGE_DEFAULT_CONVERTED) and an
    // inactive stage cannot either (LEAD_STAGE_DEFAULT_INACTIVE).
    if (
      !stage.isActive ||
      stage.isDefault ||
      stage.flag === "CONVERTED" ||
      settingDefaultId
    ) {
      return;
    }
    if (!canManage) {
      notify(t.crmLeadStages.manageForbidden);
      return;
    }
    setSettingDefaultId(stage.id);
    try {
      const response = await axiosClient.post<unknown>(
        `${CATALOGUE_PATH}/${encodeURIComponent(stage.id)}/default`,
        undefined,
        NON_REPLAYABLE_MUTATION,
      );
      try {
        const updated = parseLeadStageResponse(response.data);
        // Exactly one stage is default, so the flag moves rather than toggling.
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === updated.id
              ? { ...updated, isDefault: true }
              : { ...candidate, isDefault: false },
          ),
        );
      } catch {
        notify(
          (await reconcile())
            ? t.crmLeadStages.defaultInvalidResponseReloaded
            : t.crmLeadStages.defaultInvalidResponseStale,
        );
      }
    } catch (caught) {
      await reconcile();
      notify(errorMessage(caught, t.crmLeadStages.defaultFailed));
    } finally {
      setSettingDefaultId(null);
    }
  };

  return {
    isCreating,
    isDeleting,
    isUpdating,
    isReordering,
    settingDefaultId,
    createError,
    deleteError,
    editError,
    clearCreateError: () => setCreateError(null),
    clearDeleteError: () => setDeleteError(null),
    clearEditError: () => setEditError(null),
    create,
    update,
    remove,
    reorder,
    setDefault,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}
