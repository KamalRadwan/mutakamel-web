"use client";

import { LayoutTemplate, Plus, RefreshCw, Search, Sparkles, Star } from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import { Button, DataTable, DegradedBanner, Field, FormDrawer, Input, PageHeader, PermissionGate, hasPermission } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { DashboardDeleteDialog } from "./components/DashboardDeleteDialog";
import { DashboardBlueprintDrawer } from "./components/DashboardBlueprintDrawer";
import { DashboardFormDrawer } from "./components/DashboardFormDrawer";
import { DashboardRecoveryNotice } from "./components/DashboardRecoveryNotice";
import { useDashboardColumns } from "./components/useDashboardColumns";
import { useDashboardsPage } from "./hooks/useDashboardsPage";

export default function DashboardsPage() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const enabled = Boolean(user?.isTenantOwner) || hasPermission(user?.permissions ?? [], "crm.dashboards.read", true);
  const state = useDashboardsPage(enabled);
  const { list } = state;
  const recovery = { blocked: list.needsReconciliation, ready: list.reviewReady, busy: list.isSubmitting || list.isLoading, onReload: state.reloadRecovery, onAcknowledge: list.acknowledge };
  const columns = useDashboardColumns({ canCreate: list.canUseTemplates, canDelete: list.canDelete,
    pendingId: list.isSubmitting || !list.canMutate || list.needsReconciliation ? "pending" : list.pendingId,
    onSetDefault: state.setDefault, onToggleFavorite: state.setFavorite, onDuplicate: state.openDuplicate, onDelete: state.setPendingDelete });
  return <PermissionGate require={user?.isTenantOwner ? [] : "crm.dashboards.read"} scoped denied={list.queryError?.status === 403}>
    <div className="flex w-full flex-col gap-4 px-1 pb-6 sm:px-3">
      <PageHeader title={t.nav.crmDashboardBuilder} description={t.crmDashboards.subtitle}
        primaryAction={list.canCreate ? { label: t.crmDashboards.add, onClick: state.openCreate, icon: <Plus className="size-4" aria-hidden="true" />, disabled: list.isSubmitting } : undefined}
        secondaryActions={<>
          <Button size="xl" variant="outline" disabled={list.isSubmitting} onClick={() => void state.openDefault()}><Star className="size-4" aria-hidden="true" />{t.crmDashboards.openDefault}</Button>
          {list.canUseTemplates && <Button size="xl" variant="outline" disabled={list.isSubmitting} onClick={() => void state.standard()}><Sparkles className="size-4" aria-hidden="true" />{t.crmDashboards.standardDashboard}</Button>}
          {list.mayUseTemplates && <Button size="xl" variant="outline" disabled={list.isSubmitting || state.blueprints.busy}
            onClick={() => state.blueprints.changeOpen(true)}><LayoutTemplate className="size-4" aria-hidden="true" />{t.crmDashboards.blueprints.browse}</Button>}
          <Button size="xl" variant="outline" onClick={() => void list.reload()} disabled={list.isLoading || list.isSubmitting}><RefreshCw className="size-4" aria-hidden="true" />{t.connectivity.reload}</Button>
        </>} />
      <div className="rounded-lg border border-border bg-card p-4"><div className="relative w-full sm:max-w-lg"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="ps-8" value={list.searchQuery} onChange={(event) => list.setSearchQuery(event.target.value)} placeholder={t.crmDashboards.search} aria-label={t.crmDashboards.search} />
      </div></div>
      {list.catalogFailed && <DegradedBanner message={t.crmDashboards.catalogueUnavailable} />}
      {list.queryError && list.hasLoaded && <DegradedBanner message={t.crmDashboards.review.staleList} />}
      {!list.canCreate && <p role="note" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">{t.crmDashboards.readOnlyReason}</p>}
      <DashboardRecoveryNotice {...recovery} />
      <DataTable showRowNumbers={false} columns={columns} rows={list.items} isLoading={list.isLoading && !list.hasLoaded} error={list.hasLoaded ? null : list.queryError}
        onRetry={() => void list.reload()} rowKey={(row) => row.id} onRowClick={(row) => state.navigate(row.id)} labels={{ retry: t.common.retry, errorTitle: t.crmDashboards.loadFailed,
          emptyTitle: list.searchQuery.trim() ? t.crmDashboards.emptyFiltered : t.crmDashboards.empty,
          selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />
      {list.searchQuery && !list.items.length && !list.queryError && <Button variant="outline" className="self-start" onClick={() => list.setSearchQuery("")}>{t.crmDashboards.review.clearSearch}</Button>}
      {list.hasMore && <Button variant="outline" disabled={list.isLoading} loading={list.isLoading} onClick={() => void list.loadMore()}>{t.crmDashboards.loadMoreDashboards}</Button>}
      <DashboardFormDrawer key={state.isCreateOpen ? "open" : "closed"} open={state.isCreateOpen} onOpenChange={state.setIsCreateOpen} templates={list.canUseTemplates ? list.catalog?.templates ?? [] : []}
        templatesUnavailable={!list.catalog} canUseTemplates={list.canUseTemplates} recovery={recovery} blocked={list.needsReconciliation} isSubmitting={list.isSubmitting} error={state.createError} failureCode={state.createFailureCode}
        onSubmit={(input) => void state.create(input)} />
      <DashboardBlueprintDrawer state={state.blueprints} onRecovery={state.reloadRecovery} />
      <FormDrawer open={state.pendingDuplicate !== null} onOpenChange={(open) => { if (!open) state.setPendingDuplicate(null); }} title={t.crmDashboards.duplicate}
        description={t.crmDashboards.review.templatePermission} isDirty={state.duplicateName.length > 0} isSubmitting={list.isSubmitting} submitDisabled={list.needsReconciliation}
        error={state.duplicateError} onSubmit={() => void state.duplicate()}
        labels={{ submit: t.crmDashboards.duplicate, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel }}>
        <DashboardRecoveryNotice {...recovery} />
        <Field showLabel label={t.crmDashboards.review.duplicateName} hint={t.crmDashboards.review.nameLimit}><Input value={state.duplicateName} maxLength={120} onChange={(event) => state.setDuplicateName(event.target.value)} /></Field>
      </FormDrawer>
      <DashboardDeleteDialog open={state.pendingDelete !== null} onOpenChange={(open) => { if (!open) state.setPendingDelete(null); }} title={t.crmDashboards.deleteTitle}
        description={`${formatTemplate(t.crmDashboards.deleteDescription, { name: state.pendingDelete?.name ?? "" })} ${t.crmDashboards.review.deleteImpact}`}
        pending={list.isSubmitting} blocked={list.needsReconciliation || !!state.deleteError}
        error={state.deleteError} recovery={recovery} onConfirm={() => void state.remove()} />
    </div>
  </PermissionGate>;
}




