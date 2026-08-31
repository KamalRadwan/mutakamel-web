"use client";

import { Pencil } from "lucide-react";
import {
  Button,
  DateTime,
  StatusBadge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmTask } from "../../activities/activity-contract";

interface TaskColumnOptions {
  canUpdate: boolean;
  isSubmitting: boolean;
  onEdit: (task: CrmTask) => void;
}

export function useTaskColumns({
  canUpdate,
  isSubmitting,
  onEdit,
}: TaskColumnOptions): ColumnDef<CrmTask>[] {
  const { t } = useI18n();

  // No `sortable` anywhere: listScopedTasks orders by `t.created_at DESC`,
  // hardcoded, and the shared sortBy/sortDir are accepted then ignored. A sort
  // control the server would not honour is a lie.
  const columns: ColumnDef<CrmTask>[] = [
    {
      id: "title",
      header: t.crmTasks.title,
      cell: (task) => (
        <span className="font-medium text-foreground">{task.title}</span>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (task) => <StatusBadge kind="CrmTaskStatus" value={task.status} />,
    },
    {
      id: "source",
      header: t.crmTasks.sourceType,
      cell: (task) => (
        <span className="text-xs text-muted-foreground">
          {task.sourceType
            ? (t.crmTasks.sourceTypeValues[task.sourceType] ?? task.sourceType)
            : t.common.noData}
        </span>
      ),
    },
    {
      id: "dueAt",
      header: t.crmTasks.dueAt,
      cell: (task) =>
        task.dueAt ? (
          <DateTime value={task.dueAt} precision="date" />
        ) : (
          <span className="text-muted-foreground">{t.common.noData}</span>
        ),
    },
  ];

  if (!canUpdate) return columns;

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (task) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              aria-label={`${t.crmTasks.editTitle}: ${task.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(task);
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.crmTasks.editTitle}</TooltipContent>
        </Tooltip>
      ),
    },
  ];
}
