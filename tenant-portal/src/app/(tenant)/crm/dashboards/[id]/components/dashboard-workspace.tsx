"use client";
import { LayoutGrid, Pencil, Plus, RefreshCw, Share2 } from "lucide-react";
import { Badge, Button, ConfirmActionModal, ConflictDialog, DegradedBanner, DetailHeader, EmptyState, ErrorState, NotFoundState, PermissionGate, Skeleton } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { failedWidgetIds } from "../../dashboard-run-contract";
import { DashboardRecoveryNotice } from "../../components/DashboardRecoveryNotice";
import { useDashboardWorkspace } from "../hooks/useDashboardWorkspace";
import { AddWidgetDrawer } from "./AddWidgetDrawer";
import { DashboardEditDrawer } from "./DashboardEditDrawer";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { DashboardLayoutEditor } from "./DashboardLayoutEditor";
import { DashboardCanvas } from "./DashboardCanvas";
import { DrilldownSheet } from "./DrilldownSheet";
import { PlacementVersionDialog } from "./PlacementVersionDialog";
import { ShareDrawer } from "./ShareDrawer";
import { WidgetGovernanceDialog } from "../../../widgets/components/WidgetGovernanceDialog";

export function DashboardWorkspace({ dashboardId, onSelectDashboard }: {
  dashboardId: string; onSelectDashboard?: (id: string) => void;
}) {
  const state = useDashboardWorkspace(dashboardId, onSelectDashboard);
  const { t, detailState, layout, shares, widgetPicker, switcher, drilldown } = state;
  const { detail, run, selection, isLoading, isRunning } = detailState;
  if (isLoading && !detail) return <div className="flex flex-col gap-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (detailState.detailError?.status === 403) return <PermissionGate require="crm.dashboards.read" scoped denied>{null}</PermissionGate>;
  if (detailState.detailError?.status === 404) return <NotFoundState title={t.crmDashboards.notFoundTitle} description={t.crmDashboards.notFoundDescription} backLabel={t.crmDashboards.backToList} backHref={TENANT_ROUTES.crmDashboards} />;
  if (!detail) return <ErrorState title={t.crmDashboards.loadFailed} description={state.describe(detailState.detailError)} onRetry={() => void detailState.reload()} retryLabel={t.common.retry} />;
  const recovery = { blocked: detailState.needsReconciliation, ready: detailState.reviewReady, busy: isLoading || layout.isSaving, onReload: state.reloadLatest, onAcknowledge: detailState.acknowledge };
  const failed = failedWidgetIds(run);
  return <div className="flex flex-col gap-4">
    <DetailHeader title={detail.name} subtitle={detail.description ?? undefined} backHref={TENANT_ROUTES.crmDashboards} backLabel={t.crmDashboards.backToList}
      status={<Badge tone="neutral">{t.crmDashboards.accessLevels[detail.accessLevel]}</Badge>}
      primaryAction={layout.canEdit ? { label: t.crmDashboards.addWidget, icon: <Plus className="size-4" aria-hidden="true" />, onClick: state.openAdd, disabled: layout.isSaving } : undefined}
      secondaryActions={<>
        <Button variant="outline" onClick={state.reloadDashboard} disabled={isRunning || layout.isSaving}><RefreshCw className="size-4" aria-hidden="true" />{t.crmDashboards.rerun}</Button>
        {layout.canEdit && <Button variant="outline" onClick={() => state.setIsEditOpen(true)} disabled={layout.isSaving}><Pencil className="size-4" aria-hidden="true" />{t.crmDashboards.edit}</Button>}
        {layout.canEdit && <Button variant="outline" aria-pressed={layout.isEditing} onClick={state.toggleLayout} disabled={layout.isSaving}><LayoutGrid className="size-4" aria-hidden="true" />{layout.isEditing ? t.crmDashboards.layoutDone : t.crmDashboards.editLayout}</Button>}
        {state.canShare && <Button variant="outline" onClick={() => state.setIsShareOpen(true)}><Share2 className="size-4" aria-hidden="true" />{t.crmDashboards.share}</Button>}
      </>} />
    {layout.editPermissionMissing && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.editPermissionRequired}</p>}
    {state.sharePermissionMissing && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.sharePermissionRequired}</p>}
    {layout.readOnly && <p role="note" className="text-sm text-muted-foreground">{t.crmDashboards.review.tenantReadOnly}</p>}
    <DashboardRecoveryNotice blocked={detailState.needsReconciliation} ready={detailState.reviewReady} busy={isLoading || layout.isSaving}
      onReload={state.reloadLatest} onAcknowledge={detailState.acknowledge} />
    {detailState.detailError && <DegradedBanner message={t.crmDashboards.review.staleList} />}
    {switcher.error && <ErrorState title={t.crmDashboards.switcherLoadFailed} description={state.describe(switcher.error)} onRetry={() => void switcher.reload()} retryLabel={t.common.retry} />}
    <DashboardFilterBar key={dashboardId} selection={selection} onChange={(next) => void detailState.rerun(next)} branchIds={state.user?.accessibleBranches ?? []}
      organization={run?.organizationScope} population={run?.populationScope}
      currencyCodes={detailState.availableCurrencies} disabled={isRunning} dashboardSwitcher={{ value: dashboardId, options: state.allSwitcherOptions, onChange: state.handleSwitcherChange }} />
    {switcher.hasMore && <Button variant="outline" disabled={switcher.isLoading} onClick={() => void switcher.loadMore()}>{t.crmDashboards.loadMoreDashboards}</Button>}
    {failed.length > 0 && <DegradedBanner message={formatTemplate(t.crmDashboards.widgetsFailed, { failed: failed.length, total: Object.keys(run?.widgets ?? {}).length })} />}
    {detail.unavailablePlacements.length > 0 && <DegradedBanner message={formatTemplate(t.crmDashboards.hiddenPlacements, { count: detail.unavailablePlacements.length })} />}
    {detailState.runError && <ErrorState title={t.crmDashboards.runFailed} description={state.describe(detailState.runError)} onRetry={() => void detailState.rerun(selection)} retryLabel={t.common.retry} />}
    {layout.isEditing && <DashboardLayoutEditor draft={layout.draft} placements={detail.placements} hiddenCount={detail.unavailablePlacements.length}
      selected={layout.selected} onSelect={layout.select} onAdjust={layout.adjust} canAdjust={layout.canAdjust}
      onMove={layout.move} onReorder={layout.reorder} disabled={layout.isSaving || detailState.needsReconciliation} />}
    {!detail.placements.length && !detail.unavailablePlacements.length ? <EmptyState title={t.crmDashboards.noWidgets} description={layout.canEdit ? t.crmDashboards.noWidgetsHint : t.crmDashboards.noWidgetsReadOnly}
      action={layout.canEdit ? { label: t.crmDashboards.addWidget, onClick: state.openAdd } : undefined} />
      : <DashboardCanvas detail={detail} run={run} catalog={switcher.catalog} selection={selection} editing={layout.isEditing && layout.canEdit}
        draft={layout.isEditing ? layout.draft : undefined} selectedId={layout.isEditing ? layout.selected?.id : undefined}
        layoutControls={layout.isEditing && layout.canEdit && !layout.isSaving && !detailState.needsReconciliation ? layout : undefined}
        pendingPlacementId={layout.pendingPlacementId} onRemove={state.removePlacement} onDrilldown={drilldown.open}
        onPlacementVersion={state.placementVersionEnabled ? state.placementVersion.open : undefined}
        governance={state.governance.canManage && state.user?.id && !detailState.detailError && !detailState.needsReconciliation
          ? { actorId: state.user.id, archive: (id, anchor) => state.governance.open(id, "ARCHIVE", anchor) } : undefined} />}
    {layout.isEditing && <footer className="sticky bottom-0 z-(--z-sticky-header) flex flex-wrap justify-end gap-2 border-t border-border bg-background py-3">
      <Button size="xl" variant="outline" disabled={layout.isSaving} onClick={state.cancelLayout}>{t.common.cancel}</Button>
      <Button size="xl" variant="secondary" disabled={!layout.isDirty || layout.isSaving || detailState.needsReconciliation} loading={layout.isSaving}
        onClick={state.saveLayout}>{t.crmDashboards.saveLayout}</Button>
    </footer>}
    <AddWidgetDrawer key={`${dashboardId}-add-${state.isAddOpen}`} open={state.isAddOpen} onOpenChange={state.setIsAddOpen} widgets={widgetPicker.widgets} widgetsUnavailable={!!widgetPicker.error}
      hasMore={widgetPicker.hasMore} isLoadingMore={widgetPicker.isLoading} onLoadMore={() => void widgetPicker.loadMore()} onRetryWidgets={() => void widgetPicker.reload()}
      placedWidgetIds={new Set(detail.placements.map((placement) => placement.widgetId))} atCapacity={detail.placements.length + detail.unavailablePlacements.length >= 20}
      recovery={recovery} isSubmitting={layout.isSaving} blocked={!layout.canEdit} error={state.actionError} onSubmit={state.addWidget} />
    <DashboardEditDrawer key={`${dashboardId}-edit-${state.isEditOpen}`} open={state.isEditOpen} onOpenChange={state.setIsEditOpen} initialName={detail.name} initialDescription={detail.description ?? ""}
      recovery={recovery} isSubmitting={detailState.isSaving} blocked={detailState.needsReconciliation} error={state.actionError} onSubmit={state.rename} />
    <ShareDrawer open={state.isShareOpen && state.canShare} onOpenChange={state.setIsShareOpen} shares={shares.shares} sharesError={shares.error} targets={shares.targets}
      recovery={recovery} targetSearchError={shares.targetSearchError} isLoading={shares.isLoading} isSubmitting={shares.isSubmitting} blocked={shares.needsReconciliation}
      onSearchTargets={(query) => void shares.searchTargets(query)} onRetryShares={() => void shares.reload()} onRetryTargetSearch={shares.retrySearchTargets} onShare={state.share} onRevoke={state.revoke} />
    <DrilldownSheet target={drilldown.target} records={drilldown.records} hasMore={drilldown.hasMore} isLoading={drilldown.isLoading} error={drilldown.error}
      onLoadMore={drilldown.loadMore} onClose={drilldown.close} onRetry={drilldown.retry} onReloadDashboard={state.reloadDrilldown} />
    <WidgetGovernanceDialog state={state.governance} />
    <PlacementVersionDialog state={state.placementVersion} />
    <ConfirmActionModal open={state.guard.isDiscardOpen} onOpenChange={(open) => { if (!open) state.guard.cancelDiscard(); }} title={t.common.discardTitle} description={t.common.discardDescription} confirmLabel={t.common.discardConfirm} cancelLabel={t.common.cancel} onConfirm={state.guard.confirmDiscard} />
    <ConflictDialog open={state.conflict} onOpenChange={state.setConflict} title={t.crmDashboards.conflictTitle} description={t.crmDashboards.conflictDescription} onReload={state.reloadConflict} onCancel={() => state.setConflict(false)}
      labels={{ yourChanges: t.crmDashboards.conflictYours, theirChanges: t.crmDashboards.conflictTheirs, reload: t.crmDashboards.conflictReload, overwrite: t.crmDashboards.conflictOverwrite, cancel: t.common.cancel }} />
  </div>;
}



