"use client";

import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import {
  formatOpportunityAmountSummary,
  type OpportunityBoardLane,
  type OpportunityStage,
} from "../hooks/pipeline-types";

export interface OpportunityStageFunnelBarProps {
  stages: readonly OpportunityStage[];
  boardLanes?: readonly OpportunityBoardLane[];
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
  boardLanes,
  selectedStageId,
  onSelectStage,
  disabled,
}: OpportunityStageFunnelBarProps) {
  const { t, lang } = useI18n();

  const countByStageId = new Map<string, number>();
  const amountByStageId = new Map<string, string | undefined>();

  if (boardLanes) {
    for (const lane of boardLanes) {
      countByStageId.set(lane.stage.id, lane.summary.totalCount);
      amountByStageId.set(
        lane.stage.id,
        formatOpportunityAmountSummary(lane.summary.amountsByCurrency),
      );
    }
  }

  const allTotal = boardLanes
    ? stages.reduce((sum, stage) => sum + (countByStageId.get(stage.id) ?? 0), 0)
    : "—";

  const isAllActive = !selectedStageId;

  return (
    <div
      role="navigation"
      aria-label={t.crmOpportunities.stageFilter}
      className="flex w-full items-stretch divide-x divide-border overflow-x-auto rounded-lg border border-border bg-card shadow-2xs"
    >
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        aria-pressed={isAllActive}
        onClick={() => onSelectStage(undefined)}
        className={cn(
          "flex min-w-36 flex-1 items-center justify-center gap-2 rounded-none px-3.5 py-2 text-xs font-semibold transition-colors",
          isAllActive
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            : "bg-card text-foreground hover:bg-muted",
        )}
      >
        <span className="truncate">{t.crmOpportunities.allOpportunities}</span>
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
            isAllActive
              ? "bg-white/20 text-white"
              : "bg-muted text-foreground",
          )}
        >
          {allTotal}
        </span>
      </Button>

      {stages.map((stage) => {
        const isActive = selectedStageId === stage.id;
        const count = boardLanes ? countByStageId.get(stage.id) ?? 0 : "—";
        const amountSummary = amountByStageId.get(stage.id);
        const topAccent =
          stage.flag === "WON"
            ? "border-t-2 border-t-success"
            : stage.flag === "LOST"
              ? "border-t-2 border-t-destructive"
              : stage.flag === "ON_HOLD"
                ? "border-t-2 border-t-warning"
                : "";

        return (
          <Button
            key={stage.id}
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelectStage(isActive ? undefined : stage.id)}
            className={cn(
              "flex min-w-28 flex-1 items-center justify-center gap-1.5 rounded-none px-3 py-2 text-xs font-semibold transition-colors",
              topAccent,
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : stage.flag === "WON"
                  ? "bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle/80"
                  : stage.flag === "LOST"
                    ? "bg-card text-foreground hover:bg-destructive-subtle"
                    : "bg-card text-foreground hover:bg-muted",
            )}
          >
            <span className="truncate">{localizedName(stage, lang)}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : stage.flag === "WON"
                    ? "bg-success-subtle text-success-subtle-foreground"
                    : stage.flag === "LOST"
                      ? "bg-destructive-subtle text-destructive-subtle-foreground"
                      : "bg-muted text-foreground",
              )}
            >
              {count}
            </span>
            {amountSummary && (
              <span
                className={cn(
                  "hidden truncate text-2xs font-medium tabular-nums xl:inline",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                · {amountSummary}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
