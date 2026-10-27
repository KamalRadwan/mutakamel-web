"use client";

import { useId } from "react";
import { Button, Checkbox, Label } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityStage } from "../../hooks/pipeline-types";

interface OpportunityGridToolbarProps {
  selectedCount: number;
  hasSelectedOnPage: boolean;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  canMutate: boolean;
  canUpdateAny: boolean;
  canExport: boolean;
  bulkStageValue: string;
  nonLostStages: readonly OpportunityStage[];
  sortValue: string;
  rangeFrom: number;
  rangeTo: number;
  rangeTotal: number;
  onToggleSelectAll: () => void;
  onBulkStageChange: (stageId: string) => void;
  onExportCsv: () => void;
  onSortValueChange: (nextValue: string) => void;
}

export function OpportunityGridToolbar({
  selectedCount,
  hasSelectedOnPage,
  isAllSelected,
  isSomeSelected,
  canMutate,
  canUpdateAny,
  canExport,
  bulkStageValue,
  nonLostStages,
  sortValue,
  rangeFrom,
  rangeTo,
  rangeTotal,
  onToggleSelectAll,
  onBulkStageChange,
  onExportCsv,
  onSortValueChange,
}: OpportunityGridToolbarProps) {
  const { t, lang } = useI18n();
  const selectAllId = useId();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card border border-line-column bg-surface-toolbar px-3.5 py-2 shadow-toolbar">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id={selectAllId}
            checked={
              isAllSelected ? true : isSomeSelected ? "indeterminate" : false
            }
            onCheckedChange={onToggleSelectAll}
            aria-label={t.views.selectAll}
          />
          <Label
            htmlFor={selectAllId}
            className="cursor-pointer select-none text-xs font-semibold"
          >
            {selectedCount > 0
              ? formatTemplate(t.crmOpportunities.selectedCount, {
                  count: formatNumber(selectedCount, lang),
                })
              : t.crmOpportunities.selectAll}
          </Label>
        </div>

        {canMutate && (
          <select
            value={bulkStageValue}
            disabled={!canUpdateAny}
            aria-label={t.crmOpportunities.bulkMoveStage}
            onChange={(event) => onBulkStageChange(event.target.value)}
            className="h-(--size-toolbar-control) rounded-lg border border-line-control bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-foreground disabled:opacity-60"
          >
            <option value="">{t.crmOpportunities.moveStage}</option>
            {nonLostStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {localizedName(stage, lang)}
              </option>
            ))}
          </select>
        )}

        {canExport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={!hasSelectedOnPage}
          >
            {t.crmOpportunities.exportSelectedOnPage}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-caption font-semibold text-foreground">
          {t.crmOpportunities.detailedCards}
        </span>
        <span className="h-3.5 w-px bg-line-divider" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span className="text-caption font-medium text-muted-foreground">
            {t.crmOpportunities.sortBy}
          </span>
          <select
            value={sortValue}
            aria-label={t.views.sortBy}
            onChange={(event) => onSortValueChange(event.target.value)}
            className="h-(--size-toolbar-control) rounded-lg border border-line-control bg-card px-2.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="createdAt:desc">
              {t.crmOpportunities.sortNewest}
            </option>
            <option value="createdAt:asc">
              {t.crmOpportunities.sortOldest}
            </option>
            <option value="amount:desc">{t.crmOpportunities.sortValue}</option>
            <option value="probabilityPercent:desc">
              {t.crmOpportunities.sortProbability}
            </option>
            <option value="expectedCloseDate:asc">
              {t.crmOpportunities.sortCloseDate}
            </option>
            <option value="title:asc">{t.crmOpportunities.sortTitle}</option>
          </select>
        </div>

        <span className="text-caption font-medium tabular-nums text-muted-foreground">
          {formatTemplate(t.crmOpportunities.showingRange, {
            from: formatNumber(rangeFrom, lang),
            to: formatNumber(rangeTo, lang),
            total: formatNumber(rangeTotal, lang),
          })}
        </span>
      </div>
    </div>
  );
}
