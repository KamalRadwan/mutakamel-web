"use client";

import { use } from "react";
import { Play, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  FilterBar,
  NotFoundState,
  PermissionGate,
  Skeleton,
  StatCard,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  IMPORT_EXECUTE_PERMISSION,
  IMPORT_RESULT_STATUSES,
  isImportResultStatus,
  type ImportResultRow,
} from "../import-contract";
import { useImportRun } from "./hooks/useImportRun";

export default function ImportRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const { t } = useI18n();
  const {
    lang,
    canExecute,
    run,
    rows,
    rowsUnavailable,
    rowsPageInfo,
    rowStatus,
    isLoading,
    queryError,
    isNotFound,
    isInFlight,
    isExecuting,
    actionError,
    setPage,
    setRowStatus,
    execute,
    reload,
  } = useImportRun(runId);

  const filterValues: FilterValues = rowStatus
    ? { status: { kind: "select", value: rowStatus } }
    : {};

  const columns: ColumnDef<ImportResultRow>[] = [
    {
      id: "rowNumber",
      header: t.tradeAutomation.rowNumber,
      numeric: true,
      cell: (row) => String(row.rowNumber),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => <Badge tone={rowTone(row.status)}>{tradeStatusLabel(t.tradeStatus, row.status)}</Badge>,
    },
    {
      id: "errorCode",
      // A row error code is data on the row, not an HTTP status — including
      // TRADE.AUTH.TARGET_DENIED, which appears here as a row failure reason.
      header: t.tradeAutomation.rowErrorCode,
      cell: (row) => row.errorCode ?? "—",
    },
    {
      id: "errorFieldCode",
      header: t.tradeAutomation.rowErrorField,
      cell: (row) => row.errorFieldCode ?? "—",
    },
    {
      id: "completedAt",
      header: t.tradeAutomation.rowCompletedAt,
      cell: (row) => (row.completedAt ? formatDateTime(row.completedAt, lang) : "—"),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={t.tradeAutomation.runDetailTitle}
        subtitle={run ? formatDateTime(run.createdAt, lang) : undefined}
        status={
          run ? (
            <Badge tone={runTone(run.status)}>{tradeStatusLabel(t.tradeStatus, run.status)}</Badge>
          ) : undefined
        }
        backLabel={t.tradeAutomation.backToRuns}
        backHref={TENANT_ROUTES.tradeImports}
        secondaryActions={
          run ? (
            <>
              <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
                <RefreshCw
                  className={isLoading ? "size-4 animate-spin" : "size-4"}
                  aria-hidden="true"
                />
                {t.tradeCommon.reload}
              </Button>
              <Button
                variant="outline"
                disabled={!canExecute || isExecuting}
                loading={isExecuting}
                onClick={() => void execute()}
              >
                <Play className="size-4" aria-hidden="true" />
                {t.tradeAutomation.execute}
              </Button>
            </>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeAutomation.runNotFound}
          description={t.tradeAutomation.runNotFoundDescription}
          backLabel={t.tradeAutomation.backToRuns}
          backHref={TENANT_ROUTES.tradeImports}
        />
      ) : isLoading ? (
        <Skeleton className="h-80" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeAutomation.runLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : run ? (
        <>
          {actionError ? <DegradedBanner message={actionError} /> : null}
          {isInFlight ? <DegradedBanner message={t.tradeAutomation.runInFlight} /> : null}
          {run.status === "COMPLETED_WITH_ERRORS" ? (
            <DegradedBanner message={t.tradeAutomation.runPartialSuccess} />
          ) : null}
          {/* No download control: there is no route that returns the result
              file (Q39). The outcome is rendered here instead. */}
          <p className="text-xs text-muted-foreground">{t.tradeAutomation.noResultDownload}</p>

          <div className="grid gap-3 md:grid-cols-5">
            <StatCard label={t.tradeAutomation.totalRows} value={String(run.totalCount)} />
            <StatCard label={t.tradeAutomation.validRows} value={String(run.validCount)} />
            <StatCard label={t.tradeAutomation.invalidRows} value={String(run.invalidCount)} />
            <StatCard label={t.tradeAutomation.succeededRows} value={String(run.succeededCount)} />
            <StatCard label={t.tradeAutomation.failedRows} value={String(run.failedCount)} />
          </div>

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              { label: t.tradeAutomation.mappingId, value: run.mappingId },
              { label: t.tradeAutomation.sourceId, value: run.sourceId },
              { label: t.tradeAutomation.mediaType, value: run.mediaType },
              { label: t.tradeCommon.version, value: String(run.version) },
              { label: t.tradeCommon.updatedAt, value: formatDateTime(run.updatedAt, lang) },
            ]}
          />

          <DetailSection title={t.tradeAutomation.rows}>
            {rowsUnavailable ? (
              <DegradedBanner message={t.tradeAutomation.rowsUnavailable} />
            ) : null}
            <FilterBar
              filters={[
                {
                  id: "status",
                  kind: "select",
                  label: t.common.status,
                  placeholder: t.tradeCommon.anyStatus,
                  options: IMPORT_RESULT_STATUSES.map((value) => ({
                    value,
                    label: tradeStatusLabel(t.tradeStatus, value),
                  })),
                },
              ]}
              values={filterValues}
              onChange={(next) => {
                const value = next.status;
                setRowStatus(
                  value?.kind === "select" && isImportResultStatus(value.value)
                    ? value.value
                    : undefined,
                );
              }}
              onReset={() => setRowStatus(undefined)}
              searchValue=""
              onSearchChange={() => undefined}
              filtersLabel={t.common.filter}
              clearAllLabel={t.filters.clearAll}
            />
            <DataTable
              columns={columns}
              rows={rows}
              isLoading={false}
              page={rowsPageInfo}
              onPageChange={setPage}
              rowKey={(row) => `${row.rowNumber}-${row.stableRowKey}`}
              labels={{
                retry: t.common.retry,
                errorTitle: t.tradeAutomation.rowsLoadFailed,
                emptyTitle: rowStatus ? t.tradeCommon.emptyForFilter : t.tradeAutomation.rowsEmpty,
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
          </DetailSection>
        </>
      ) : null}
    </div>
  );

  return canExecute ? (
    content
  ) : (
    <PermissionGate require={IMPORT_EXECUTE_PERMISSION}>{content}</PermissionGate>
  );
}

function runTone(status: string): "positive" | "caution" | "negative" | "neutral" {
  if (status === "COMPLETED") return "positive";
  if (status === "COMPLETED_WITH_ERRORS") return "caution";
  if (status === "FAILED") return "negative";
  return "neutral";
}

function rowTone(status: string): "positive" | "caution" | "negative" | "neutral" {
  if (status === "VALID" || status === "SUCCEEDED") return "positive";
  if (status === "SKIPPED") return "caution";
  if (status === "INVALID" || status === "FAILED") return "negative";
  return "neutral";
}
