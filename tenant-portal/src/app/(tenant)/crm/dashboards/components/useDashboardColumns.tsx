"use client";

import { Copy, Star, Target, Trash2 } from "lucide-react";
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
import type { DashboardSummary } from "../dashboard-contract";

interface DashboardColumnOptions {
  canCreate: boolean;
  canDelete: boolean;
  pendingId: string | null;
  onSetDefault: (dashboard: DashboardSummary) => void;
  onToggleFavorite: (dashboard: DashboardSummary) => void;
  onDuplicate: (dashboard: DashboardSummary) => void;
  onDelete: (dashboard: DashboardSummary) => void;
}

export function useDashboardColumns({
  canCreate,
  canDelete,
  pendingId,
  onSetDefault,
  onToggleFavorite,
  onDuplicate,
  onDelete,
}: DashboardColumnOptions): ColumnDef<DashboardSummary>[] {
  const { t } = useI18n();

  const columns: ColumnDef<DashboardSummary>[] = [
    {
      id: "name",
      header: t.crmDashboards.name,
      cell: (dashboard) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{dashboard.name}</p>
          {dashboard.description ? (
            <p className="truncate text-2xs text-muted-foreground">{dashboard.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "owner",
      header: t.crmDashboards.owner,
      cell: (dashboard) => (
        <span className="text-xs text-muted-foreground">
          {dashboard.isShared ? (dashboard.ownerName ?? t.crmDashboards.ownerUnknown) : t.crmDashboards.ownerYou}
        </span>
      ),
    },
    {
      id: "access",
      header: t.crmDashboards.access,
      // OWNER / EDIT / VIEW is a category, not an outcome — neutral, never a
      // hue (docs/design/tokens.md#non-outcome-values).
      cell: (dashboard) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{t.crmDashboards.accessLevels[dashboard.accessLevel]}</Badge>
          {dashboard.isDefault ? <Badge tone="brand">{t.crmDashboards.isDefault}</Badge> : null}
          {dashboard.isFavorite ? <Badge tone="neutral">{t.crmDashboards.isFavorite}</Badge> : null}
        </div>
      ),
    },
    {
      id: "updatedAt",
      header: t.crmDashboards.updated,
      cell: (dashboard) => <DateTime value={dashboard.updatedAt} />,
    },
    {
      id: "preferences",
      header: t.crmDashboards.preferences,
      align: "end",
      cell: (dashboard) => (
        <div className="flex items-center justify-end gap-1">
          {dashboard.isDefault ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  aria-label={`${t.crmDashboards.makeDefault}: ${dashboard.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSetDefault(dashboard);
                  }}
                >
                  <Target className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.crmDashboards.makeDefault}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId !== null}
                aria-pressed={dashboard.isFavorite}
                aria-label={`${dashboard.isFavorite ? t.crmDashboards.unfavorite : t.crmDashboards.favorite}: ${dashboard.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(dashboard);
                }}
              >
                {/* The semantic token, not a ramp step: feature code never
                    writes `brand-600` — docs/design/tokens.md. */}
                <Star
                  className={dashboard.isFavorite ? "size-4 text-primary" : "size-4"}
                  aria-hidden="true"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {dashboard.isFavorite ? t.crmDashboards.unfavorite : t.crmDashboards.favorite}
            </TooltipContent>
          </Tooltip>
        </div>
      ),
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
      cell: (dashboard) => (
        <div className="flex items-center justify-end gap-1">
          {canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  aria-label={`${t.crmDashboards.duplicate}: ${dashboard.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate(dashboard);
                  }}
                >
                  <Copy className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.crmDashboards.duplicate}</TooltipContent>
            </Tooltip>
          ) : null}
          {/* Deleting needs `crm.dashboards.delete` AND ownership: the service
              re-checks `owner_user_id`, so an EDIT share cannot delete. */}
          {canDelete && dashboard.accessLevel === "OWNER" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId !== null}
                  aria-label={`${t.common.delete}: ${dashboard.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(dashboard);
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
