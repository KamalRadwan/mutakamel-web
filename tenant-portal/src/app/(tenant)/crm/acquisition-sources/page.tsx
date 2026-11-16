"use client";

import { LockKeyhole, Plus, RefreshCw, Search } from "lucide-react";
import { Button, Input, PageActions, PageHeader, PermissionGate } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { AcquisitionSourceEditModal } from "./components/AcquisitionSourceEditModal";
import { AcquisitionSourceIconDrawer } from "./components/AcquisitionSourceIconDrawer";
import { AcquisitionSourcesTable } from "./components/AcquisitionSourcesTable";
import { CreateAcquisitionSourcesModal } from "./components/CreateAcquisitionSourcesModal";
import { DeleteAcquisitionSourcesConfirmModal } from "./components/DeleteAcquisitionSourcesConfirmModal";
import { MoveAcquisitionSourceModal } from "./components/MoveAcquisitionSourceModal";
import { useAcquisitionSourcesWorkspace } from "./hooks/useAcquisitionSourcesWorkspace";

export default function AcquisitionSourcesPage() {
  const { user } = useTenantAuth();
  const scope = useAuthScopeKey(user);
  return <AcquisitionSourcesContent key={scope} />;
}

function AcquisitionSourcesContent() {
  const workspace = useAcquisitionSourcesWorkspace();
  const { state, editor, icon, busy } = workspace;
  const { setFallbackElement } = workspace.dialogFocus;
  const { t } = state;
  return (
    <PermissionGate require="crm.acquisition_sources.read" denied={state.queryError?.status === 403}>
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={t.nav.acquisitionSources} description={t.crmAcquisitionSources.subtitle}
          primaryAction={state.canManage ? { label: t.crmAcquisitionSources.add, icon: <Plus className="size-4" aria-hidden="true" />,
            onClick: state.openCreate, disabled: busy || state.writeBlocked || state.isAtLimit || workspace.hasOpenForm || !!workspace.selectedForMove } : undefined}
          secondaryActions={<Button variant="outline" size="sm" onClick={() => void state.reload()} disabled={state.isLoading || busy}>
            <RefreshCw className={`size-4 ${state.isLoading ? "animate-spin" : ""}`} aria-hidden="true" />{t.crmAcquisitionSources.reload}
          </Button>} />
        <PageActions slot="search"><div className="relative w-full min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input ref={setFallbackElement} size="sm" type="search" className="ps-9" disabled={busy} value={state.searchQuery}
            placeholder={t.crmAcquisitionSources.search} aria-label={t.crmAcquisitionSources.search} onChange={(event) => state.setSearchQuery(event.target.value)} />
        </div></PageActions>
        {!state.canManage && <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />{t.crmAcquisitionSources.readOnly}
        </p>}
        {state.canManage && state.isAtLimit && <p role="note" className="text-xs text-muted-foreground">{t.crmAcquisitionSources.limitReached}</p>}
        {state.canManage && state.isFiltered && <p role="note" className="text-xs text-muted-foreground">{t.crmConfigActionHints.filteredReorder}</p>}
        {state.needsReload && <p role="status" className="text-xs text-muted-foreground">{t.crmAcquisitionSources.reloadRequired}</p>}
        {editor.error && !editor.selected && <p role="alert" className="text-sm text-destructive">{editor.error}</p>}
        {state.mutationError && !state.selectedForDelete && !state.isCreateOpen && !workspace.selectedForMove && <div role="alert" className="rounded-md border border-caution-200 bg-caution-100 p-3 text-sm text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
          <p>{state.mutationError}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void state.reload()} disabled={state.isLoading || busy}>{t.crmAcquisitionSources.reload}</Button>
        </div>}
        <AcquisitionSourcesTable workspace={workspace} />
        {state.canManage && <p role="status" className="text-xs text-muted-foreground">{state.isReordering ? t.crmAcquisitionSources.saving : t.crmAcquisitionSources.reorderHint}</p>}
        <p className="text-xs text-muted-foreground">{t.crmAcquisitionSources.inactiveHelp}</p>
        <CreateAcquisitionSourcesModal key={state.isCreateOpen ? "create-open" : "create-closed"} isOpen={state.isCreateOpen}
          onClose={state.closeCreate} onSubmit={state.handleCreate} isSubmitting={state.isCreating} error={state.mutationError} />
        <AcquisitionSourceEditModal editor={editor} onManageIcon={workspace.openIconFromEditor} />
        <MoveAcquisitionSourceModal key={workspace.selectedForMove?.id ?? "move-closed"} source={workspace.selectedForMove}
          items={state.allItems} isSubmitting={state.isReordering} blocked={workspace.reorderBlocked}
          error={state.mutationError} onClose={workspace.closeMove} onSubmit={workspace.moveSelected} />
        <AcquisitionSourceIconDrawer key={`icon-${icon.selected?.id ?? "closed"}`} source={icon.selected}
          isSubmitting={icon.isUploading} isUncertain={icon.isUncertain} reconcileOnly={icon.reconcileOnly} onReconcile={icon.reconcile}
          error={icon.error} onClose={icon.close} onSubmit={icon.upload} />
        <DeleteAcquisitionSourcesConfirmModal isOpen={!!state.selectedForDelete} item={state.selectedForDelete}
          onClose={state.closeDelete} onConfirm={() => void state.handleDelete()} isSubmitting={state.isDeleting}
          error={state.mutationError} blocked={state.deleteBlocked} onEdit={workspace.editBlockedSource} />
      </div>
    </PermissionGate>
  );
}
