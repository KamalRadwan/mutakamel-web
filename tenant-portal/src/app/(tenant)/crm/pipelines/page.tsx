"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import { Button, DataTable, DegradedBanner, Input, PageActions, PageHeader, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CreatePipelineModal } from "./components/CreatePipelineModal";
import { PipelineActionDialog } from "./components/PipelineActionDialog";
import { PipelineRowEditor } from "./components/PipelineRowEditor";
import { usePipelineColumns } from "./components/usePipelineColumns";
import { usePipelinesPage } from "./hooks/usePipelinesPage";

export default function PipelinesPage() {
  const { t, lang } = useI18n();
  const state = usePipelinesPage();
  const { list } = state;
  const columns = usePipelineColumns({
    canManage: state.canManage, pendingId: list.pendingId,
    onSetDefault: (pipeline) => void state.setDefault(pipeline), onDelete: state.openDelete,
    onView: state.viewPipeline, onEdit: state.openEdit,
  });
  return (
    <PermissionGate require="crm.pipelines.read" denied={list.queryError?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader title={t.crmPipelines.title} description={t.crmPipelines.subtitle}
          primaryAction={state.canManage ? { label: t.crmPipelines.add, icon: <Plus className="size-4" aria-hidden="true" />, onClick: state.openCreate } : undefined}
          secondaryActions={<Button variant="outline" onClick={state.reload} disabled={list.isLoading}>
            <RefreshCw className="size-4" aria-hidden="true" />{t.connectivity.reload}
          </Button>} />
        <PageActions slot="search">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input className="ps-8" value={list.searchQuery} placeholder={t.crmPipelines.search}
              aria-label={t.crmPipelines.search} onChange={(event) => state.search(event.target.value)} />
          </div>
        </PageActions>
        {state.readOnly && <p role="note" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">{t.crmPipelines.readOnlyReason}</p>}
        {list.queryError && list.hasLoaded && <DegradedBanner message={t.crmPipelines.review.staleList} />}
        {list.needsReconciliation && <div className="space-y-2"><DegradedBanner message={t.crmPipelines.review.uncertainWrite} />
          <Button variant="outline" className="self-start" onClick={() => void state.reconcileCreate()} disabled={list.isPending()}>{t.crmPipelines.review.checkCurrent}</Button>
        </div>}
        <DataTable columns={columns} rows={list.items} isLoading={list.isLoading && !list.hasLoaded}
          error={list.hasLoaded ? null : list.queryError} onRetry={state.reload}
          rowKey={(pipeline) => pipeline.id} onRowClick={state.viewPipeline}
          labels={{ retry: t.common.retry, errorTitle: t.crmPipelines.loadFailed,
            emptyTitle: list.searchQuery.trim() ? t.crmPipelines.emptyFiltered : t.crmPipelines.empty,
            selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
            pagination: { previous: t.common.previousPage, next: t.common.nextPage,
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) },
          }} />
        {list.searchQuery && list.items.length === 0 && !list.queryError && <Button className="self-start" variant="outline" onClick={() => state.search("")}>{t.crmPipelines.review.clearSearch}</Button>}
        {state.editingId && <PipelineRowEditor key={state.editingId} pipelineId={state.editingId}
          onClose={state.closeEdit} onSaved={state.reload} />}
        <CreatePipelineModal key={state.isCreateOpen ? "open" : "closed"} open={state.isCreateOpen}
          onOpenChange={state.setIsCreateOpen} stageCatalogue={state.catalogue.items}
          isLoadingCatalogue={state.catalogue.isLoading} catalogueError={state.catalogue.queryError !== null}
          onReloadCatalogue={() => void state.catalogue.reload()}
          uncertain={state.createUncertain || list.needsReconciliation} onReconcile={() => void state.reconcileCreate()}
          isSubmitting={list.isCreating} error={state.createError} failureCode={state.createErrorCode} onSubmit={(input) => void state.create(input)} />
        <PipelineActionDialog open={state.pendingDelete !== null} onOpenChange={(open) => { if (!open) state.closeDelete(); }}
          title={t.crmPipelines.deleteTitle}
          description={formatTemplate(t.crmPipelines.deleteDescription, { name: state.pendingDelete ? localizedName(state.pendingDelete, lang) : "" })}
          confirmLabel={t.common.delete} pending={list.pendingId !== null} blocked={state.deleteError !== null}
          error={state.deleteError ? state.describeFailure(state.deleteError) : undefined}
          onConfirm={() => void state.remove()} onReload={state.reloadDelete} />
      </div>
    </PermissionGate>
  );
}
