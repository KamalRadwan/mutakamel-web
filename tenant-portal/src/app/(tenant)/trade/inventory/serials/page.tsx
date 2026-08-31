"use client";

import Link from "next/link";
import { RefreshCw, ScanBarcode } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { TRADE_INVENTORY_NAV_ITEMS } from "../inventory-nav";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import {
  INVENTORY_LIST_LIMIT,
  SERIAL_STATES,
  isSerialState,
  type InventorySerial,
} from "../inventory-governance-contract";
import { useInventorySerials } from "./hooks/useInventorySerials";

export default function InventorySerialsPage() {
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    stateFilter,
    search,
    isLoading,
    isRefreshing,
    queryError,
    setStateFilter,
    setSearch,
    reload,
  } = useInventorySerials();

  const filterValues: FilterValues = stateFilter
    ? { state: { kind: "select", value: stateFilter } }
    : {};

  const columns: ColumnDef<InventorySerial>[] = [
    {
      id: "serialKey",
      header: t.tradeInventory.serialKey,
      cell: (serial) => (
        <Link
          href={`${TENANT_ROUTES.tradeInventorySerials}/${serial.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {serial.serialKey}
        </Link>
      ),
    },
    {
      id: "state",
      header: t.tradeInventory.serialState,
      cell: (serial) => (
        <Badge tone={serialTone(serial.state)}>
          {tradeStatusLabel(t.tradeStatus, serial.state)}
        </Badge>
      ),
    },
    {
      id: "node",
      header: t.tradeInventory.currentNode,
      cell: (serial) =>
        serial.currentFulfillmentNodeId ? (
          <span className="font-mono text-xs">{serial.currentFulfillmentNodeId}</span>
        ) : (
          "—"
        ),
    },
    {
      id: "lastTransitionAt",
      header: t.tradeInventory.lastTransitionAt,
      cell: (serial) => formatDateTime(serial.lastTransitionAt, lang),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.serialsTitle}
        description={t.tradeInventory.serialsSubtitle}
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
                id: "state",
                kind: "select",
                label: t.tradeInventory.serialState,
                placeholder: t.tradeCommon.anyStatus,
                options: SERIAL_STATES.map((value) => ({
                  value,
                  label: tradeStatusLabel(t.tradeStatus, value),
                })),
              },
            ]}
            values={filterValues}
            onChange={(next) => {
              const value = next.state;
              setStateFilter(
                value?.kind === "select" && isSerialState(value.value) ? value.value : undefined,
              );
            }}
            onReset={() => setStateFilter(undefined)}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.tradeInventory.serialExactSearch}
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
            rowKey={(serial) => serial.id}
            labels={{
              retry: t.common.retry,
              errorTitle: t.tradeInventory.serialsLoadFailed,
              emptyTitle:
                stateFilter || search ? t.tradeCommon.emptyForFilter : t.tradeInventory.serialsEmpty,
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
          icon={ScanBarcode}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}

function serialTone(state: string): "positive" | "caution" | "negative" | "neutral" {
  if (state === "ON_HAND") return "positive";
  if (state === "RESERVED") return "caution";
  if (state === "VOIDED") return "negative";
  return "neutral";
}
