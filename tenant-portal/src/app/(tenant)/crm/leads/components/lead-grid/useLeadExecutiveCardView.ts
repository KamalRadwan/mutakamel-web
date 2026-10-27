"use client";

import { useMemo } from "react";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { escapeCsvCell } from "@/lib/export/csv-cell";
import { localizedName } from "@/lib/format/localized";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import type { LeadCardMoveTarget } from "../lead-card/LeadCardMenu";

const SORT_OPTION_VALUES = ["createdAt:desc", "createdAt:asc", "displayName:asc", "displayName:desc"] as const;

interface UseLeadExecutiveCardViewParams {
  items: readonly LeadItem[];
  stages: readonly LeadStage[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  sort?: { id: string; direction: "asc" | "desc" };
  onSortChange?: (next: { id: string; direction: "asc" | "desc" }) => void;
}

export function useLeadExecutiveCardView({
  items,
  stages,
  selectedIds,
  onSelectionChange,
  canUpdate: capabilityCanUpdate,
  canDelete: capabilityCanDelete,
  sort,
  onSortChange,
}: UseLeadExecutiveCardViewParams) {
  const { lang } = useI18n();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();

  const canUpdateLead = (lead: LeadItem) => canMutate && capabilityCanUpdate(lead);
  const canDeleteLead = (lead: LeadItem) => canMutate && capabilityCanDelete(lead);
  const canOpenActivities = canMutate && canCreateActivities(user);
  const canExport = user?.permissions.includes("crm.leads.export") ?? false;

  const stageById = useMemo(
    () => new Map<string, LeadStage>(stages.map((stage) => [stage.id, stage])),
    [stages],
  );

  // Converted leads are terminal; non-converted stages remain valid Move-to targets.
  const nonTerminalStages = useMemo(
    () => stages.filter((stage) => stage.flag !== "CONVERTED"),
    [stages],
  );

  const selectedOnPageCount = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)).length,
    [items, selectedIds],
  );
  const isAllSelected = items.length > 0 && selectedOnPageCount === items.length;
  const isSomeSelected = selectedOnPageCount > 0 && !isAllSelected;

  function toggleSelectAll() {
    if (isAllSelected) {
      onSelectionChange(new Set());
      return;
    }
    onSelectionChange(new Set(items.map((item) => item.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  function exportCsv() {
    if (!canExport) return;
    const rowsToExport = items.filter((item) => selectedIds.has(item.id));
    if (rowsToExport.length === 0) return;

    const header = ["ID", "Name", "Type", "Phone", "Email", "Country", "Rating"];
    const csvLines = [
      header.map(escapeCsvCell).join(","),
      ...rowsToExport.map((row) =>
        [row.id, row.leadName, row.leadProfileType, row.phone, row.email, row.country, row.rating]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF", csvLines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mutakamel-crm-leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const rawSortValue = `${sort?.id ?? "createdAt"}:${sort?.direction ?? "desc"}`;
  const activeSortValue =
    SORT_OPTION_VALUES.includes(rawSortValue as (typeof SORT_OPTION_VALUES)[number])
      ? rawSortValue
      : "createdAt:desc";

  function handleSortValueChange(nextValue: string) {
    if (!onSortChange) return;
    const [rawId, rawDirection] = nextValue.split(":");
    onSortChange({
      id: rawId === "displayName" ? "displayName" : "createdAt",
      direction: rawDirection === "asc" ? "asc" : "desc",
    });
  }

  function moveTargetsForLead(lead: LeadItem): LeadCardMoveTarget[] {
    return nonTerminalStages
      .filter((stage) => stage.id !== lead.stageId)
      .map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));
  }

  return {
    canUpdateLead,
    canDeleteLead,
    canOpenActivities,
    canExport,
    stageById,
    selectedOnPageCount,
    isAllSelected,
    isSomeSelected,
    toggleSelectAll,
    toggleOne,
    exportCsv,
    activeSortValue,
    handleSortValueChange,
    moveTargetsForLead,
  };
}
