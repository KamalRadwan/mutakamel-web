"use client";

import { RefreshCw, Ruler } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  EmptyState,
  FilterBar,
  IdentifierText,
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
  UOM_CONVERSION_STATUSES,
  isUomConversionStatus,
  type InventoryUomConversion,
} from "../inventory-governance-contract";
import { CreateUomConversionModal } from "./components/CreateUomConversionModal";
import { useUomConversions } from "./hooks/useUomConversions";

export default function UomConversionsPage() {
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
  } = useUomConversions();

  const filterValues: FilterValues = statusFilter
    ? { status: { kind: "select", value: statusFilter } }
    : {};

  const columns: ColumnDef<InventoryUomConversion>[] = [
    {
      id: "profile",
      header: t.tradeInventory.itemCompanyProfileId,
      cell: (row) => <IdentifierText className="text-xs">{row.itemCompanyProfileId}</IdentifierText>,
    },
    {
      id: "factor",
      header: t.tradeInventory.factor,
      numeric: true,
      // Both halves are `bigint` columns and stay exact strings — a ratio
      // rendered through Number() would round at 2^53.
      cell: (row) => `${row.factorNumerator} : ${row.factorDenominator}`,
    },
    {
      id: "revision",
      header: t.tradeInventory.revisionNumber,
      numeric: true,
      cell: (row) => String(row.revisionNumber),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <Badge tone={row.status === "PUBLISHED" ? "positive" : row.status === "RETIRED" ? "neutral" : "caution"}>
          {tradeStatusLabel(t.tradeStatus, row.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "effectiveFrom",
      header: t.tradeInventory.effectiveFrom,
      cell: (row) => formatDateTime(row.effectiveFrom, lang),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (row: InventoryUomConversion) => (
              <span className="flex items-center justify-end gap-1">
                {row.status === "DRAFT" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending !== null}
                    loading={pending?.id === row.id && pending.action === "publish"}
                    onClick={() => openTransition(row, "publish")}
                  >
                    {t.tradeCommon.publish}
                  </Button>
                ) : null}
                {row.status === "PUBLISHED" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending !== null}
                    loading={pending?.id === row.id && pending.action === "retire"}
                    onClick={() => openTransition(row, "retire")}
                  >
                    {t.tradeCommon.retire}
                  </Button>
                ) : null}
              </span>
            ),
          },
        ]
      : []),
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.conversionsTitle}
        description={t.tradeInventory.conversionsSubtitle}
        primaryAction={
          canManage ? { label: t.tradeInventory.conversionCreate, onClick: openCreate } : undefined
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
                options: UOM_CONVERSION_STATUSES.map((value) => ({
                  value,
                  label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
                })),
              },
            ]}
            values={filterValues}
            onChange={(next) => {
              const value = next.status;
              setStatusFilter(
                value?.kind === "select" && isUomConversionStatus(value.value)
                  ? value.value
                  : undefined,
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
            rowKey={(row) => row.id}
            labels={{
              retry: t.common.retry,
              errorTitle: t.tradeInventory.conversionsLoadFailed,
              emptyTitle: statusFilter
                ? t.tradeCommon.emptyForFilter
                : t.tradeInventory.conversionsEmpty,
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
          icon={Ruler}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}

      <CreateUomConversionModal
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
          transition?.action === "retire"
            ? t.tradeInventory.conversionRetireTitle
            : t.tradeInventory.conversionPublishTitle
        }
        description={t.tradeInventory.conversionTransitionDescription}
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
