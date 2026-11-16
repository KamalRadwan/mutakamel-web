"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Button,
  DataTable,
  DegradedBanner,
  EmptyState,
  ErrorState,
  NotFoundState,
  PageHeader,
  PermissionGate,
  ReadOnlyGate,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { CreateNumberingSequenceModal } from "./components/CreateNumberingSequenceModal";
import { EditNumberingSequenceModal } from "./components/EditNumberingSequenceModal";
import { buildNumberingColumns } from "./components/NumberingColumns";
import { NumberingToolbar } from "./components/NumberingToolbar";
import { useNumberingSequences } from "./hooks/useNumberingSequences";

export default function NumberingPage() {
  const {
    t,
    lang,
    canManage,
    canCreate,
    canManageScope,
    effectiveAccessMode,
    readOnlyLabels,
    tenantWideAllowed,
    manageableCompanies,
    companies,
    companyFailure,
    companiesTruncated,
    retryCompanies,
    items,
    hasRetainedRows,
    pageInfo,
    companyFilter,
    search,
    hasActiveFilters,
    clearAllFilters,
    isLoading,
    isRefreshing,
    isSubmitting,
    isQueryForbidden,
    isQueryNotFound,
    queryFailure,
    formError,
    formFieldErrors,
    clearServerFieldError,
    createOpen,
    editing,
    editingNotFound,
    setPage,
    setCompanyFilter,
    setSearch,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    create,
    update,
    reload,
    sort,
    setSort,
  } = useNumberingSequences();

  const columns = buildNumberingColumns({
    t,
    lang,
    companies,
    canManage,
    canManageScope,
    isSubmitting,
    onEdit: openEdit,
  });

  return (
    <PermissionGate require="numbering.read" denied={!isLoading && isQueryForbidden}>
      <ReadOnlyGate mode={effectiveAccessMode} labels={readOnlyLabels}>
        <div className="flex flex-col gap-4">
          <PageHeader
            className="sr-only"
            title={t.coreSettings.numberingTitle}
            primaryAction={
              canCreate
                ? { label: t.coreSettings.numberingCreate, onClick: openCreate }
                : undefined
            }
          />

          <NumberingToolbar
            companies={companies}
            companyFilter={companyFilter}
            onCompanyFilterChange={setCompanyFilter}
            searchValue={search}
            onSearchChange={setSearch}
            hasActiveFilters={hasActiveFilters}
            onReset={clearAllFilters}
            isRefreshing={isRefreshing}
            onReload={() => void reload()}
          />

          {companyFailure ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium text-foreground">{companyFailure.title}</span>
                  <span className="text-muted-foreground">{companyFailure.description}</span>
                </div>
              </div>
              {companyFailure.retryable ? (
                <Button type="button" variant="outline" size="xs" onClick={() => void retryCompanies()}>
                  <RefreshCw className="size-3" aria-hidden="true" />
                  {t.common.retry}
                </Button>
              ) : null}
            </div>
          ) : null}

          {companiesTruncated ? (
            <DegradedBanner message={t.coreSettings.companyOptionsTruncated} />
          ) : null}

          {!isLoading && isQueryNotFound && queryFailure ? (
            <NotFoundState
              title={queryFailure.title}
              description={queryFailure.description}
              backLabel={t.coreSettings.clearFilters}
              onBack={hasActiveFilters ? clearAllFilters : undefined}
            />
          ) : !isLoading && queryFailure && !hasRetainedRows ? (
            <ErrorState
              title={queryFailure.title}
              description={queryFailure.description}
              onRetry={queryFailure.retryable ? () => void reload() : undefined}
              retryLabel={t.common.retry}
            />
          ) : (
            <>
              {!isLoading && queryFailure && hasRetainedRows ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <AlertTriangle
                      className="mt-0.5 size-3.5 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium text-foreground">{queryFailure.title}</span>
                      <span className="text-muted-foreground">{queryFailure.description}</span>
                    </div>
                  </div>
                  {queryFailure.retryable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isRefreshing}
                      onClick={() => void reload()}
                    >
                      <RefreshCw className="size-3" aria-hidden="true" />
                      {t.common.retry}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <DataTable
                showRowNumbers={false}
                columns={columns}
                rows={items}
                isLoading={isLoading}
                error={null}
                onRetry={() => void reload()}
                page={pageInfo}
                onPageChange={setPage}
                sort={sort}
                onSortChange={setSort}
                rowKey={(sequence) => sequence.id}
                emptyState={
                  <EmptyState
                    title={t.coreSettings.numberingEmpty}
                    action={
                      hasActiveFilters
                        ? { label: t.coreSettings.clearFilters, onClick: clearAllFilters }
                        : canCreate
                          ? { label: t.coreSettings.numberingCreate, onClick: openCreate }
                          : undefined
                    }
                  />
                }
                labels={{
                  retry: t.common.retry,
                  errorTitle: t.coreSettings.numberingLoadFailed,
                  emptyTitle: t.coreSettings.numberingEmpty,
                  selectAll: t.views.selectAll,
                  selectRow: t.views.selectRow,
                  sortAscending: t.views.sortAscending,
                  sortDescending: t.views.sortDescending,
                  notSorted: t.views.notSorted,
                  pagination: {
                    previous: t.common.previousPage,
                    next: t.common.nextPage,
                    summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
                  },
                }}
              />
            </>
          )}

          {canManage ? (
            <CreateNumberingSequenceModal
              key={createOpen ? "create-open" : "create-closed"}
              isOpen={createOpen}
              companies={manageableCompanies}
              tenantWideAllowed={tenantWideAllowed}
              onClose={closeCreate}
              onSubmit={create}
              isSubmitting={isSubmitting}
              error={formError}
              serverFieldErrors={formFieldErrors}
              onClearServerError={clearServerFieldError}
            />
          ) : null}

          {canManage && editing ? (
            <EditNumberingSequenceModal
              key={`edit-${editing.id}`}
              sequence={editing}
              companies={companies}
              onClose={closeEdit}
              onSubmit={update}
              isSubmitting={isSubmitting}
              error={formError}
              serverFieldErrors={formFieldErrors}
              onClearServerError={clearServerFieldError}
              notFound={editingNotFound}
            />
          ) : null}
        </div>
      </ReadOnlyGate>
    </PermissionGate>
  );
}
