"use client";

import { useMemo, useState } from "react";
import type { MoveToTarget, PageInfo } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { escapeCsvCell } from "@/lib/export/csv-cell";
import { localizedName } from "@/lib/format/localized";
import type { OpportunityStage } from "../../hooks/pipeline-types";
import type { OpportunityListItem } from "../../hooks/useOpportunitiesList";

const SORT_OPTION_VALUES = [
  "createdAt:desc",
  "createdAt:asc",
  "amount:desc",
  "probabilityPercent:desc",
  "expectedCloseDate:asc",
  "title:asc",
] as const;

interface UseOpportunityExecutiveCardViewParams {
  items: readonly OpportunityListItem[];
  stages: readonly OpportunityStage[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  canUpdate: (item: OpportunityListItem) => boolean;
  canDelete: (item: OpportunityListItem) => boolean;
  page?: PageInfo;
  sort?: { id: string; direction: "asc" | "desc" };
  onSortChange?: (next: { id: string; direction: "asc" | "desc" }) => void;
  onBulkMoveStage: (stageId: string) => Promise<void>;
}

export function useOpportunityExecutiveCardView({
  items,
  stages,
  selectedIds,
  onSelectionChange,
  canUpdate: capabilityCanUpdate,
  canDelete: capabilityCanDelete,
  page,
  sort,
  onSortChange,
  onBulkMoveStage,
}: UseOpportunityExecutiveCardViewParams) {
  const { lang } = useI18n();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const [bulkStageValue, setBulkStageValue] = useState("");

  const canUpdateItem = (item: OpportunityListItem) =>
    canMutate && capabilityCanUpdate(item);
  const canDeleteItem = (item: OpportunityListItem) =>
    canMutate && capabilityCanDelete(item);
  const canExport =
    user?.permissions.includes("crm.opportunities.export") ?? false;

  const stageById = useMemo(
    () => new Map<string, OpportunityStage>(stages.map((st) => [st.id, st])),
    [stages],
  );

  const nonLostStages = useMemo(
    () => stages.filter((st) => st.flag !== "LOST"),
    [stages],
  );

  const selectedOnPageCount = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)).length,
    [items, selectedIds],
  );

  const canUpdateAny = useMemo(
    () =>
      items.some(
        (item) =>
          selectedIds.has(item.id) && canMutate && capabilityCanUpdate(item),
      ),
    [items, selectedIds, canMutate, capabilityCanUpdate],
  );

  const isAllSelected =
    items.length > 0 && selectedOnPageCount === items.length;
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

  function handleBulkStageChange(targetStageId: string) {
    setBulkStageValue("");
    if (targetStageId && canUpdateAny) {
      void onBulkMoveStage(targetStageId);
    }
  }

  function exportCsv() {
    if (!canExport) return;
    const rowsToExport = items.filter((item) => selectedIds.has(item.id));
    if (rowsToExport.length === 0) return;
    const header = [
      "ID",
      "Title",
      "Customer",
      "Status",
      "Amount",
      "Currency",
      "Probability",
      "ExpectedCloseDate",
      "Importance",
    ];
    const csvLines = [
      header.map(escapeCsvCell).join(","),
      ...rowsToExport.map((row) =>
        [
          row.id,
          row.title,
          row.customerCompanyName || row.customerDisplayName || "",
          row.status,
          row.amount ?? "",
          row.currencyCode ?? "",
          row.probabilityPercent ?? "",
          row.expectedCloseDate ?? "",
          row.importance,
        ]
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
    anchor.download = "mutakamel-crm-opportunities.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const rawSortValue = `${sort?.id ?? "createdAt"}:${sort?.direction ?? "desc"}`;
  const activeSortValue = SORT_OPTION_VALUES.includes(
    rawSortValue as (typeof SORT_OPTION_VALUES)[number],
  )
    ? rawSortValue
    : "createdAt:desc";

  function handleSortValueChange(nextValue: string) {
    const [rawId, rawDirection] = nextValue.split(":");
    onSortChange?.({
      id: rawId || "createdAt",
      direction: rawDirection === "asc" ? "asc" : "desc",
    });
  }

  function moveTargetsForItem(item: OpportunityListItem): MoveToTarget[] {
    return stages
      .filter((stage) => stage.id !== item.stageId)
      .map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));
  }

  const rangeFrom = items.length
    ? page
      ? (page.page - 1) * page.limit + 1
      : 1
    : 0;
  const rangeTo = (page ? (page.page - 1) * page.limit : 0) + items.length;
  const rangeTotal = page?.total ?? items.length;

  return {
    canMutate,
    canUpdateItem,
    canDeleteItem,
    canUpdateAny,
    canExport,
    stageById,
    nonLostStages,
    bulkStageValue,
    selectedOnPageCount,
    isAllSelected,
    isSomeSelected,
    toggleSelectAll,
    toggleOne,
    handleBulkStageChange,
    exportCsv,
    activeSortValue,
    handleSortValueChange,
    moveTargetsForItem,
    rangeFrom,
    rangeTo,
    rangeTotal,
  };
}
