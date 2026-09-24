"use client";

import type { ReactNode } from "react";
import { BoardView, type BoardColumnDef, type BoardColumnSegment } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { Activity, ActivityStatus, ActivityStatusSummary, ActivitySummary } from "../activity-contract";
import { activityLabel, isOpenActivityStatus } from "../activity-presentation";
import { ActivityActionsMenu } from "./ActivityActionsMenu";
import { isActivityStatus } from "./activity-board-lanes";
import { activityViewLabels } from "./activity-view-labels";
import { ActivityBoardCard } from "./ActivityBoardCard";
import type { ActivityBoardLanes } from "./hooks/useActivityBoardLanes";
import type { ActivityBoardMoves, ActivityRowActions } from "./hooks/useActivityWorkspaceWrites";

// Only an outcome takes a hue at the top of its column; the two open lanes
// carry none — docs/design/views.md#board-view.
const OUTCOME_ROLE: Partial<Record<ActivityStatus, "positive" | "negative">> = { DONE: "positive", CANCELLED: "negative" };

const activityKey = (activity: Activity) => activity.id;
const activityColumn = (activity: Activity) => activity.status;

// Overdue, due today and upcoming for one open lane, from the summary — the
// whole lane's counts, not only the cards loaded into it. "Overdue only" leaves
// nothing else in the lane, so the bar must not claim otherwise.
function dueSegments(
  entry: ActivityStatusSummary | undefined,
  overdueOnly: boolean,
  labels: Dictionary["activities"]["dueStates"],
): BoardColumnSegment[] | undefined {
  if (!entry) return undefined;
  return [
    { id: "OVERDUE", label: labels.OVERDUE, value: entry.overdue, tone: "negative" },
    { id: "TODAY", label: labels.TODAY, value: overdueOnly ? 0 : entry.today, tone: "caution" },
    { id: "UPCOMING", label: labels.UPCOMING, value: overdueOnly ? 0 : entry.upcoming, tone: "positive" },
  ];
}

export interface ActivityBoardPaneProps {
  board: ActivityBoardLanes;
  /** The lanes on show, in column order. */
  statuses: readonly ActivityStatus[];
  summary: ActivitySummary | null;
  overdueOnly: boolean;
  moves: ActivityBoardMoves;
  actions: ActivityRowActions;
  actorId: string | null;
  /** Drawn instead of empty lanes when no lane holds anything. */
  emptyState: ReactNode;
}

/** The board: a lane per status, a card per activity, dragging as the status change. */
export function ActivityBoardPane({ board, statuses, summary, overdueOnly, moves, actions, actorId, emptyState }: ActivityBoardPaneProps) {
  const { t, lang } = useI18n();
  const copy = t.activities;
  const { lanes } = board;

  if (lanes && !board.isLoading && !board.error && statuses.every((status) => (lanes[status]?.total ?? 0) === 0)) {
    return emptyState;
  }

  const columns: BoardColumnDef[] = statuses.map((status) => {
    const open = isOpenActivityStatus(status);
    return {
      id: status,
      label: activityLabel(copy, "statuses", status),
      count: lanes?.[status]?.total ?? 0,
      outcomeRole: OUTCOME_ROLE[status],
      segments: open ? dueSegments(summary?.byStatus.find((entry) => entry.status === status), overdueOnly, copy.dueStates) : undefined,
      segmentsLabel: open ? copy.workspace.board.segments : undefined,
    };
  });

  return (
    <BoardView<Activity>
      columns={columns}
      columnOf={activityColumn}
      items={board.items}
      itemKey={activityKey}
      renderCard={(activity) => <ActivityBoardCard activity={activity} actorId={actorId} />}
      renderActions={(activity) => <ActivityActionsMenu activity={activity} actions={actions} />}
      canDrag={moves.canDrag}
      canMoveTo={moves.canMoveTo}
      confirmMove={moves.confirmMove}
      onCardMove={moves.onCardMove}
      onActivate={actions.view}
      isLoading={board.isLoading}
      error={board.error}
      onRetry={board.reload}
      columnPage={(columnId) => ({
        hasMore: isActivityStatus(columnId) && (lanes?.[columnId]?.hasMore ?? false),
        isLoadingMore: isActivityStatus(columnId) && board.loadingMore.has(columnId),
      })}
      onLoadMoreColumn={(columnId) => {
        if (isActivityStatus(columnId)) board.loadMore(columnId);
      }}
      labels={{
        ...activityViewLabels(t, lang),
        emptyColumn: copy.workspace.board.emptyColumn,
        collapseColumn: t.views.collapseColumn,
        expandColumn: t.views.expandColumn,
        moveTo: t.views.moveTo,
        loadMore: (loaded, total) => formatTemplate(copy.workspace.board.loadMore, {
          loaded: formatNumber(loaded, lang),
          total: formatNumber(total, lang),
        }),
        loadingMore: copy.workspace.board.loadingMore,
      }}
    />
  );
}
