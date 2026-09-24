"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import Link from "next/link";
import { Badge, StatusBadge, cn, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Activity } from "../activity-contract";
import { activityLabel, activityPriorityTone, activityTargetHref, primaryActivityTarget } from "../activity-presentation";
import { ActivityTypeIcon } from "../ActivityTypeIcon";
import { ActivityActionsMenu } from "./ActivityActionsMenu";
import { ActivityAssigneeName } from "./ActivityAssigneeName";
import { ActivityWhen } from "./ActivityWhen";
import type { ActivityRowActions } from "./hooks/useActivityWorkspaceWrites";

// A row opens its activity on click and on Enter; following the record link
// inside it must not do that as well.
function keepFromRow(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

/** The table's columns. The row opens the activity; "When" is the one server-sorted column. */
export function useActivityTableColumns(actions: ActivityRowActions, actorId: string | null): ColumnDef<Activity>[] {
  const { t } = useI18n();
  const copy = t.activities;
  const headers = copy.workspace.table;

  return [
    {
      id: "subject",
      header: headers.activity,
      width: "16rem",
      cell: (activity) => (
        <span className="flex min-w-0 items-center gap-2">
          <ActivityTypeIcon type={activity.type} className="text-muted-foreground" />
          <span className="sr-only">{activityLabel(copy, "types", activity.type)}</span>
          <bdi
            className={cn(
              "truncate font-medium text-foreground",
              activity.status === "CANCELLED" && "text-muted-foreground line-through",
            )}
          >
            {activity.subject}
          </bdi>
        </span>
      ),
    },
    {
      id: "relatedTo",
      header: headers.relatedTo,
      cell: (activity) => {
        const target = primaryActivityTarget(activity);
        if (!target) return <span className="text-muted-foreground">{t.detail.notRecorded}</span>;
        // A record its application reports gone keeps its label and loses its link.
        const href = target.unavailableAt ? null : activityTargetHref(target.targetType, target.targetId);
        return (
          <span className="flex min-w-0 flex-col">
            {href ? (
              <Link
                href={href}
                onClick={keepFromRow}
                onKeyDown={keepFromRow}
                className="truncate text-primary underline-offset-2 hover:underline"
              >
                {target.label}
              </Link>
            ) : (
              <bdi className="truncate">{target.label}</bdi>
            )}
            <span className="truncate text-2xs text-muted-foreground">{activityLabel(copy, "targetTypes", target.targetType)}</span>
          </span>
        );
      },
    },
    {
      id: "assignee",
      header: headers.assignee,
      cell: (activity) => <ActivityAssigneeName activity={activity} actorId={actorId} />,
    },
    {
      id: "dueAt",
      header: headers.when,
      sortable: true,
      cell: (activity) => <ActivityWhen activity={activity} />,
    },
    {
      id: "status",
      header: headers.status,
      cell: (activity) => <StatusBadge kind="ActivityStatus" value={activity.status} />,
    },
    {
      id: "priority",
      header: headers.priority,
      // Only HIGH and URGENT are an attention signal; the rest read as plain words.
      cell: (activity) => (activityPriorityTone(activity.priority) === "caution"
        ? <Badge tone="caution">{activityLabel(copy, "priorities", activity.priority)}</Badge>
        : <span className="text-muted-foreground">{activityLabel(copy, "priorities", activity.priority)}</span>),
    },
    {
      id: "actions",
      header: headers.actions,
      align: "end",
      sticky: "end",
      width: "3.5rem",
      cell: (activity) => <ActivityActionsMenu activity={activity} actions={actions} />,
    },
  ];
}
