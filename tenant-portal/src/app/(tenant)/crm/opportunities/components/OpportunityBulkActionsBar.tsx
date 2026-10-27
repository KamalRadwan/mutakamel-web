"use client";

import { useState } from "react";
import { ArrowUpRight, Star, Trash2, X } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import type { OpportunityStage } from "../hooks/pipeline-types";

export interface OpportunityBulkActionsBarProps {
  selectedIds: ReadonlySet<string>;
  stages: readonly OpportunityStage[];
  canUpdateAny: boolean;
  deletableCount: number;
  isBulkDeleting: boolean;
  onBulkMoveStage: (stageId: string) => Promise<void>;
  onBulkSetImportance: (importance: number) => Promise<void>;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

/**
 * Bulk controls operate on the selection; per-record edits stay on each card.
 */
export function OpportunityBulkActionsBar({
  selectedIds,
  stages,
  canUpdateAny,
  deletableCount,
  isBulkDeleting,
  onBulkMoveStage,
  onBulkSetImportance,
  onBulkDelete,
  onClearSelection,
}: OpportunityBulkActionsBarProps) {
  const { t, lang } = useI18n();
  const [isActionBusy, setIsBusy] = useState(false);
  const isBusy = isActionBusy || isBulkDeleting;
  const [stageSelect, setStageSelect] = useState("");
  const [importanceSelect, setImportanceSelect] = useState("");

  const count = selectedIds.size;
  if (count === 0) return null;

  function handleMove(stageId: string) {
    if (!stageId || isBusy || !canUpdateAny) return;
    setStageSelect("");
    void onBulkMoveStage(stageId);
  }

  async function handleImportance(value: string) {
    if (!value || isBusy) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setIsBusy(true);
    try {
      await onBulkSetImportance(parsed);
    } finally {
      setImportanceSelect("");
      setIsBusy(false);
    }
  }

  return (
    <div
      role="region"
      aria-label={t.crmOpportunities.bulkActions}
      className="fixed inset-x-0 bottom-5 z-(--z-overlay) mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-popover px-4 py-2.5 text-popover-foreground shadow-2xl"
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="inline-flex size-6 items-center justify-center rounded-lg bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
          {count}
        </span>
        <span>{t.crmOpportunities.selectedOpportunities}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canUpdateAny && stages.length > 0 && (
          <div className="relative inline-flex items-center">
            <ArrowUpRight className="pointer-events-none absolute start-2.5 size-3.5 text-primary-foreground" aria-hidden="true" />
            <select
              aria-label={t.crmOpportunities.bulkMoveStage}
              value={stageSelect}
              disabled={isBusy}
              onChange={(e) => {
                const nextStageId = e.target.value;
                e.currentTarget.value = "";
                handleMove(nextStageId);
              }}
              className="h-8 cursor-pointer rounded-lg bg-primary ps-7 pe-3 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <option value="">
                {t.crmOpportunities.moveStageCount.replace("{count}", formatNumber(count, lang))}
              </option>
              {stages
                .filter((st) => st.flag !== "LOST")
                .map((stage) => (
                  <option key={stage.id} value={stage.id} className="bg-popover text-popover-foreground">
                    {localizedName(stage, lang)}
                  </option>
                ))}
            </select>
          </div>
        )}

        {canUpdateAny && (
          <div className="relative inline-flex items-center">
            <Star className="pointer-events-none absolute start-2.5 size-3.5 text-warning" aria-hidden="true" />
            <select
              aria-label={t.crmOpportunities.bulkSetImportance}
              value={importanceSelect}
              disabled={isBusy}
              onChange={(e) => void handleImportance(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-border bg-muted ps-7 pe-2.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
            >
              <option value="">
                {t.crmOpportunities.bulkSetImportance}
              </option>
              <option value="3">★★★ (3)</option>
              <option value="2">★★☆ (2)</option>
              <option value="1">★☆☆ (1)</option>
              <option value="0">☆☆☆ (0)</option>
            </select>
          </div>
        )}

        {deletableCount > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isBusy}
            onClick={onBulkDelete}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>{t.crmOpportunities.bulkDeleteAction(deletableCount)}</span>
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={onClearSelection}
          title={t.crmOpportunities.clearSelection}
          aria-label={t.crmOpportunities.clearSelection}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
