"use client";

import { RefreshCw } from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  ConflictDialog,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  ReasonDialog,
  type FilterValue,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import {
  ACTIVITY_READ_PERMISSION,
  ACTIVITY_STATUSES,
  ACTIVITY_TARGET_APPS,
  type ActivityFilters,
  type ActivityStatus,
  type ActivityTargetApp,
} from "../activities-contract";
import { useActivities } from "../hooks/useActivities";
import { useActivityMutations } from "../hooks/useActivityMutations";
import { ActivityFormDrawer } from "./ActivityFormDrawer";
import { useActivityColumns } from "./useActivityColumns";

export function ActivitiesWorkspace() {
  const list = useActivities();
  const mutations = useActivityMutations(list.grants, list.replaceItem, list.reload);
  const { t, lang } = list;
  const copy = t.coreOperations.activities;

  const columns = useActivityColumns({
    grants: list.grants,
    pendingId: mutations.pendingId,
    onEdit: mutations.openEdit,
    onTransition: mutations.openTransition,
  });

  const selectValue = (value: FilterValue | undefined): string | undefined =>
    value?.kind === "select" && value.value ? value.value : undefined;

  return (
    <PermissionGate require={ACTIVITY_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.title}
          description={copy.subtitle}
          primaryAction={
            list.grants.canCreate
              ? { label: copy.create, onClick: mutations.openCreate }
              : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={list.reload} disabled={list.isLoading}>
              <RefreshCw
                className={list.isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        {mutations.ambiguous ? (
          <AmbiguousOutcomePanel
            operation={mutations.ambiguous.operation}
            idempotencyKey={mutations.ambiguous.idempotencyKey}
            correlationId={mutations.ambiguous.correlationId}
            description={copy.ambiguousDescription}
            onRetry={() => void mutations.ambiguous?.retry()}
            onDismiss={mutations.dismissAmbiguous}
            retrying={mutations.isSubmitting || mutations.pendingId !== null}
            labels={{
              title: copy.ambiguousTitle,
              operation: copy.ambiguousOperation,
              idempotencyKey: copy.ambiguousKey,
              correlationId: copy.ambiguousReference,
              retry: t.common.retry,
              dismiss: t.common.dismiss,
            }}
          />
        ) : null}

        <FilterBar
          filters={[
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: copy.anyValue,
              options: ACTIVITY_STATUSES.map((status) => ({
                value: status,
                label: copy.statuses[status],
              })),
            },
            {
              id: "targetApp",
              kind: "select",
              label: copy.targetApp,
              placeholder: copy.anyValue,
              options: ACTIVITY_TARGET_APPS.map((app) => ({
                value: app,
                label: copy.targetApps[app],
              })),
            },
          ]}
          values={{
            ...(list.filters.status
              ? { status: { kind: "select" as const, value: list.filters.status } }
              : {}),
            ...(list.filters.targetApp
              ? { targetApp: { kind: "select" as const, value: list.filters.targetApp } }
              : {}),
          }}
          onChange={(next) =>
            list.setFilters({
              status: selectValue(next.status) as ActivityStatus | undefined,
              targetApp: selectValue(next.targetApp) as ActivityTargetApp | undefined,
            } satisfies ActivityFilters)
          }
          onReset={() => list.setFilters({})}
          searchValue={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder={copy.searchPlaceholder}
          clearAllLabel={t.filters.clearAll}
          filtersLabel={t.common.filter}
        />

        <DataTable
          columns={columns}
          rows={list.items}
          isLoading={list.isLoading}
          error={list.queryError}
          onRetry={list.reload}
          page={list.pageInfo}
          onPageChange={list.setPage}
          rowKey={(activity) => activity.id}
          sort={{ id: "dueAt", direction: list.sortDir === "DESC" ? "desc" : "asc" }}
          onSortChange={(sort) => list.setSortDir(sort.direction === "desc" ? "DESC" : "ASC")}
          labels={{
            retry: t.common.retry,
            errorTitle: copy.loadFailed,
            emptyTitle: copy.empty,
            selectAll: t.views.selectAll,
            selectRow: t.views.selectItem,
            sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending,
            notSorted: t.views.notSorted,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />

        <ActivityFormDrawer
          key={mutations.editing?.activity.id ?? "activity-create"}
          activity={mutations.editing?.activity ?? null}
          isOpen={mutations.isCreateOpen || mutations.editing !== null}
          onClose={mutations.editing ? mutations.closeEdit : mutations.closeCreate}
          onSubmit={mutations.editing ? mutations.save : mutations.create}
          isSubmitting={mutations.isSubmitting}
          error={mutations.formError}
        />

        <ReasonDialog
          open={mutations.transition !== null}
          onOpenChange={(open) => {
            if (!open) mutations.closeTransition();
          }}
          title={
            mutations.transition?.kind === "cancel" ? copy.cancelTitle : copy.completeTitle
          }
          description={
            mutations.transition?.kind === "cancel"
              ? copy.cancelDescription
              : copy.completeDescription
          }
          reasonRequired={false}
          destructive={mutations.transition?.kind === "cancel"}
          onConfirm={(reason) => void mutations.runTransition(reason)}
          loading={mutations.pendingId !== null}
          labels={{
            reason:
              mutations.transition?.kind === "cancel" ? copy.cancelReason : copy.completeOutcome,
            confirm: t.common.save,
            cancel: t.common.cancel,
          }}
        />

        <ConflictDialog
          open={mutations.conflict !== null}
          onOpenChange={(open) => {
            if (!open) mutations.dismissConflict();
          }}
          title={copy.conflictTitle}
          description={copy.conflictDescription}
          theirChanges={
            mutations.conflict ? (
              <span className="flex flex-col gap-1">
                <span>{mutations.conflict.subject}</span>
                <span>
                  {copy.statuses[mutations.conflict.status] ?? mutations.conflict.status}
                </span>
                <span>{formatDateTime(mutations.conflict.dueAt, lang)}</span>
              </span>
            ) : undefined
          }
          onReload={() => {
            mutations.dismissConflict();
            list.reload();
          }}
          onCancel={mutations.dismissConflict}
          labels={{
            yourChanges: copy.conflictYours,
            theirChanges: copy.conflictTheirs,
            reload: copy.conflictReload,
            overwrite: copy.conflictOverwrite,
            cancel: t.common.cancel,
          }}
        />
      </div>
    </PermissionGate>
  );
}
