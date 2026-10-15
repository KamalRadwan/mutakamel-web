"use client";

import { useMemo, useState } from "react";
import type { SelectionState } from "@/design-system";
import { MAX_LEAD_RATING } from "../lead-card-contract";
import type { BulkLeadFieldsPatch } from "../lead-bulk-contract";
import type { LeadItem, LeadStage } from "./useLeads";

// A converted lead is finished: the backend refuses moving a lead into a
// CONVERTED stage, so the bulk move never offers it — docs/api/crm-leads.md.
const TERMINAL_STAGE_FLAG = "CONVERTED";

export type LeadBulkKind = "stage" | "rating" | "delete";

interface LeadBulkDraft {
  kind: LeadBulkKind;
  stageId: string;
  rating: number;
}

interface LeadsWorkspaceBulkOptions {
  items: readonly LeadItem[];
  stages: readonly LeadStage[];
  selection: SelectionState;
  canUpdateLead: (lead: LeadItem) => boolean;
  canDeleteLead: (lead: LeadItem) => boolean;
  bulkMoveStage: (leadIds: readonly string[], stageId: string) => Promise<boolean>;
  bulkUpdateLeads: (leadIds: readonly string[], patch: BulkLeadFieldsPatch) => Promise<boolean>;
  bulkDeleteLeads: (leadIds: readonly string[]) => Promise<boolean>;
}

/**
 * The selected Card/Table rows and the three bulk writes over them.
 *
 * Every write is confirmed in a dialog first: a bulk write is where the user
 * needs to see its scope before committing. The selection is cleared only
 * when the write succeeded, so a refused batch can be retried as it was; the
 * failure itself is reported by `useLeads` in the page's alert.
 */
export function useLeadsWorkspaceBulk({
  items,
  stages,
  selection,
  canUpdateLead,
  canDeleteLead,
  bulkMoveStage,
  bulkUpdateLeads,
  bulkDeleteLeads,
}: LeadsWorkspaceBulkOptions) {
  const { selectedIds, onSelectionChange } = selection;
  const [draft, setDraft] = useState<LeadBulkDraft | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const moveStages = useMemo(
    () => stages.filter((stage) => stage.flag !== TERMINAL_STAGE_FLAG),
    [stages],
  );
  const selected = items.filter((item) => selectedIds.has(item.id));

  async function run(write: (leadIds: string[]) => Promise<boolean>): Promise<void> {
    setIsBusy(true);
    try {
      if (await write([...selectedIds])) onSelectionChange(new Set());
    } finally {
      setIsBusy(false);
      setDraft(null);
    }
  }

  const moveStage = (stageId: string) => run((leadIds) => bulkMoveStage(leadIds, stageId));

  function confirm(): void {
    if (!draft) return;
    if (draft.kind === "stage") void moveStage(draft.stageId);
    if (draft.kind === "rating") void run((leadIds) => bulkUpdateLeads(leadIds, { rating: draft.rating }));
    if (draft.kind === "delete") void run(bulkDeleteLeads);
  }

  return {
    count: selectedIds.size,
    canUpdate: selected.some(canUpdateLead),
    canDelete: selected.some(canDeleteLead),
    moveStages,
    isBusy,
    draft,
    open: (kind: LeadBulkKind) =>
      setDraft({ kind, stageId: moveStages[0]?.id ?? "", rating: MAX_LEAD_RATING }),
    setStageId: (stageId: string) => setDraft((current) => current && { ...current, stageId }),
    setRating: (rating: number) => setDraft((current) => current && { ...current, rating }),
    cancel: () => {
      if (!isBusy) setDraft(null);
    },
    confirm,
    moveStage,
    clear: () => onSelectionChange(new Set()),
  };
}

export type LeadsWorkspaceBulk = ReturnType<typeof useLeadsWorkspaceBulk>;
