"use client";

import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import {
  formatOpportunityAmountSummary,
  type OpportunityBoardLane,
  type OpportunityStage,
} from "../hooks/pipeline-types";

export interface OpportunityStageFunnelBarProps {
  stages: readonly OpportunityStage[];
  items: readonly { stageId: string }[];
  boardLanes?: readonly OpportunityBoardLane[];
  totalCount?: number;
  selectedStageId?: string;
  onSelectStage: (stageId: string | undefined) => void;
  disabled?: boolean;
}

/**
 * Full-width segmented Stage Funnel Ribbon for Opportunities Card View & Table View
 * matching LeadStageFunnelBar and CustomerStatusFunnelBar (`All Opportunities | Discovery | Qualification | Proposal | Won | Lost`).
 */
export function OpportunityStageFunnelBar({
  stages,
  items,
  boardLanes,
  totalCount,
  selectedStageId,
  onSelectStage,
  disabled,
}: OpportunityStageFunnelBarProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const countByStageId = new Map<string, number>();
  const amountByStageId = new Map<string, string | undefined>();

  if (boardLanes && boardLanes.length > 0) {
    for (const lane of boardLanes) {
      countByStageId.set(lane.stage.id, lane.summary.totalCount);
      amountByStageId.set(
        lane.stage.id,
        formatOpportunityAmountSummary(lane.summary.amountsByCurrency),
      );
    }
  } else {
    for (const item of items) {
      countByStageId.set(item.stageId, (countByStageId.get(item.stageId) ?? 0) + 1);
    }
  }

  const allTotal =
    totalCount ??
    (boardLanes && boardLanes.length > 0
      ? boardLanes.reduce((sum, lane) => sum + lane.summary.totalCount, 0)
      : items.length);

  const isAllActive = !selectedStageId;

  return (
    <div
      role="navigation"
      aria-label={isAr ? "تصفية حسب المرحلة" : "Stage funnel filter"}
      className="flex w-full items-stretch divide-x divide-slate-200 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isAllActive}
        onClick={() => onSelectStage(undefined)}
        className={cn(
          "flex min-w-36 flex-1 items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors",
          isAllActive
            ? "bg-blue-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70",
        )}
      >
        <span className="truncate">{isAr ? "كل الفرص" : "All Opportunities"}</span>
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
            isAllActive
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {allTotal}
        </span>
      </button>

      {stages.map((stage) => {
        const isActive = selectedStageId === stage.id;
        const count = countByStageId.get(stage.id) ?? 0;
        const amountSummary = amountByStageId.get(stage.id);
        const topAccent =
          stage.flag === "WON"
            ? "border-t-2 border-t-emerald-500"
            : stage.flag === "LOST"
              ? "border-t-2 border-t-red-500"
              : stage.flag === "ON_HOLD"
                ? "border-t-2 border-t-amber-500"
                : "";

        return (
          <button
            key={stage.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelectStage(isActive ? undefined : stage.id)}
            className={cn(
              "flex min-w-28 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
              topAccent,
              isActive
                ? "bg-blue-600 text-white"
                : stage.flag === "WON"
                  ? "bg-emerald-50/40 text-emerald-800 hover:bg-emerald-50/80 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : stage.flag === "LOST"
                    ? "bg-white text-slate-700 hover:bg-red-50/40 dark:bg-slate-900 dark:text-slate-200"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70",
            )}
          >
            <span className="truncate">{localizedName(stage, lang)}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : stage.flag === "WON"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                    : stage.flag === "LOST"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {count}
            </span>
            {amountSummary && (
              <span
                className={cn(
                  "hidden truncate text-[10px] font-medium tabular-nums xl:inline",
                  isActive ? "text-blue-100" : "text-slate-400 dark:text-slate-500",
                )}
              >
                · {amountSummary}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
