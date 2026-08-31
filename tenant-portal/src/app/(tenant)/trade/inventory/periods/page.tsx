"use client";

import { CalendarRange, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  ReasonDialog,
  SubNav,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { TRADE_INVENTORY_NAV_ITEMS } from "../inventory-nav";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import {
  INVENTORY_LIST_LIMIT,
  PERIOD_STATUSES,
  isPeriodStatus,
  type InventoryPeriod,
} from "../inventory-governance-contract";
import { CreatePeriodModal } from "./components/CreatePeriodModal";
import { useInventoryPeriods } from "./hooks/useInventoryPeriods";

export default function InventoryPeriodsPage() {
  const {
    t,
    lang,
    canRead,
    canManage,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    statusFilter,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    pending,
    transition,
    setStatusFilter,
    openCreate,
    closeCreate,
    openTransition,
    closeTransition,
    create,
    runTransition,
    reload,
  } = useInventoryPeriods();

  const filterValues: FilterValues = statusFilter
    ? { status: { kind: "select", value: statusFilter } }
    : {};

  const columns: ColumnDef<InventoryPeriod>[] = [
    { id: "code", header: t.tradeInventory.periodCode, cell: (period) => period.code },
    { id: "startsOn", header: t.tradeInventory.periodStartsOn, cell: (period) => period.startsOn },
    { id: "endsOn", header: t.tradeInventory.periodEndsOn, cell: (period) => period.endsOn },
    {
      id: "status",
      header: t.common.status,
      cell: (period) => (
        <Badge tone={period.status === "OPEN" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, period.status)}
        </Badge>
      ),
    },
    {
      id: "backdate",
      header: t.tradeInventory.periodMaxBackdateDays,
      numeric: true,
      cell: (period) => String(period.maxBackdateDays),
    },
    {
      id: "closedAt",
      header: t.tradeInventory.periodClosedAt,
      cell: (period) => (period.closedAt ? formatDateTime(period.closedAt, lang) : "—"),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (period: InventoryPeriod) => (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending !== null}
                loading={pending?.id === period.id}
                onClick={() => openTransition(period, period.status === "OPEN" ? "close" : "reopen")}
              >
                {period.status === "OPEN" ? t.tradeInventory.periodClose : t.tradeInventory.periodReopen}
              </Button>
            ),
          },
        ]
      : []),
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.periodsTitle}
        description={t.tradeInventory.periodsSubtitle}
        primaryAction={
          canManage ? { label: t.tradeInventory.periodCreate, onClick: openCreate } : undefined
        }
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

      <SubNav items={TRADE_INVENTORY_NAV_ITEMS} />

      {isScopeResolved ? (
        <>
          <FilterBar
            filters={[
              {
                id: "status",
                kind: "select",
                label: t.common.status,
                placeholder: t.tradeCommon.anyStatus,
                options: PERIOD_STATUSES.map((value) => ({
                  value,
                  label: tradeStatusLabel(t.tradeStatus, value),
                })),
              },
            ]}
            values={filterValues}
            onChange={(next) => {
              const value = next.status;
              setStatusFilter(
                value?.kind === "select" && isPeriodStatus(value.value) ? value.value : undefined,
              );
            }}
            onReset={() => setStatusFilter(undefined)}
            searchValue=""
            onSearchChange={() => undefined}
            filtersLabel={t.common.filter}
            clearAllLabel={t.filters.clearAll}
          />

          {items.length === INVENTORY_LIST_LIMIT ? (
            <DegradedBanner
              message={formatTemplate(t.tradeCommon.limitOnlyCapped, {
                limit: INVENTORY_LIST_LIMIT,
              })}
            />
          ) : null}

          <DataTable
            columns={columns}
            rows={items}
            isLoading={isLoading}
            error={queryError}
            onRetry={() => void reload()}
            rowKey={(period) => period.id}
            labels={{
              retry: t.common.retry,
              errorTitle: t.tradeInventory.periodsLoadFailed,
              emptyTitle: statusFilter
                ? t.tradeCommon.emptyForFilter
                : t.tradeInventory.periodsEmpty,
              selectAll: t.common.actions,
              selectRow: t.common.actions,
              sortAscending: t.common.actions,
              sortDescending: t.common.actions,
              notSorted: t.common.actions,
              pagination: {
                previous: t.common.previousPage,
                next: t.common.nextPage,
                summary: (from, to, total) =>
                  formatTemplate(t.common.showingOf, { from, to, total }),
              },
            }}
          />
        </>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}

      <CreatePeriodModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />

      <ReasonDialog
        open={transition !== null}
        onOpenChange={(open) => {
          if (!open) closeTransition();
        }}
        title={
          transition?.action === "reopen"
            ? t.tradeInventory.periodReopenTitle
            : t.tradeInventory.periodCloseTitle
        }
        description={t.tradeInventory.periodTransitionDescription}
        reasonRequired
        maxLength={80}
        onConfirm={(reason) => void runTransition(reason)}
        loading={pending !== null}
        labels={{
          reason: t.tradeInventory.reasonCode,
          reasonHint: t.tradeInventory.reasonCodeHint,
          confirm: t.tradeCommon.confirm,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
