"use client";

import Link from "next/link";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  FilterBar,
  PageHeader,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import { type WidgetRecord } from "../dashboards/analytics-contract";
import { CreateWidgetModal } from "./components/CreateWidgetModal";
import { useWidgets } from "./hooks/useWidgets";

export default function TradeWidgetsPage() {
  const {
    t,
    lang,
    branchIds,
    branchId,
    selectBranch,
    items,
    catalog,
    catalogUnavailable,
    search,
    isLoading,
    isRefreshing,
    queryError,
    isPermissionRefusal,
    createOpen,
    isSubmitting,
    formError,
    pendingId,
    setSearch,
    openCreate,
    closeCreate,
    create,
    clone,
    remove,
    reload,
  } = useWidgets();

  const columns: ColumnDef<WidgetRecord>[] = [
    {
      id: "name",
      header: t.tradeAnalytics.widgetName,
      cell: (widget) => (
        <span className="flex items-center gap-2">
          <Link
            href={`${TENANT_ROUTES.tradeWidgets}/${widget.id}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {widget.name}
          </Link>
          {widget.isShared ? <Badge tone="neutral">{t.tradeAnalytics.isShared}</Badge> : null}
        </span>
      ),
    },
    {
      id: "visualizationType",
      header: t.tradeAnalytics.visualizationType,
      cell: (widget) => tradeStatusLabel(t.tradeStatus, widget.visualizationType, t.common.unknownCode),
    },
    {
      id: "series",
      header: t.tradeAnalytics.series,
      cell: (widget) =>
        widget.series.length === 0
          ? "—"
          : widget.series.map((series) => series.metricKey).join(", "),
    },
    {
      id: "accessLevel",
      header: t.tradeAnalytics.accessLevel,
      cell: (widget) => tradeStatusLabel(t.tradeStatus, widget.accessLevel, t.common.unknownCode),
    },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (widget) => formatDateTime(widget.updatedAt, lang),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (widget) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.tradeAnalytics.clone}
            disabled={pendingId !== null}
            onClick={() => void clone(widget)}
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          {widget.accessLevel === "OWNER" ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              disabled={pendingId !== null}
              loading={pendingId === widget.id}
              onClick={() => void remove(widget)}
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
        title={t.tradeAnalytics.widgetsTitle}
        description={t.tradeAnalytics.widgetsSubtitle}
        primaryAction={{ label: t.tradeAnalytics.widgetCreate, onClick: openCreate }}
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

      {isPermissionRefusal ? (
        <DegradedBanner message={t.tradeAnalytics.serviceLevelRefusal} />
      ) : null}
      {catalogUnavailable ? (
        <DegradedBanner message={t.tradeAnalytics.catalogUnavailable} />
      ) : null}

      {/* The search box filters what was already fetched: this route accepts
          no query at all, and sending one is a 400. */}
      <FilterBar
        filters={[]}
        values={{}}
        onChange={() => undefined}
        onReset={() => setSearch("")}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t.tradeAnalytics.widgetSearch}
        filtersLabel={t.common.filter}
        clearAllLabel={t.filters.clearAll}
      />

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={queryError}
        onRetry={() => void reload()}
        rowKey={(widget) => widget.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAnalytics.widgetsLoadFailed,
          emptyTitle: search ? t.tradeCommon.emptyForFilter : t.tradeAnalytics.widgetsEmpty,
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

      <CreateWidgetModal
        key={createOpen ? "create-open" : "create-closed"}
        catalog={catalog}
        catalogUnavailable={catalogUnavailable}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );
}
