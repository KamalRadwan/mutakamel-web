"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
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
} from "./lead-stage-requests";
import type { LeadStageCataloguePort } from "./useLeadStageMutations";

/** Reorder and set-default: the two writes that move a flag or a rank across the whole catalogue. */
export function useLeadStageOrdering({
  canManage,
  setItems,
  reconcile,
  notify,
}: Omit<LeadStageCataloguePort, "onCreated">) {
  const { t } = useI18n();
  const errorText = useCrmErrorText();
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
      setItems(parseLeadStageCatalogueResponse(response.data));
    } catch (caught) {
      // Roll back AND say why: a silent revert leaves the user watching their
      // own change undo itself (docs/design/states.md, state 8).
      setItems(previous);
      notify(errorText(normalizeApiError(caught)) ?? t.crmLeadStages.reorderFailed);
      await reconcile();
    } finally {
      setIsReordering(false);
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
    setSettingDefaultId(stage.id);
    try {
      const response = await axiosClient.post<unknown>(
        `${LEAD_STAGES_PATH}/${encodeURIComponent(stage.id)}/default`,
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
      notify(errorText(normalizeApiError(caught)) ?? t.crmLeadStages.defaultFailed);
    } finally {
      setSettingDefaultId(null);
    }
  };

  return { isReordering, settingDefaultId, reorder, setDefault };
}
