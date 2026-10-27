"use client";

import { ChevronsLeft, Lock, Plus, X } from "lucide-react";
import { Button, cn, mirrorInRtl } from "@/design-system";
import type { LeadStageFlag } from "@/app/(tenant)/crm/lead-stages/lead-stage-contract";
import type { CrmActivityState } from "@/app/(tenant)/crm/shared/crm-activity-tone";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { LeadBoardActivityBar, leadBoardActivityLabel } from "./LeadBoardActivityBar";

export function leadBoardCountToneClass(count: number, isDisqualified: boolean): string {
  if (isDisqualified) {
    return "bg-count-danger-surface text-count-danger-fg";
  }
  if (count > 0) {
    return "bg-count-active-surface text-count-active-fg";
  }
  return "bg-count-zero-surface text-count-zero-fg";
}

const ACTIVE_FILTER_PILL_SURFACE: Record<CrmActivityState, string> = {
  FUTURE: "border-activity-future-line bg-activity-future-surface text-activity-future-text",
  TODAY: "border-activity-today-line bg-activity-today-surface text-activity-today-text",
  OVERDUE: "border-activity-overdue-line bg-activity-overdue-surface text-activity-overdue-text",
  NONE: "border-activity-none-line bg-activity-none-surface text-activity-none-text",
};

const ACTIVE_FILTER_DOT: Record<CrmActivityState, string> = {
  FUTURE: "bg-activity-future",
  TODAY: "bg-activity-today",
  OVERDUE: "bg-activity-overdue",
  NONE: "bg-activity-none",
};

export interface LeadBoardColumnHeaderProps {
  stageLabel: string;
  stageFlag: LeadStageFlag;
  /** Server total for the stage (or loaded count when totals have not resolved). */
  totalCount: number;
  /** Activity states for the leads currently loaded in this column. */
  activityStates: readonly CrmActivityState[];
  activeActivityState?: CrmActivityState | null;
  isQuickAddOpen?: boolean;
  onCollapse: () => void;
  /** Omitted when the actor cannot create leads in this branch. */
  onQuickAdd?: () => void;
  onToggleActivityState?: (state: CrmActivityState) => void;
  onClearActivityFilter?: () => void;
  className?: string;
}

export function LeadBoardColumnHeader({
  stageLabel,
  stageFlag,
  totalCount,
  activityStates,
  activeActivityState = null,
  isQuickAddOpen = false,
  onCollapse,
  onQuickAdd,
  onToggleActivityState,
  onClearActivityFilter,
  className,
}: LeadBoardColumnHeaderProps) {
  const { t, lang } = useI18n();
  const isTerminal = stageFlag === "CONVERTED";
  const isDisqualified = stageFlag === "DISQUALIFIED";
  const activeFilterCount = activeActivityState
    ? activityStates.filter((state) => state === activeActivityState).length
    : 0;
  const handleClearFilter =
    onClearActivityFilter ??
    (activeActivityState && onToggleActivityState
      ? () => onToggleActivityState(activeActivityState)
      : undefined);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2.5 rounded-t-column border-b border-line-divider bg-surface-column-header px-3.5 pt-[13px] pb-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-column-title font-bold text-foreground">
            {stageLabel}
          </span>
          <span
            data-testid="column-count-pill"
            className={`inline-flex h-5 min-w-[23px] shrink-0 items-center justify-center rounded-full px-1.5 text-badge font-bold tabular-nums ${leadBoardCountToneClass(totalCount, isDisqualified)}`}
          >
            {formatNumber(totalCount, lang)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isQuickAddOpen && (
            <span className="inline-flex items-center gap-1 rounded-md border border-chip-active-line bg-count-active-surface px-1.5 py-0.5 text-badge font-semibold text-chip-active-fg">
              {t.crmLeads.executive.quickAdding}
            </span>
          )}

          {isTerminal && (
            <span className="inline-flex items-center gap-1 rounded-md border border-activity-future-line bg-activity-future-surface px-2 py-0.5 text-badge font-semibold text-activity-future-text">
              <Lock className="size-3" aria-hidden="true" />
              {t.crmLeads.executive.terminal}
            </span>
          )}

          {onQuickAdd && !isTerminal && !isQuickAddOpen && (
            <Button
              type="button"
              variant="ghost"
              onClick={onQuickAdd}
              aria-label={`${t.crmLeads.addLead}: ${stageLabel}`}
              title={`${t.crmLeads.addLead}: ${stageLabel}`}
              className="size-[26px] shrink-0 rounded-[7px] border border-line-card bg-surface-subtle p-0 text-muted-foreground not-disabled:hover:bg-count-active-surface not-disabled:hover:text-primary"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onCollapse}
            aria-expanded={true}
            aria-label={`${t.views.collapseColumn}: ${stageLabel}`}
            title={`${t.views.collapseColumn}: ${stageLabel}`}
            className="size-[26px] shrink-0 rounded-[7px] border border-line-card bg-surface-subtle p-0 text-muted-foreground not-disabled:hover:bg-accent not-disabled:hover:text-foreground"
          >
            <ChevronsLeft className={cn("size-3.5", mirrorInRtl)} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <LeadBoardActivityBar
        states={activityStates}
        stageLabel={stageLabel}
        activeState={activeActivityState}
        onToggleState={onToggleActivityState}
      />

      {activeActivityState && (
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-badge font-semibold ${ACTIVE_FILTER_PILL_SURFACE[activeActivityState]}`}
          >
            <span
              className={cn("size-1.5 rounded-full", ACTIVE_FILTER_DOT[activeActivityState])}
              aria-hidden="true"
            />
            <span>
              {leadBoardActivityLabel(activeActivityState, t)} (
              {formatNumber(activeFilterCount, lang)})
            </span>
          </span>

          {handleClearFilter && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleClearFilter}
              className="h-auto gap-0.5 px-1.5 py-0.5 font-semibold text-muted-foreground not-disabled:hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
              <span className="text-badge">{t.crmLeads.executive.clearFilter}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
