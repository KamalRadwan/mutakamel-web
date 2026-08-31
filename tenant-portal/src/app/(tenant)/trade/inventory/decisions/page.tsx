"use client";

import Link from "next/link";
import { Gavel, RefreshCw } from "lucide-react";
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
  INVENTORY_POLICY_KINDS,
  isInventoryPolicyKind,
  type InventoryDecision,
} from "../inventory-governance-contract";
import { useInventoryDecisions } from "./hooks/useInventoryDecisions";

export default function InventoryDecisionsPage() {
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    policyKind,
    isLoading,
    isRefreshing,
    queryError,
    setPolicyKind,
    reload,
  } = useInventoryDecisions();

  const filterValues: FilterValues = policyKind
    ? { policyKind: { kind: "select", value: policyKind } }
    : {};

  const columns: ColumnDef<InventoryDecision>[] = [
    {
      id: "evaluatedAt",
      header: t.tradeInventory.evaluatedAt,
      cell: (decision) => (
        <Link
          href={`${TENANT_ROUTES.tradeInventoryDecisions}/${decision.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {formatDateTime(decision.evaluatedAt, lang)}
        </Link>
      ),
    },
    {
      id: "decisionType",
      header: t.tradeInventory.decisionType,
      cell: (decision) => tradeStatusLabel(t.tradeStatus, decision.decisionType),
    },
    {
      id: "aggregateType",
      header: t.tradeInventory.aggregateType,
      cell: (decision) => tradeStatusLabel(t.tradeStatus, decision.aggregateType),
    },
    {
      id: "outcome",
      header: t.tradeInventory.outcome,
      cell: (decision) =>
        decision.outcome ? (
          <Badge tone={decision.outcome === "ALLOW" ? "positive" : "caution"}>
            {tradeStatusLabel(t.tradeStatus, decision.outcome)}
          </Badge>
        ) : (
          "—"
        ),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.decisionsTitle}
        description={t.tradeInventory.decisionsSubtitle}
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
                id: "policyKind",
                kind: "select",
                label: t.tradeInventory.policyKind,
                placeholder: t.tradeCommon.anyStatus,
                options: INVENTORY_POLICY_KINDS.map((value) => ({
                  value,
                  label: tradeStatusLabel(t.tradeStatus, value),
                })),
              },
            ]}
            values={filterValues}
            onChange={(next) => {
              const value = next.policyKind;
              setPolicyKind(
                value?.kind === "select" && isInventoryPolicyKind(value.value)
                  ? value.value
                  : undefined,
              );
            }}
            onReset={() => setPolicyKind(undefined)}
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
            rowKey={(decision) => decision.id}
            labels={{
              retry: t.common.retry,
              errorTitle: t.tradeInventory.decisionsLoadFailed,
              emptyTitle: policyKind
                ? t.tradeCommon.emptyForFilter
                : t.tradeInventory.decisionsEmpty,
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
          icon={Gavel}
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
