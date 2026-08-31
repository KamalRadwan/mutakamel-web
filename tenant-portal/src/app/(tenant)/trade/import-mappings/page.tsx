"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../trade-advanced-validation";
import { IMPORT_MANAGE_PERMISSION } from "../imports/import-contract";
import {
  IMPORT_MAPPING_STATUSES,
  isImportMappingStatus,
  type ImportMapping,
} from "./import-mapping-contract";
import { CreateImportMappingModal } from "./components/CreateImportMappingModal";
import { useImportMappings } from "./hooks/useImportMappings";

export default function ImportMappingsPage() {
  const {
    t,
    lang,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo,
    status,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    setPage,
    setStatus,
    openCreate,
    closeCreate,
    create,
    reload,
  } = useImportMappings();

  const filterValues: FilterValues = status
    ? { status: { kind: "select", value: status } }
    : {};

  const columns: ColumnDef<ImportMapping>[] = [
    {
      id: "code",
      header: t.tradeAutomation.code,
      cell: (mapping) => (
        <Link
          href={`${TENANT_ROUTES.tradeImportMappings}/${mapping.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {mapping.code}
        </Link>
      ),
    },
    {
      id: "targetCode",
      header: t.tradeAutomation.targetCode,
      cell: (mapping) => tradeStatusLabel(t.tradeStatus, mapping.targetCode),
    },
    {
      id: "scopeTarget",
      header: t.tradeGovernance.scopeTarget,
      cell: (mapping) => tradeStatusLabel(t.tradeStatus, mapping.scopeTarget),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (mapping) => (
        <Badge tone={mapping.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, mapping.status)}
        </Badge>
      ),
    },
    {
      id: "id",
      // The runs screen takes a mapping id by hand, because listing mappings
      // and listing runs need different grants — so the id is shown here.
      header: t.tradeAutomation.mappingId,
      cell: (mapping) => <span className="font-mono text-xs">{mapping.id}</span>,
    },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (mapping) => formatDateTime(mapping.updatedAt, lang),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeAutomation.mappingsTitle}
        description={t.tradeAutomation.mappingsSubtitle}
        primaryAction={
          canManage ? { label: t.tradeAutomation.mappingCreate, onClick: openCreate } : undefined
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

      <FilterBar
        filters={[
          {
            id: "status",
            kind: "select",
            label: t.common.status,
            placeholder: t.tradeCommon.anyStatus,
            options: IMPORT_MAPPING_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const value = next.status;
          setStatus(
            value?.kind === "select" && isImportMappingStatus(value.value)
              ? value.value
              : undefined,
          );
        }}
        onReset={() => setStatus(undefined)}
        searchValue=""
        onSearchChange={() => undefined}
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
        rowKey={(mapping) => mapping.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAutomation.mappingsLoadFailed,
          emptyTitle: status ? t.tradeCommon.emptyForFilter : t.tradeAutomation.mappingsEmpty,
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

      <CreateImportMappingModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );

  return canManage ? (
    content
  ) : (
    <PermissionGate require={IMPORT_MANAGE_PERMISSION}>{content}</PermissionGate>
  );
}
