"use client";

import { useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { useLeadStageErrorText } from "./useLeadStageErrorText";
import {
  LEAD_STAGES_PATH,
  buildLeadStageReorderRequest,
  canBeDefaultLeadStage,
  parseLeadStageCatalogueResponse,
  parseLeadStageResponse,
  type LeadStageItem,
} from "../lead-stage-contract";
import {
  LEAD_STAGES_REORDER_PATH,
  NON_REPLAYABLE_MUTATION,
  REPLAYABLE_MUTATION,
  isAmbiguousLeadStageMutation,
} from "./lead-stage-requests";
import type { LeadStageCataloguePort } from "./useLeadStageMutations";

/** Reorder and set-default: the two writes that move a flag or a rank across the whole catalogue. */
export function useLeadStageOrdering({
  canManage,
  setItems,
  reconcile,
  notify,
  beginWrite,
  endWrite,
}: Omit<LeadStageCataloguePort, "onCreated"> & { beginWrite: () => boolean; endWrite: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useLeadStageErrorText();
  const [isReordering, setIsReordering] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

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
    if (!beginWrite()) return;
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
        LEAD_STAGES_REORDER_PATH,
        payload,
        REPLAYABLE_MUTATION,
      );
      const confirmed = parseLeadStageCatalogueResponse(response.data);
      if (confirmed.length !== orderedIds.length || confirmed.some((stage, index) => stage.id !== orderedIds[index])) {
        throw new Error("Invalid reordered catalogue.");
      }
      setItems(confirmed);
      toast.success(t.crmLeadStages.orderSaved);
    } catch (caught) {
      // Roll back AND say why: a silent revert leaves the user watching their
      // own change undo itself (docs/design/states.md, state 8).
      setItems(previous);
      notify(`${t.crmLeadStages.orderRestored} ${errorText(normalizeApiError(caught))}`);
      await reconcile();
    } finally {
      setIsReordering(false);
      endWrite();
    }
  };

  const setDefault = async (stage: LeadStageItem): Promise<void> => {
    // Terminal anchors can never be the default and an inactive stage cannot
    // either. The service repeats this rule authoritatively.
    if (
      !canBeDefaultLeadStage(stage) ||
      stage.isDefault ||
      settingDefaultId
    ) {
      return;
    }
    if (!canManage) {
      notify(t.crmLeadStages.manageForbidden);
      return;
    }
    if (!beginWrite()) return;
    setSettingDefaultId(stage.id);
    try {
      const response = await axiosClient.post<unknown>(
        `${LEAD_STAGES_PATH}/${encodeURIComponent(stage.id)}/default`,
        undefined,
        NON_REPLAYABLE_MUTATION,
      );
      try {
        const updated = parseLeadStageResponse(response.data, stage.id);
        if (!updated.isDefault || !canBeDefaultLeadStage(updated)) throw new Error("Invalid default stage.");
        // Exactly one stage is default, so the flag moves rather than toggling.
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === updated.id
              ? { ...updated, isDefault: true }
              : { ...candidate, isDefault: false },
          ),
        );
        toast.success(t.crmLeadStages.defaultSaved);
      } catch {
        notify(
          (await reconcile())
            ? t.crmLeadStages.defaultAmbiguousReloaded
            : t.crmLeadStages.defaultAmbiguousStale,
        );
      }
    } catch (caught) {
      const refreshed = await reconcile();
      notify(isAmbiguousLeadStageMutation(caught)
        ? refreshed ? t.crmLeadStages.defaultAmbiguousReloaded : t.crmLeadStages.defaultAmbiguousStale
        : errorText(normalizeApiError(caught)));
    } finally {
      setSettingDefaultId(null);
      endWrite();
    }
  };

  return { isReordering, settingDefaultId, reorder, setDefault };
}
