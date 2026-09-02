"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DetailSection,
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
  IMPORT_EXECUTE_PERMISSION,
  IMPORT_RUN_STATUSES,
  isImportRunStatus,
  type ImportRun,
} from "./import-contract";
import { ImportSourcePanel } from "./components/ImportSourcePanel";
import { useImportRuns } from "./hooks/useImportRuns";

export default function ImportRunsPage() {
  const {
    t,
    lang,
    canExecute,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo,
    status,
    isLoading,
    isRefreshing,
    queryError,
    sourceId,
    mappingId,
    pending,
    formError,
    setPage,
    setStatus,
    setSourceId,
    setMappingId,
    uploadSource,
    startPreview,
    reload,
  } = useImportRuns();

  const filterValues: FilterValues = status
    ? { status: { kind: "select", value: status } }
    : {};

  const columns: ColumnDef<ImportRun>[] = [
    {
      id: "createdAt",
      header: t.tradeAutomation.startedAt,
      cell: (run) => (
        <Link
          href={`${TENANT_ROUTES.tradeImports}/${run.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {formatDateTime(run.createdAt, lang)}
        </Link>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (run) => <Badge tone={runTone(run.status)}>{tradeStatusLabel(t.tradeStatus, run.status, t.common.unknownCode)}</Badge>,
    },
    {
      id: "total",
      header: t.tradeAutomation.totalRows,
      numeric: true,
      cell: (run) => String(run.totalCount),
    },
    {
      id: "valid",
      header: t.tradeAutomation.validRows,
      numeric: true,
      cell: (run) => String(run.validCount),
    },
    {
      id: "invalid",
      header: t.tradeAutomation.invalidRows,
      numeric: true,
      cell: (run) => String(run.invalidCount),
    },
    {
      id: "succeeded",
      header: t.tradeAutomation.succeededRows,
      numeric: true,
      cell: (run) => String(run.succeededCount),
    },
    {
      id: "failed",
      header: t.tradeAutomation.failedRows,
      numeric: true,
      cell: (run) => String(run.failedCount),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeAutomation.importsTitle}
        description={t.tradeAutomation.importsSubtitle}
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

      <DetailSection
        title={t.tradeAutomation.newRunTitle}
        description={t.tradeAutomation.newRunDescription}
      >
        <ImportSourcePanel
          lang={lang}
          sourceId={sourceId}
          mappingId={mappingId}
          onSourceIdChange={setSourceId}
          onMappingIdChange={setMappingId}
          onUpload={uploadSource}
          onPreview={startPreview}
          pending={pending}
          disabled={!canExecute}
          error={formError}
        />
      </DetailSection>

      <FilterBar
        filters={[
          {
            id: "status",
            kind: "select",
            label: t.common.status,
            placeholder: t.tradeCommon.anyStatus,
            options: IMPORT_RUN_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const value = next.status;
          setStatus(
            value?.kind === "select" && isImportRunStatus(value.value) ? value.value : undefined,
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
        rowKey={(run) => run.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAutomation.importsLoadFailed,
          emptyTitle: status ? t.tradeCommon.emptyForFilter : t.tradeAutomation.importsEmpty,
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

  return canExecute ? (
    content
  ) : (
    <PermissionGate require={IMPORT_EXECUTE_PERMISSION}>{content}</PermissionGate>
  );
}

/** `COMPLETED_WITH_ERRORS` is a partial success, not a failure. */
function runTone(status: string): "positive" | "caution" | "negative" | "neutral" {
  if (status === "COMPLETED") return "positive";
  if (status === "COMPLETED_WITH_ERRORS") return "caution";
  if (status === "FAILED") return "negative";
  return "neutral";
}
