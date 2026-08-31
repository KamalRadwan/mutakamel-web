"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  FilterBar,
  PageHeader,
  PermissionGate,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import {
  CONTROL_TOWER_READ_PERMISSION,
  EXCEPTION_SEVERITY_FILTERS,
  EXCEPTION_STATUSES,
  isExceptionSeverityFilter,
  isExceptionStatus,
  type ControlTowerException,
} from "./control-tower-contract";
import { useControlTower } from "./hooks/useControlTower";

export default function ControlTowerPage() {
  const {
    t,
    lang,
    canRead,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo,
    status,
    severity,
    category,
    isLoading,
    isRefreshing,
    queryError,
    isEntitlementRefusal,
    setPage,
    setStatus,
    setSeverity,
    setCategory,
    reload,
  } = useControlTower();

  const filterValues: FilterValues = {
    ...(status ? { status: { kind: "select" as const, value: status } } : {}),
    ...(severity ? { severity: { kind: "select" as const, value: severity } } : {}),
  };

  const columns: ColumnDef<ControlTowerException>[] = [
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (exception) => (
        <Link
          href={`${TENANT_ROUTES.tradeControlTower}/${exception.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {formatDateTime(exception.updatedAt, lang)}
        </Link>
      ),
    },
    { id: "category", header: t.tradeControlTower.category, cell: (exception) => exception.category },
    {
      id: "sourceOwner",
      header: t.tradeControlTower.sourceOwner,
      cell: (exception) => exception.sourceOwner,
    },
    {
      id: "severity",
      // Rendered as it arrives: the filter list, the exported enum and the
      // literals actually written do not agree, so mapping would misname it.
      header: t.tradeControlTower.severity,
      cell: (exception) =>
        exception.severity === "" ? (
          "—"
        ) : (
          <Badge tone={severityTone(exception.severity)}>
            {tradeStatusLabel(t.tradeStatus, exception.severity)}
          </Badge>
        ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (exception) => (
        <Badge tone={exception.status === "RESOLVED" ? "positive" : "caution"}>
          {tradeStatusLabel(t.tradeStatus, exception.status)}
        </Badge>
      ),
    },
    {
      id: "safeErrorCode",
      header: t.tradeControlTower.safeErrorCode,
      cell: (exception) => exception.safeErrorCode,
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeControlTower.title}
        description={t.tradeControlTower.subtitle}
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

      {isEntitlementRefusal ? (
        <DegradedBanner message={t.tradeControlTower.entitlementRefusal} />
      ) : null}

      <FilterBar
        filters={[
          {
            id: "status",
            kind: "select",
            label: t.common.status,
            placeholder: t.tradeCommon.anyStatus,
            options: EXCEPTION_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value),
            })),
          },
          {
            id: "severity",
            kind: "select",
            label: t.tradeControlTower.severity,
            placeholder: t.tradeCommon.anyStatus,
            // Built from the QUERY DTO's list, not from ExceptionSeverity:
            // filtering by INFO or WARNING is a 400.
            options: EXCEPTION_SEVERITY_FILTERS.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const statusValue = next.status;
          const severityValue = next.severity;
          setStatus(
            statusValue?.kind === "select" && isExceptionStatus(statusValue.value)
              ? statusValue.value
              : undefined,
          );
          setSeverity(
            severityValue?.kind === "select" && isExceptionSeverityFilter(severityValue.value)
              ? severityValue.value
              : undefined,
          );
        }}
        onReset={() => {
          setStatus(undefined);
          setSeverity(undefined);
          setCategory("");
        }}
        searchValue={category}
        onSearchChange={setCategory}
        searchPlaceholder={t.tradeControlTower.categorySearch}
        filtersLabel={t.common.filter}
        clearAllLabel={t.filters.clearAll}
      />

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={queryError}
        onRetry={() => void reload()}
        page={pageInfo}
        onPageChange={setPage}
        rowKey={(exception) => exception.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeControlTower.loadFailed,
          emptyTitle:
            status || severity || category ? t.tradeCommon.emptyForFilter : t.tradeControlTower.empty,
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
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={CONTROL_TOWER_READ_PERMISSION}>{content}</PermissionGate>
  );
}

function severityTone(severity: string): "negative" | "caution" | "neutral" {
  if (severity === "CRITICAL") return "negative";
  if (severity === "HIGH" || severity === "MEDIUM" || severity === "WARNING") return "caution";
  return "neutral";
}
