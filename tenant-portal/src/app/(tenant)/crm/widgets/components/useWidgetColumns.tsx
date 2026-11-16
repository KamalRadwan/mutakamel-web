"use client";

import { Copy, Layers3, Trash2 } from "lucide-react";
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
import { formatTemplate } from "@/lib/format/template";
import { isPlaceableWidget, type WidgetLibraryItem } from "../../dashboards/widget-library-contract";

interface WidgetColumnOptions {
  canCreate: boolean;
  canDelete: boolean;
  pendingId: string | null;
  onClone: (widget: WidgetLibraryItem) => void;
  onDelete: (widget: WidgetLibraryItem) => void;
  usageWidgetId: string | null;
  usagePanelId: string;
  onInspectUsage: (widget: WidgetLibraryItem, trigger: HTMLButtonElement) => void;
}

export function useWidgetColumns({
  canCreate,
  canDelete,
  pendingId,
  onClone,
  onDelete,
  usageWidgetId,
  usagePanelId,
  onInspectUsage,
}: WidgetColumnOptions): ColumnDef<WidgetLibraryItem>[] {
  const { t } = useI18n();

  const columns: ColumnDef<WidgetLibraryItem>[] = [
    {
      id: "name",
      header: t.crmWidgets.name,
      cell: (widget) => (
        <div className="min-w-0">
          <p className="truncate font-normal text-foreground">{widget.name || t.crmWidgets.lifecycle.untitledDraft}</p>
        </div>
      ),
    },
    {
      id: "source",
      header: t.crmWidgets.review.librarySource,
      cell: widget => widget.sourceResources?.length
        ? <div className="flex flex-wrap gap-1">{widget.sourceResources.map(resource => <Badge tone="neutral" key={resource}>
          {t.crmWidgets.metricPicker.resources[resource]}
        </Badge>)}</div>
        : <span className="text-xs text-muted-foreground">{widget.sourceResources ? t.crmWidgets.review.unclassifiedSource : t.crmWidgets.metricPicker.unknown}</span>,
    },
    {
      id: "visualization",
      header: t.crmWidgets.visualization,
      cell: (widget) => (
        <Badge tone="neutral">
          {widget.visualizationType ? t.crmDashboards.visualizations[widget.visualizationType] : t.crmDashboards.unknownVisualization}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.crmWidgets.lifecycle.status,
      cell: (widget) => <Badge tone={widget.status === "PUBLISHED" ? "positive" : "neutral"}>{t.crmWidgets.lifecycle.statuses[widget.status]}</Badge>,
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
      id: "usage",
      header: t.crmWidgets.usageColumn,
      cell: widget => <Button variant={usageWidgetId === widget.id ? "outline" : "ghost"} size="sm" disabled={pendingId !== null}
        aria-expanded={usageWidgetId === widget.id} aria-controls={usageWidgetId === widget.id ? usagePanelId : undefined}
        aria-label={formatTemplate(t.crmWidgets.usageButton, { name: widget.name || t.crmWidgets.lifecycle.untitledDraft })}
        onClick={event => { event.stopPropagation(); onInspectUsage(widget, event.currentTarget); }}>
        <Layers3 className="size-4" aria-hidden="true" />{t.crmWidgets.usageColumn}
      </Button>,
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
          {canCreate && isPlaceableWidget(widget) ? (
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
