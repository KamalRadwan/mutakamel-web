"use client";

import { CheckCircle2, Pencil, XCircle } from "lucide-react";
import { Badge, Button, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { Activity } from "../activities-contract";
import type { ActivityGrants } from "../hooks/useActivities";
import type { ActivityTransition } from "../hooks/useActivityMutations";

const STATUS_TONE: Record<string, "positive" | "negative" | "neutral"> = {
  DONE: "positive",
  CANCELLED: "negative",
  PLANNED: "neutral",
};

interface ActivityColumnActions {
  grants: ActivityGrants;
  pendingId: string | null;
  onEdit: (activity: Activity) => void;
  onTransition: (activity: Activity, kind: ActivityTransition) => void;
}

/** The activities table's columns. Sorting is `dueAt` only — the DTO allows nothing else. */
export function useActivityColumns(actions: ActivityColumnActions): ColumnDef<Activity>[] {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.activities;
  const { grants, pendingId } = actions;

  return [
    {
      id: "subject",
      header: copy.subject,
      cell: (activity) => (
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{activity.subject}</span>
          <span className="text-xs text-muted-foreground">
            {copy.types[activity.type] ?? activity.type}
          </span>
        </span>
      ),
    },
    {
      id: "target",
      header: copy.target,
      cell: (activity) => {
        const target = activity.targets[0];
        // The server also returns a `route` for each target. It is not followed:
        // it addresses another app's UI, and this portal must not navigate to a
        // path it did not build.
        return target ? (
          <span className="flex flex-col">
            <span>{target.label}</span>
            <span className="text-xs text-muted-foreground">
              {copy.targetTypes[target.targetType] ?? target.targetType}
            </span>
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      id: "dueAt",
      header: copy.dueAt,
      sortable: true,
      cell: (activity) => formatDateTime(activity.dueAt, lang),
    },
    {
      id: "priority",
      header: copy.priority,
      cell: (activity) => copy.priorities[activity.priority] ?? activity.priority,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (activity) => (
        <Badge tone={STATUS_TONE[activity.status] ?? "neutral"}>
          {copy.statuses[activity.status] ?? activity.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (activity) => (
        <span className="flex items-center justify-end gap-1">
          {grants.canUpdate && activity.status === "PLANNED" ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.editTitle}: ${activity.subject}`}
              disabled={pendingId !== null}
              onClick={() => actions.onEdit(activity)}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {grants.canComplete && activity.status === "PLANNED" ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.complete}: ${activity.subject}`}
              disabled={pendingId !== null}
              onClick={() => actions.onTransition(activity, "complete")}
            >
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {grants.canCancel && activity.status === "PLANNED" ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.cancel}: ${activity.subject}`}
              disabled={pendingId !== null}
              onClick={() => actions.onTransition(activity, "cancel")}
            >
              <XCircle className="size-3.5 text-destructive" aria-hidden="true" />
            </Button>
          ) : null}
        </span>
      ),
    },
  ];
}
