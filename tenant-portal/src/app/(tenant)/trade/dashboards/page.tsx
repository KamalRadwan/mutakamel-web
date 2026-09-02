"use client";

import Link from "next/link";
import { Copy, LayoutDashboard, RefreshCw, Star, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  EmptyState,
  PageHeader,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import { type DashboardListEntry } from "./analytics-contract";
import { CreateDashboardModal } from "./components/CreateDashboardModal";
import { useDashboards } from "./hooks/useDashboards";

export default function TradeDashboardsPage() {
  const {
    t,
    lang,
    branchIds,
    branchId,
    selectBranch,
    items,
    quickJump,
    defaultDashboardId,
    ensureTemplateKey,
    catalog,
    catalogUnavailable,
    offset,
    nextOffset,
    isLoading,
    isRefreshing,
    queryError,
    isPermissionRefusal,
    createOpen,
    isSubmitting,
    formError,
    pendingId,
    nextPage,
    previousPage,
    openCreate,
    closeCreate,
    create,
    createFromTemplate,
    duplicate,
    setDefault,
    toggleFavorite,
    remove,
    reload,
  } = useDashboards();

  const columns: ColumnDef<DashboardListEntry>[] = [
    {
      id: "name",
      header: t.tradeAnalytics.dashboardName,
      cell: (dashboard) => (
        <span className="flex items-center gap-2">
          <Link
            href={`${TENANT_ROUTES.tradeDashboards}/${dashboard.id}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {dashboard.name}
          </Link>
          {dashboard.isDefault ? <Badge tone="brand">{t.tradeAnalytics.isDefault}</Badge> : null}
          {dashboard.isShared ? <Badge tone="neutral">{t.tradeAnalytics.isShared}</Badge> : null}
        </span>
      ),
    },
    {
      id: "accessLevel",
      header: t.tradeAnalytics.accessLevel,
      cell: (dashboard) => tradeStatusLabel(t.tradeStatus, dashboard.accessLevel, t.common.unknownCode),
    },
    {
      id: "revision",
      header: t.tradeCommon.revision,
      numeric: true,
      cell: (dashboard) => String(dashboard.revision),
    },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (dashboard) => formatDateTime(dashboard.updatedAt, lang),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (dashboard) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.tradeAnalytics.toggleFavorite}
            disabled={pendingId !== null}
            onClick={() => void toggleFavorite(dashboard)}
          >
            <Star
              className={dashboard.isFavorite ? "size-4 fill-current" : "size-4"}
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.tradeAnalytics.setDefault}
            disabled={pendingId !== null || dashboard.isDefault}
            onClick={() => void setDefault(dashboard)}
          >
            {t.tradeAnalytics.setDefault}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.tradeAnalytics.duplicate}
            disabled={pendingId !== null}
            onClick={() => void duplicate(dashboard)}
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          {dashboard.accessLevel === "OWNER" ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              disabled={pendingId !== null}
              loading={pendingId === dashboard.id}
              onClick={() => void remove(dashboard)}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeAnalytics.dashboardsTitle}
        description={t.tradeAnalytics.dashboardsSubtitle}
        primaryAction={{ label: t.tradeAnalytics.dashboardCreate, onClick: openCreate }}
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isRefreshing}
            />
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      {/* A refusal here is the dashboard service's own, per resolved company —
          the permission guard does not run on these routes at all. */}
      {isPermissionRefusal ? (
        <DegradedBanner message={t.tradeAnalytics.serviceLevelRefusal} />
      ) : null}
      {/* The server suggests a template when the caller has no dashboard at
          all — an empty state with a way forward rather than a dead end. */}
      {ensureTemplateKey ? (
        <EmptyState
          icon={LayoutDashboard}
          title={t.tradeAnalytics.noDefaultTitle}
          description={t.tradeAnalytics.noDefaultDescription}
          action={{
            label: t.tradeAnalytics.createFromTemplate,
            onClick: () => void createFromTemplate(ensureTemplateKey, ""),
          }}
        />
      ) : null}

      {quickJump.length > 0 ? (
        <nav aria-label={t.tradeAnalytics.quickJump} className="flex flex-wrap gap-2">
          {quickJump.map((entry) => (
            <Link
              key={entry.id}
              href={`${TENANT_ROUTES.tradeDashboards}/${entry.id}`}
              className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {entry.name}
              {entry.id === defaultDashboardId ? ` · ${t.tradeAnalytics.isDefault}` : ""}
            </Link>
          ))}
        </nav>
      ) : null}

      {catalogUnavailable ? (
        <DegradedBanner message={t.tradeAnalytics.catalogUnavailable} />
      ) : catalog ? (
        <p className="text-xs text-muted-foreground">
          {formatTemplate(t.tradeAnalytics.catalogSummary, {
            version: catalog.catalogVersion,
            metrics: catalog.metrics.length,
          })}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={queryError}
        onRetry={() => void reload()}
        rowKey={(dashboard) => dashboard.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAnalytics.dashboardsLoadFailed,
          emptyTitle: t.tradeAnalytics.dashboardsEmpty,
          selectAll: t.common.actions,
          selectRow: t.common.actions,
          sortAscending: t.common.actions,
          sortDescending: t.common.actions,
          notSorted: t.common.actions,
          pagination: {
            previous: t.common.previousPage,
            next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
          },
        }}
      />

      {/* This list sends no total, so there is no page count to render — only
          "there is more" and "there is a previous window". A Pagination
          control here would show a page number the server never stated. */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={previousPage}>
          {t.common.previousPage}
        </Button>
        <Button variant="outline" size="sm" disabled={nextOffset === null} onClick={nextPage}>
          {t.common.nextPage}
        </Button>
      </div>

      <CreateDashboardModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );
}
