"use client";

import { Info, Plus, RotateCw, Search } from "lucide-react";
import { Button, DataTable, DegradedBanner, EmptyState, Input, PageActions, PageHeader, PermissionGate } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CreateLeadStagesModal } from "./components/CreateLeadStagesModal";
import { DeleteLeadStagesConfirmModal } from "./components/DeleteLeadStagesConfirmModal";
import { EditLeadStageModal } from "./components/EditLeadStageModal";
import { useLeadStageColumns } from "./components/useLeadStageColumns";
import { useLeadStages } from "./hooks/useLeadStages";

export default function LeadStagesPage() {
  const state = useLeadStages();
  const { t, lang, canManage, writesBlocked, items, isFiltered } = state;
  const columns = useLeadStageColumns({
    canManage, writesBlocked, needsReload: state.needsReload, settingDefaultId: state.settingDefaultId,
    onEdit: state.openEdit, onDelete: state.openDelete, onDefault: state.handleSetDefault,
  });
  return (
    <PermissionGate require="crm.lead_stages.read" denied={state.loadError?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader title={t.crmLeadStages.title} description={t.crmLeadStages.description}
          primaryAction={canManage ? {
            label: t.crm.addANewStage, icon: <Plus className="size-4" aria-hidden="true" />,
            onClick: state.openCreate, disabled: writesBlocked || state.atCapacity,
          } : undefined}
          secondaryActions={<Button variant="outline" size="sm" disabled={state.isLoading || state.isMutating}
            loading={state.isLoading} onClick={() => void state.fetchStages()}>
            <RotateCw className="size-4" aria-hidden="true" />{t.crmLeadStages.reload}
          </Button>}
        />
        <PageActions slot="search">
          <div className="relative w-full min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input size="sm" type="search" className="ps-9" value={state.searchQuery}
              placeholder={t.crm.searchByStageName} aria-label={t.crm.searchByStageName}
              onChange={(event) => state.setSearchQuery(event.target.value)} />
          </div>
        </PageActions>
        {!canManage && <DegradedBanner message={t.crmLeadStages.readOnlyNotice} />}
        {state.atCapacity && canManage && <DegradedBanner message={t.crmLeadStages.capacityReached} />}
        {state.error && <div className="flex flex-col items-start gap-2" role="status">
          <DegradedBanner message={state.error} />
          <Button variant="outline" size="sm" disabled={state.isLoading || state.isMutating} onClick={() => void state.fetchStages()}>
            <RotateCw className="size-4" aria-hidden="true" />{t.crmLeadStages.reload}
          </Button>
        </div>}
        {state.needsReload && !state.error && !state.loadError && <DegradedBanner message={t.crmLeadStages.reloadRequired} />}
        {canManage && isFiltered && <p role="note" className="text-xs text-muted-foreground">{t.crmLeadStages.reorderFilteredHint}</p>}
        <DataTable columns={columns} rows={items} showRowNumbers={false}
          isLoading={state.isLoading} error={state.loadError} onRetry={() => void state.fetchStages()}
          rowKey={(item) => item.id}
          rowReorder={canManage && !isFiltered ? {
            onReorder: (orderedIds) => void state.handleReorder(orderedIds),
            isPinned: (id) => state.fixedStageIds.has(id), isPending: writesBlocked,
            rowLabel: (item) => localizedName(item, lang), dragHandleLabel: t.crmLeadStages.dragHandle,
          } : undefined}
          emptyState={<EmptyState title={t.crmLeadStages.empty} description={t.crmLeadStages.noMatchesHint}
            action={isFiltered ? { label: t.crmLeadStages.clearSearch, onClick: () => state.setSearchQuery("") } : undefined} />}
          labels={{
            retry: t.common.retry, errorTitle: t.crmLeadStages.loadFailed, emptyTitle: t.crmLeadStages.empty,
            selectAll: t.views.selectAll, selectRow: t.views.selectRow,
            sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
            pagination: { previous: t.common.previousPage, next: t.common.nextPage,
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) },
          }}
        />
        {!state.isLoading && !state.loadError && <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden="true" />{t.crmLeadStages.orderHint}
        </p>}
        <CreateLeadStagesModal key={state.isCreateOpen ? "create-open" : "create-closed"}
          isOpen={canManage && state.isCreateOpen} isSubmitting={state.isCreating}
          submitBlocked={state.needsReload || state.isLoading}
          error={state.createError} onClose={state.closeCreate} onSubmit={state.handleCreate} />
        <EditLeadStageModal key={`edit-${state.selectedForEdit?.id ?? "closed"}`}
          stage={canManage ? state.selectedForEdit : null} isSubmitting={state.isUpdating}
          submitBlocked={state.needsReload || state.isLoading}
          isReloading={state.isLoading} onReload={() => void state.fetchStages()}
          error={state.editError} onClose={state.closeEdit} onSubmit={state.handleUpdate} />
        <DeleteLeadStagesConfirmModal isOpen={canManage && state.selectedForDelete !== null}
          isSubmitting={state.isDeleting} item={state.selectedForDelete} error={state.deleteError}
          blocked={state.deleteBlocked} onClose={state.closeDelete} onConfirm={() => void state.handleDelete()} />
      </div>
    </PermissionGate>
  );
}
