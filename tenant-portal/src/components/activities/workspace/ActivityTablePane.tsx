"use client";

import type { ReactNode } from "react";
import { TableView, type SortState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Activity, ActivityPage } from "../activity-contract";
import { activityViewLabels } from "./activity-view-labels";
import type { ActivityWorkspaceRead } from "./hooks/useActivityWorkspaceRead";
import type { ActivityRowActions } from "./hooks/useActivityWorkspaceWrites";
import { useActivityTableColumns } from "./useActivityTableColumns";

const activityKey = (activity: Activity) => activity.id;

export interface ActivityTablePaneProps {
  table: ActivityWorkspaceRead<ActivityPage>;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onPageChange: (page: number) => void;
  actions: ActivityRowActions;
  actorId: string | null;
  emptyState: ReactNode;
}

/** The table: 25 a page, sorted by due date on the server — the list a keyboard walks end to end. */
export function ActivityTablePane({ table, sort, onSortChange, onPageChange, actions, actorId, emptyState }: ActivityTablePaneProps) {
  const { t, lang } = useI18n();
  const columns = useActivityTableColumns(actions, actorId);
  const page = table.data;

  return (
    <TableView<Activity>
      className="h-full"
      columns={columns}
      density="compact"
      items={page?.items ?? []}
      itemKey={activityKey}
      onActivate={actions.view}
      isLoading={table.isLoading}
      error={table.error}
      onRetry={table.reload}
      emptyState={emptyState}
      page={page ? { page: page.page, limit: page.limit, total: page.total } : undefined}
      onPageChange={onPageChange}
      sort={sort}
      onSortChange={onSortChange}
      labels={activityViewLabels(t, lang)}
    />
  );
}
