"use client";

import { Plus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  DataTableSort,
  FilterBar,
  PageHeader,
  PermissionGate,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import type { OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import { useOrganizationWorkspace } from "../hooks/useOrganizationWorkspace";
import { OrganizationDeleteDialogs } from "./OrganizationDeleteDialogs";
import { OrganizationNodeFormModal } from "./OrganizationNodeFormModal";
import { OrganizationQuickViewDialog } from "./OrganizationQuickViewDialog";
import { useOrganizationColumns } from "./useOrganizationColumns";

export function OrganizationLevelWorkspace<L extends OrgLevel>({ level }: { level: L }) {
  const workspace = useOrganizationWorkspace(level);
  const { screen, formState } = workspace;
  const { t, config, canCreate, canManageRow, lookups } = screen;
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[level];

  const columns = useOrganizationColumns<L>({
    config,
    canManageRow,
    lookups,
    onQuickView: screen.openQuickView,
    onEdit: workspace.openEdit,
    onDelete: screen.requestDelete,
  });

  return (
    <PermissionGate
      require={config.readPermission}
      denied={screen.queryError?.status === 403}
    >
      <div className="flex min-w-0 flex-col gap-3 px-2 pb-4 pt-0 sm:px-5 sm:pb-5">
        <PageHeader
          className="sr-only p-0"
          title={levelCopy.title}
          primaryAction={
            canCreate ? { label: levelCopy.add, icon: <Plus className="size-4" aria-hidden="true" />, onClick: workspace.openCreate } : undefined
          }
          secondaryActions={
            <Button size="sm" variant="outline" onClick={screen.reload} disabled={screen.isLoading}>
              <RefreshCw
                className={`size-4 ${screen.isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {copy.actions.refresh}
            </Button>
          }
        />

        <Card className="min-w-0 overflow-hidden p-0">
        <FilterBar
          placement="inline"
          className="border-b border-border p-4"
          trailing={<DataTableSort columns={columns} value={screen.sort} onChange={screen.setSort} labels={{ label: copy.sortBy, ascending: t.views.sortAscending, descending: t.views.sortDescending }} />}
          filters={workspace.filterDefs}
          values={workspace.filterValues}
          onChange={workspace.handleFilterChange}
          onReset={workspace.handleFilterReset}
          searchValue={screen.searchQuery}
          onSearchChange={screen.setSearchQuery}
          searchPlaceholder={levelCopy.searchPlaceholder}
          filtersLabel={t.filters.label}
          clearAllLabel={t.filters.clearAll}
        />

        {workspace.mutationText && !workspace.isFormOpen ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
          >
            {workspace.mutationText}
          </p>
        ) : null}

        <DataTable
          surface="embedded"
          columns={columns}
          rows={screen.rows}
          isLoading={screen.isLoading}
          error={screen.queryError}
          onRetry={screen.reload}
          page={screen.pageInfo}
          onPageChange={screen.setPage}
          sort={screen.sort}
          onSortChange={screen.setSort}
          rowKey={(node) => node.id}
          labels={{
            retry: t.common.retry,
            errorTitle: levelCopy.loadFailed,
            emptyTitle: levelCopy.empty,
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

        </Card>
        <OrganizationNodeFormModal
          open={workspace.isFormOpen}
          mode={workspace.mode}
          config={config}
          values={formState.form}
          onChange={formState.patch}
          isDirty={formState.isDirty}
          isSubmitting={screen.isSubmitting}
          hasSavedCurrency={formState.hasSavedCurrency}
          error={workspace.modalError}
          submitDisabled={workspace.submitDisabled}
          onClose={workspace.closeModal}
          onSubmit={workspace.submitModal}
          cascade={workspace.cascade}
          leadUserOptions={workspace.leadUserOptions}
          canReadUsers={workspace.canReadUsers}
          selectedLeadLabel={workspace.selectedLeadLabel}
          missingUpstreamPermission={workspace.missingUpstreamPermission}
          validations={formState.validations}
          editReadOnlyParents={workspace.editReadOnlyParents}
        />

        <OrganizationQuickViewDialog
          target={screen.quickViewTarget}
          onClose={screen.closeQuickView}
          canManage={workspace.quickViewCanManage}
          onEdit={(node) => workspace.openEdit(node as OrgNodeOf<L>)}
        />

        <OrganizationDeleteDialogs
          config={config}
          pendingDelete={screen.pendingDelete}
          isSubmitting={screen.isSubmitting}
          onConfirmDelete={() => void screen.handleDelete()}
          onCancelDelete={screen.cancelDelete}
          blockedNode={screen.blockedNode}
          blockers={screen.blockers}
          onDismissBlockers={screen.dismissBlockers}
          hqTransferBlockedNode={screen.hqTransferBlockedNode}
          hqTransferError={screen.hqTransferError}
          onDismissHqTransfer={screen.dismissHqTransfer}
        />
      </div>
    </PermissionGate>
  );
}
