"use client";

import { PackageCheck, RefreshCw, ShieldAlert } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  DataTableSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGate,
  ReadOnlyGate,
  type ColumnDef,
} from "@/design-system";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatTemplate } from "@/lib/format/template";
import { ApplyUpdatesModal } from "./components/ApplyUpdatesModal";
import { UpdateOperationModal } from "./components/UpdateOperationModal";
import { UpdatesFilterCard } from "./components/UpdatesFilterCard";
import { UpdatesTableCard } from "./components/UpdatesTableCard";
import { UpdatesUncertainNotice } from "./components/UpdatesUncertainNotice";
import type { UpdatesReadFailure } from "./hooks/useProvisioningOperationTracker";
import { useProvisioningUpdates } from "./hooks/useProvisioningUpdates";

const SKELETON_COLUMNS: ColumnDef<unknown>[] = [
  { id: "component", header: "", cell: () => null },
  { id: "current", header: "", cell: () => null },
  { id: "target", header: "", cell: () => null },
  { id: "risk", header: "", cell: () => null },
  { id: "requirements", header: "", cell: () => null },
  { id: "status", header: "", cell: () => null },
];

export default function WorkspaceComponentUpdatesPage() {
  const {
    t,
    lang,
    describeError,
    canReadTenantWide,
    canManageEffective,
    effectiveAccessMode,
    readOnlyLabels,
    filters,
    sort,
    hasActiveFilters,
    isComponentFilterValid,
    items,
    pageInfo,
    selectableItems,
    selectedKeys,
    selectedItems,
    isModalOpen,
    setIsModalOpen,
    modalPhase,
    modalSnapshot,
    staleConflictMessage,
    isConsented,
    setConsent,
    isLoading,
    isApplying,
    isCheckingOperation,
    isQueryForbidden,
    loadFailure,
    requiresReconciliation,
    canConfirmFresh,
    activeOperation,
    correlatedOperationItems,
    hasTrackedOperation,
    isOperationModalOpen,
    setIsOperationModalOpen,
    operationFailure,
    hasAmbiguousOutcome,
    updateFilters,
    clearFilters,
    setSort,
    setPage,
    toggleSelection,
    toggleSelectAll,
    confirmApply,
    reloadFromStaleModal,
    retryAmbiguous,
    refreshActiveOperation,
    reload,
  } = useProvisioningUpdates();

  const updatesUi = t.coreSettings.updatesUi;
  const formatNumber = (value: number) => new Intl.NumberFormat(INTL_LOCALE[lang]).format(value);
  const resolveFailureMessage = (failure: UpdatesReadFailure | null): string | null => {
    if (!failure) return null;
    if (failure.kind === "invalidResponse") {
      return t.coreSettings.invalidResponseDescription;
    }
    return describeError(failure.error) ?? t.coreIdentity.errors.UNKNOWN;
  };
  const loadErrorMessage = resolveFailureMessage(loadFailure);
  const operationErrorMessage = resolveFailureMessage(operationFailure);
  const retainedListRefreshError =
    !requiresReconciliation && loadErrorMessage && items.length > 0 ? loadErrorMessage : null;
  const canRetryAmbiguous = canManageEffective && !isQueryForbidden && !requiresReconciliation;

  const showHeaderPrimaryAction =
    !isModalOpen &&
    !isOperationModalOpen &&
    canManageEffective &&
    selectedItems.length > 0 &&
    !hasAmbiguousOutcome &&
    !requiresReconciliation;

  return (
    <PermissionGate require="workspace.read" denied={!isLoading && isQueryForbidden}>
      <div className="flex flex-col gap-3.5">
        <PageHeader
          className="sr-only"
          title={updatesUi.title}
          primaryAction={
            showHeaderPrimaryAction
              ? {
                  label: formatTemplate(updatesUi.applySelected, {
                    count: formatNumber(selectedItems.length),
                  }),
                  icon: <PackageCheck className="size-3.5" aria-hidden="true" />,
                  onClick: () => setIsModalOpen(true),
                  disabled: !canConfirmFresh,
                  loading: isApplying,
                }
              : undefined
          }
          secondaryActions={
            canReadTenantWide ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void reload()}
                disabled={isLoading || isApplying}
              >
                <RefreshCw
                  className={isLoading ? "size-3.5 animate-spin" : "size-3.5"}
                  aria-hidden="true"
                />
                {updatesUi.refreshDiscovery}
              </Button>
            ) : undefined
          }
        />

        {!canReadTenantWide ? (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                icon={ShieldAlert}
                title={updatesUi.tenantWideRequiredTitle}
                description={updatesUi.tenantWideRequiredDescription}
              />
            </CardContent>
          </Card>
        ) : (
          <ReadOnlyGate mode={effectiveAccessMode} labels={readOnlyLabels}>
            {hasAmbiguousOutcome && !isModalOpen ? (
              <UpdatesUncertainNotice
                title={updatesUi.ambiguousTitle}
                description={updatesUi.ambiguousDescription}
                hint={updatesUi.ambiguousRetryHint}
                retryLabel={updatesUi.ambiguousRetryCta}
                onRetry={() => void retryAmbiguous()}
                isRetrying={isApplying}
                retryDisabled={!canRetryAmbiguous}
                secondaryLabel={updatesUi.refreshDiscovery}
                onSecondary={() => void reload()}
                isSecondaryLoading={isLoading}
              />
            ) : null}

            {requiresReconciliation ? (
              <UpdatesUncertainNotice
                title={updatesUi.unreadableAcceptedTitle}
                description={updatesUi.unreadableAcceptedDescription}
                errorDetail={loadErrorMessage ?? operationErrorMessage}
                retryLabel={updatesUi.refreshDiscovery}
                onRetry={() => void reload()}
                isRetrying={isLoading || isCheckingOperation}
              />
            ) : retainedListRefreshError ? (
              <UpdatesUncertainNotice
                title={updatesUi.loadFailed}
                description={retainedListRefreshError}
                retryLabel={t.common.retry}
                onRetry={() => void reload()}
                isRetrying={isLoading}
              />
            ) : null}

            <UpdatesFilterCard
              t={t}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              isComponentFilterValid={isComponentFilterValid}
              onUpdateFilters={updateFilters}
              onClearFilters={clearFilters}
            />

            {isLoading && items.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <DataTableSkeleton columns={SKELETON_COLUMNS} rows={6} density="compact" />
                </CardContent>
              </Card>
            ) : loadErrorMessage && items.length === 0 && !requiresReconciliation ? (
              <ErrorState
                title={updatesUi.loadFailed}
                description={loadErrorMessage}
                onRetry={() => void reload()}
                retryLabel={t.common.retry}
              />
            ) : (
              <UpdatesTableCard
                t={t}
                lang={lang}
                canManageEffective={canManageEffective}
                hasActiveFilters={hasActiveFilters}
                sort={sort}
                items={items}
                pageInfo={pageInfo}
                selectableItems={selectableItems}
                selectedKeys={selectedKeys}
                selectedItems={selectedItems}
                isSelectionLocked={!canConfirmFresh}
                isCheckingOperation={isCheckingOperation}
                isOpenOperationModalDisabled={isModalOpen || isApplying}
                hasTrackedOperation={hasTrackedOperation}
                activeOperation={activeOperation}
                operationErrorMessage={requiresReconciliation ? null : operationErrorMessage}
                onSortChange={setSort}
                onClearFilters={clearFilters}
                onPageChange={setPage}
                onToggleSelection={toggleSelection}
                onToggleSelectAll={toggleSelectAll}
                onOpenOperationModal={() => setIsOperationModalOpen(true)}
                onRefreshOperation={() => void refreshActiveOperation()}
              />
            )}

            <ApplyUpdatesModal
              t={t}
              lang={lang}
              open={isModalOpen}
              phase={modalPhase}
              snapshotItems={modalSnapshot?.items ?? []}
              liveItems={items}
              staleConflictMessage={staleConflictMessage}
              isConsented={isConsented}
              canConfirm={canConfirmFresh}
              canRetryAmbiguous={canRetryAmbiguous}
              isApplying={isApplying}
              onOpenChange={setIsModalOpen}
              onConsentChange={setConsent}
              onConfirm={() => void confirmApply()}
              onReloadFromStale={reloadFromStaleModal}
              onRetryAmbiguous={() => void retryAmbiguous()}
            />

            <UpdateOperationModal
              t={t}
              open={isOperationModalOpen}
              activeOperation={activeOperation}
              correlatedItems={correlatedOperationItems}
              operationErrorMessage={requiresReconciliation ? null : operationErrorMessage}
              isCheckingOperation={isCheckingOperation}
              onOpenChange={setIsOperationModalOpen}
              onRefreshOperation={() => void refreshActiveOperation()}
            />
          </ReadOnlyGate>
        )}
      </div>
    </PermissionGate>
  );
}
