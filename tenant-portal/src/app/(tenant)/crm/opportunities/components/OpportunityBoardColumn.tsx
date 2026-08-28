"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Loader2 } from "lucide-react";
import { Badge, BoardCard, Button, cn, resolveStatusRole } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { OpportunityBoardCard } from "./OpportunityBoardCard";
import type { OpportunityBoardLane, OpportunityCardRecord } from "../hooks/pipeline-types";
import { formatCurrencyAmount } from "../hooks/pipeline-types";

const OUTCOME_BORDER: Record<string, string> = {
  positive: "border-t-positive-500",
  negative: "border-t-negative-500",
  caution: "border-t-caution-500",
};

const ACTIVITY_BAR: Record<string, string> = {
  overdueCount: "bg-negative-500",
  todayCount: "bg-caution-500",
  futureCount: "bg-positive-500",
  noOpenCount: "bg-ink-300 dark:bg-ink-700",
};

interface OpportunityBoardColumnProps {
  lane: OpportunityBoardLane;
  canUpdate: (opportunity: OpportunityCardRecord) => boolean;
  isBusy: boolean;
  onImportanceChange: (cardId: string, importance: number) => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

export function OpportunityBoardColumn({
  lane,
  canUpdate,
  isBusy,
  onImportanceChange,
  onLoadMore,
  isLoadingMore,
}: OpportunityBoardColumnProps) {
  const { t, lang } = useI18n();
  const { stage, items, summary, activitySummary } = lane;
  const role = resolveStatusRole("OpportunityStageFlag", stage.flag);
  const outcomeBorder = role && role !== "pending" ? OUTCOME_BORDER[role] : undefined;

  return (
    <div
      className={cn(
        "flex h-full w-70 shrink-0 flex-col rounded-md border border-border bg-card",
        outcomeBorder ? cn("border-t-2", outcomeBorder) : "",
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">
              {lang === "ar" ? stage.nameAr : stage.nameEn}
            </span>
            <Badge tone="neutral">{summary.totalCount}</Badge>
          </div>
        </div>

        {summary.totalCount > 0 && (
          <div className="flex h-1 gap-0.5 overflow-hidden rounded-full bg-muted">
            {(["overdueCount", "todayCount", "futureCount", "noOpenCount"] as const).map((key) =>
              activitySummary[key] > 0 ? (
                <div
                  key={key}
                  className={cn("h-full", ACTIVITY_BAR[key])}
                  style={{ width: `${(activitySummary[key] / summary.totalCount) * 100}%` }}
                />
              ) : null,
            )}
          </div>
        )}

        {Object.keys(summary.amountsByCurrency).length > 0 && (
          <div className="flex flex-wrap gap-x-2 font-mono text-2xs tabular-nums text-muted-foreground">
            {Object.entries(summary.amountsByCurrency).map(([currency, amount]) => (
              <span key={currency}>{formatCurrencyAmount(amount, currency)}</span>
            ))}
          </div>
        )}
      </div>

      <Droppable droppableId={stage.id} isDropDisabled={stage.flag === "WON" || stage.flag === "LOST" || isBusy}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn("flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5", snapshot.isDraggingOver && "bg-accent")}
          >
            {items.length === 0 && (
              <div className="flex min-h-16 flex-1 items-center justify-center rounded-sm border border-dashed border-ink-300 text-2xs text-muted-foreground">
                {t.crmOpportunities.emptyColumn}
              </div>
            )}
            {items.map((item, index) => (
              <BoardCard key={item.id} draggableId={item.id} index={index} isDragDisabled={isBusy || !canUpdate(item)}>
                <OpportunityBoardCard
                  item={item}
                  canUpdate={canUpdate(item) && !isBusy}
                  onImportanceChange={(next) => onImportanceChange(item.id, next)}
                />
              </BoardCard>
            ))}
            {provided.placeholder}
            {lane.pageInfo.hasMore && (
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onLoadMore} disabled={isLoadingMore || isBusy}>
                {isLoadingMore && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isLoadingMore ? t.crmOpportunities.loadingMore : t.crmOpportunities.loadMore(items.length, summary.totalCount)}
              </Button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
