"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  DegradedBanner,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGate,
  ReadOnlyGate,
  cn,
  iconSize,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { CreateTaxModal } from "./components/CreateTaxModal";
import { DeactivateTaxConfirmModal } from "./components/DeactivateTaxConfirmModal";
import { EditTaxModal } from "./components/EditTaxModal";
import { buildTaxColumns } from "./components/TaxColumns";
import { TaxListToolbar } from "./components/TaxListToolbar";
import { useTaxes } from "./hooks/useTaxes";
import { TAX_PAGE_SIZE_OPTIONS } from "./tax-contract";
import { formatTaxCompanyOptionsFailure } from "./tax-errors";

export default function TaxesPage() {
  const {
    t,
    lang,
    accessMode,
    isPermissionReadOnly,
    canManage,
    canCreate,
    canManageScope,
    tenantWideAllowed,
    manageableCompanies,
    companies,
    companyLoadError,
    companiesTruncated,
    retryCompanies,
    items,
    pageInfo,
    statusFilter,
    companyFilter,
    isScopeSelectOpen,
    setIsScopeSelectOpen,
    inclusiveFilter,
    search,
    hasActiveFilters,
    isLoading,
    isRefreshing,
    hasRetainedRows,
    isSubmitting,
    pendingId,
    isBusy,
    isQueryForbidden,
    queryFailure,
    formError,
    createOpen,
    editing,
    deactivating,
    setPage,
    setPageSize,
    setStatusFilter,
    setCompanyFilter,
    setInclusiveFilter,
    setSearch,
    clearAllFilters,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    openDeactivate,
    closeDeactivate,
    create,
    update,
    deactivate,
    reactivate,
    reload,
    sort,
    setSort,
  } = useTaxes();

  const companyFailure = companyLoadError
    ? formatTaxCompanyOptionsFailure(companyLoadError, t)
    : null;

  const columns = buildTaxColumns({
    t,
    lang,
    companies,
    canManage,
    canManageScope,
    isBusy,
    pendingId,
    onEdit: openEdit,
    onDeactivate: openDeactivate,
    onReactivate: (tax) => void reactivate(tax),
  });

  return (
    <PermissionGate require="taxes.tax.read" denied={!isLoading && isQueryForbidden}>
      <ReadOnlyGate
        mode={accessMode}
        labels={{
          blockedTitle: t.coreBilling.accessBlockedTitle,
          blockedDescription: t.coreBilling.accessBlockedDescription,
          readOnlyNotice: t.coreBilling.accessReadOnlyNotice,
          dunningNotice: t.coreBilling.accessDunningNotice,
        }}
      >
        <div className="flex flex-col gap-3">
          <PageHeader
            className="sr-only"
            title={t.coreSettings.taxesTitle}
            primaryAction={
              canCreate
                ? { label: t.coreSettings.taxCreate, onClick: openCreate, disabled: isBusy }
                : undefined
            }
            secondaryActions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void reload()}
                disabled={isRefreshing || isBusy}
              >
                <RefreshCw
                  className={cn(iconSize({ size: "md" }), isRefreshing && "animate-spin")}
                  aria-hidden="true"
                />
                {t.coreSettings.reload}
              </Button>
            }
          />

          {companyFailure ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground"
            >
              <div className="flex min-w-0 items-center gap-2">
                <AlertTriangle className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="font-semibold">{companyFailure.title}</span>
                  <span>{companyFailure.description}</span>
                </div>
              </div>
              {companyFailure.retryable ? (
                <Button variant="outline" size="xs" onClick={() => void retryCompanies()}>
                  {t.common.retry}
                </Button>
              ) : null}
            </div>
          ) : null}

          {companiesTruncated ? (
            <DegradedBanner message={t.coreSettings.companyOptionsTruncated} />
          ) : null}

          <Card className="w-full overflow-hidden">
            <TaxListToolbar
              t={t}
              search={search}
              statusFilter={statusFilter}
              companyFilter={companyFilter}
              isScopeSelectOpen={isScopeSelectOpen}
              inclusiveFilter={inclusiveFilter}
              companies={companies}
              hasActiveFilters={hasActiveFilters}
              isPermissionReadOnly={isPermissionReadOnly}
              onSearchChange={setSearch}
              onStatusFilterChange={setStatusFilter}
              onCompanyFilterChange={setCompanyFilter}
              onScopeSelectOpenChange={setIsScopeSelectOpen}
              onInclusiveFilterChange={setInclusiveFilter}
              onClearFilters={clearAllFilters}
            />

            {!isLoading && queryFailure && !hasRetainedRows ? (
              <ErrorState
                title={queryFailure.title}
                description={queryFailure.description}
                onRetry={queryFailure.retryable ? () => void reload() : undefined}
                retryLabel={t.common.retry}
              />
            ) : (
              <>
                {!isLoading && queryFailure && hasRetainedRows ? (
                  <div role="alert" className="border-b border-border">
                    <ErrorState
                      className="py-6"
                      title={queryFailure.title}
                      description={queryFailure.description}
                      onRetry={queryFailure.retryable ? () => void reload() : undefined}
                      retryLabel={t.common.retry}
                    />
                  </div>
                ) : null}
                <DataTable
                  surface="embedded"
                  showRowNumbers={false}
                  columns={columns}
                  rows={items}
                  isLoading={isLoading}
                  page={pageInfo}
                  onPageChange={setPage}
                  pageSizeOptions={TAX_PAGE_SIZE_OPTIONS}
                  onPageSizeChange={setPageSize}
                  hideFirstLast
                  sort={sort}
                  onSortChange={setSort}
                  rowKey={(tax) => tax.id}
                  emptyState={
                    <EmptyState
                      title={t.coreSettings.taxEmpty}
                      description={hasActiveFilters ? t.coreIdentity.picker.empty : undefined}
                      action={
                        hasActiveFilters
                          ? { label: t.coreSettings.clearFilters, onClick: clearAllFilters }
                          : canCreate
                            ? { label: t.coreSettings.taxCreate, onClick: openCreate }
                            : undefined
                      }
                    />
                  }
                  labels={{
                    retry: t.common.retry,
                    errorTitle: t.coreSettings.taxLoadFailed,
                    emptyTitle: t.coreSettings.taxEmpty,
                    selectAll: t.views.selectAll,
                    selectRow: t.views.selectRow,
                    sortAscending: t.views.sortAscending,
                    sortDescending: t.views.sortDescending,
                    notSorted: t.views.notSorted,
                    pagination: {
                      previous: t.common.previousPage,
                      next: t.common.nextPage,
                      rowsPerPage: t.common.rowsPerPage,
                      summary: (from, to, total) =>
                        formatTemplate(t.common.showingOf, { from, to, total }),
                    },
                  }}
                />
              </>
            )}
          </Card>

          <CreateTaxModal
            key={createOpen ? "create-open" : "create-closed"}
            isOpen={createOpen}
            companies={manageableCompanies}
            tenantWideAllowed={tenantWideAllowed}
            onClose={closeCreate}
            onSubmit={create}
            isSubmitting={isSubmitting}
            error={formError}
          />

          {editing ? (
            <EditTaxModal
              key={editing.id}
              tax={editing}
              companies={companies}
              onClose={closeEdit}
              onSubmit={update}
              isSubmitting={isSubmitting}
              error={formError}
            />
          ) : null}

          <DeactivateTaxConfirmModal
            tax={deactivating}
            onClose={closeDeactivate}
            onConfirm={() => void deactivate()}
            isSubmitting={deactivating !== null && pendingId === deactivating.id}
          />
        </div>
      </ReadOnlyGate>
    </PermissionGate>
  );
}
