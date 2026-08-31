"use client";

import { Copy, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DateTime,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { WidgetDefinition } from "../../dashboards/widget-contract";

interface WidgetColumnOptions {
  canCreate: boolean;
  canDelete: boolean;
  pendingId: string | null;
  onClone: (widget: WidgetDefinition) => void;
  onDelete: (widget: WidgetDefinition) => void;
}

export function useWidgetColumns({
  canCreate,
  canDelete,
  pendingId,
  onClone,
  onDelete,
}: WidgetColumnOptions): ColumnDef<WidgetDefinition>[] {
  const { t } = useI18n();

  const columns: ColumnDef<WidgetDefinition>[] = [
    {
      id: "name",
      header: t.crmWidgets.name,
      cell: (widget) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{widget.name}</p>
          <p className="truncate text-2xs text-muted-foreground">
            {widget.querySpec.series.map((series) => series.metricKey).join(", ")}
          </p>
        </div>
      ),
    },
    {
      id: "visualization",
      header: t.crmWidgets.visualization,
      cell: (widget) => (
        <Badge tone="neutral">
          {t.crmDashboards.visualizations[widget.visualizationType] ?? widget.visualizationType}
        </Badge>
      ),
    },
    {
      id: "owner",
      header: t.crmWidgets.owner,
      cell: (widget) => (
        <span className="text-xs text-muted-foreground">
          {widget.isShared ? (widget.ownerName ?? t.crmDashboards.ownerUnknown) : t.crmDashboards.ownerYou}
        </span>
      ),
    },
    {
      id: "access",
      header: t.crmDashboards.access,
      cell: (widget) => (
        <Badge tone="neutral">{t.crmDashboards.accessLevels[widget.accessLevel]}</Badge>
      ),
    },
    {
      id: "updatedAt",
      header: t.crmDashboards.updated,
      cell: (widget) => <DateTime value={widget.updatedAt} />,
    },
  ];

  if (!canCreate && !canDelete) return columns;

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (widget) => (
        <div className="flex items-center justify-end gap-1">
          {canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  aria-label={`${t.crmWidgets.clone}: ${widget.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClone(widget);
                  }}
                >
                  <Copy className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.crmWidgets.clone}</TooltipContent>
            </Tooltip>
          ) : null}
          {/* Deleting needs the grant AND ownership: `remove` filters on
              `owner_user_id`, so an EDIT share answers 404. */}
          {canDelete && widget.accessLevel === "OWNER" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  aria-label={`${t.common.delete}: ${widget.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(widget);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.common.delete}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
  ];
}
