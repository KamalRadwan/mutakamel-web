"use client";
import { History, Layers3, Pencil, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge, Button, ConflictDialog, DateTime, DegradedBanner, DetailHeader, DetailSection, ErrorState, NotFoundState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { WidgetBuilder } from "../../components/WidgetBuilder";
import { WidgetDeleteDialog } from "../../components/WidgetDeleteDialog";
import { WidgetGovernanceDialog } from "../../components/WidgetGovernanceDialog";
import { WidgetUsagePanel } from "../../components/WidgetUsagePanel";
import { useWidgetWorkspace } from "../hooks/useWidgetWorkspace";
import { WidgetNotEditableNotice } from "./WidgetNotEditableNotice";
import { WidgetPublicationReview } from "./WidgetPublicationReview";
import { WidgetReviewPreview } from "./WidgetReviewPreview";
import { WidgetSharesSection } from "./WidgetSharesSection";
import { WidgetVersionsWorkspace } from "./WidgetVersionsWorkspace";

export function WidgetDetailWorkspace({ widgetId }: { widgetId: string }) {
  const { t, lang } = useI18n();
  const state = useWidgetWorkspace(widgetId);
  const { detail, widget, lifecycle, governance } = state;
  const historyButton = useRef<HTMLButtonElement>(null);
  const historyOpen = state.versions.open;
  const wasHistoryOpen = useRef(false);
  useEffect(() => {
    if (wasHistoryOpen.current && !historyOpen) historyButton.current?.focus();
    wasHistoryOpen.current = historyOpen;
  }, [historyOpen]);
  const labels = t.crmWidgets.review;
  const draft = detail.draftState?.draft;
  if (detail.isLoading && !widget) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (detail.error?.status === 403) return <PermissionGate require="crm.widgets.read" denied>{null}</PermissionGate>;
  if (!widget && detail.error?.status === 404) return <NotFoundState title={t.crmWidgets.notFoundTitle} description={t.crmWidgets.notFoundDescription} backLabel={t.crmWidgets.backToList} backHref={TENANT_ROUTES.crmWidgets} />;
  if (!widget) return <ErrorState title={t.crmWidgets.loadFailed} description={t.crmDashboards.actionFailed} onRetry={() => void detail.reload()} retryLabel={t.common.retry} />;
  if (state.versions.open && widget.versionNumber !== null) return <WidgetVersionsWorkspace state={state.versions}
    name={widget.name} activeVersion={widget.versionNumber} catalog={detail.catalog} reload={detail.reload} />;
  if (lifecycle.review) return <WidgetPublicationReview
    name={draft?.name ?? widget.name}
    history={state.history} draftUpdatedAt={draft?.updatedAt}
    preview={<WidgetReviewPreview input={state.reviewInput} state={state.reviewPreview} catalog={detail.catalog}
      canPreview={state.canPreview} publishing={lifecycle.action === "publish"} />}
    impact={lifecycle.review.impact} unconfirmed={lifecycle.review.unconfirmed} error={state.lifecycleError}
    pending={lifecycle.action === "publish"} blocked={detail.blocked || detail.isLoading}
    page={lifecycle.dashboardPage} onPage={lifecycle.setDashboardPage}
    onBack={lifecycle.closeReview} onConfirm={() => void state.publish()} />;
  if (state.active) return <>
    <WidgetBuilder key={`${detail.scope}:${state.active.base.widgetRevision}:${state.active.base.draft?.draftId ?? ""}:${state.active.base.draft?.revision ?? 0}`} title={t.crmWidgets.editTitle}
      initial={state.active.initial} catalog={detail.catalog} isSubmitting={detail.isSaving}
      error={state.formError} canPreview={state.canPreview} blocked={detail.blocked || !state.canEdit}
      needsReview={detail.needsReview} reviewReady={detail.reviewReady} onReload={() => void detail.reload()} onReview={detail.review}
      onCancel={state.closeEditor} onSaveDraft={(form) => void state.save(form)} />
    <ConflictDialog open={state.conflict} onOpenChange={(open) => { if (!open) state.cancelConflict(); }}
      title={t.crmWidgets.conflictTitle} description={t.crmWidgets.conflictDescription} onReload={() => void state.reloadConflict()} onCancel={state.cancelConflict}
      loading={detail.isLoading} labels={{ yourChanges: t.crmDashboards.conflictYours, theirChanges: t.crmDashboards.conflictTheirs,
        reload: t.crmDashboards.conflictReload, overwrite: t.crmDashboards.conflictOverwrite, cancel: t.common.cancel }} />
  </>;
  const metrics = widget.querySpec?.series.map((series) => {
    const metric = detail.catalog?.metrics.find((candidate) => candidate.key === series.metricKey);
    return series.label || (metric ? localizedName(metric, lang) : labels.selectedUnavailable);
  });
  return <div className="flex flex-col gap-4">
    <DetailHeader title={widget.name || t.crmWidgets.lifecycle.untitledDraft} subtitle={widget.visualizationType ? t.crmDashboards.visualizations[widget.visualizationType] : undefined}
      status={<Badge tone={widget.status === "PUBLISHED" ? "positive" : "neutral"}>{t.crmWidgets.lifecycle.statuses[widget.status]}</Badge>}
      backHref={TENANT_ROUTES.crmWidgets} backLabel={t.crmWidgets.backToList}
      primaryAction={draft && lifecycle.canPublish ? { label: t.crmWidgets.lifecycle.reviewPublication,
        icon: <Layers3 className="size-4" aria-hidden="true" />, onClick: () => void lifecycle.inspect(),
        disabled: !state.publishReady || detail.blocked || detail.isLoading, loading: lifecycle.action === "inspect" } : undefined}
      secondaryActions={<><Button variant="outline" disabled={detail.isLoading || detail.isSaving} onClick={() => void detail.reload()}><RefreshCw className="size-4" aria-hidden="true" />{t.connectivity.reload}</Button>
        {widget.versionNumber !== null && widget.accessLevel !== "VIEW" && <Button variant="outline" ref={historyButton}
          aria-disabled={detail.isLoading || detail.isSaving} onClick={() => {
            if (!detail.isLoading && !detail.isSaving) state.versions.openHistory();
          }}><History className="size-4" aria-hidden="true" />{t.crmWidgets.versionComparison.openHistory}</Button>}
        {state.canEdit && !state.limitations.length && <Button variant="outline" disabled={detail.blocked || !detail.catalog} onClick={state.openEditor}><Pencil className="size-4" aria-hidden="true" />{t.crmWidgets.edit}</Button>}
        {state.canEdit && draft && <Button variant="outline" disabled={detail.blocked || detail.isLoading} onClick={() => lifecycle.setDiscardOpen(true)}>{t.crmWidgets.lifecycle.discard}</Button>}
        {governance.canManage && widget.accessLevel === "OWNER" && <Button variant="outline" disabled={detail.blocked || detail.isLoading}
          onClick={(event) => governance.open(widget.id, widget.status === "ARCHIVED" ? "RESTORE" : "ARCHIVE", event.currentTarget)}>
          {widget.status === "ARCHIVED" ? t.crmWidgets.governance.restore : t.crmWidgets.governance.archive}
        </Button>}</>} />
    {state.lifecycleError && !lifecycle.discardOpen && <p role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive">{state.lifecycleError}</p>}
    {draft && lifecycle.canPublish && detail.catalog && !state.publishReady && <p role="note" className="text-sm text-muted-foreground">{t.crmWidgets.lifecycle.completeDraftBeforePublish}</p>}
    {(detail.readOnly || widget.accessLevel === "VIEW" || !state.canEdit) && <p role="note" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">{labels.viewOnly}</p>}
    {detail.error && <DegradedBanner message={labels.staleList} />}
    {detail.draftFailed && <DegradedBanner message={t.crmWidgets.lifecycle.draftUnavailable} />}
    {draft && widget.status === "ARCHIVED" && <p role="note" className="text-sm text-muted-foreground">{t.crmWidgets.versionComparison.archivedDraft}</p>}
    {draft && state.limitations.length > 0 && <DetailSection title={t.crmWidgets.lifecycle.statuses.DRAFT} fields={[
      { label: t.crmWidgets.name, value: draft.name || t.crmWidgets.lifecycle.untitledDraft },
      { label: t.crmWidgets.revision, value: formatNumber(draft.revision, lang) },
      { label: t.crmDashboards.updated, value: <DateTime value={draft.updatedAt} /> },
    ]} />}
    {!detail.catalog && <DegradedBanner message={labels.catalogUnavailable} />}
    {state.canEdit && state.limitations.length > 0 && <WidgetNotEditableNotice limitations={state.limitations} />}
    {detail.needsReview && <div className="space-y-2"><DegradedBanner message={labels.uncertain} /><div className="flex gap-2">
      <Button variant="outline" onClick={() => void detail.reload()} disabled={detail.isSaving}>{labels.checkCurrent}</Button>
      <Button variant="outline" onClick={detail.review} disabled={!detail.reviewReady || detail.isSaving}>{labels.reviewed}</Button></div></div>}
    <DetailSection title={t.crmWidgets.definition} fields={[
      { label: t.crmWidgets.metric, value: metrics?.join(" · ") },
      { label: t.crmWidgets.dimension, value: t.crmWidgets.dimensions[widget.querySpec?.dimension?.key ?? "none"] ?? t.common.unknownCode },
      { label: t.crmWidgets.comparison, value: t.crmWidgets.comparisonValues[widget.querySpec?.comparison?.type ?? "INHERIT"] },
      { label: t.crmWidgets.revision, value: formatNumber(widget.revision, lang) },
      { label: t.crmDashboards.updated, value: <DateTime value={widget.updatedAt} /> },
    ]} />
    {widget.usage && <WidgetUsagePanel key={`${detail.scope}:${widget.revision}`} widgetId={widget.id} widgetName={widget.name} initialUsage={widget.usage} />}
    {state.canShare && <WidgetSharesSection key={detail.scope} state={state.shares} />}
    <WidgetGovernanceDialog state={governance} />
    {lifecycle.discardOpen && <WidgetDeleteDialog open title={t.crmWidgets.lifecycle.discard}
      description={t.crmWidgets.lifecycle.discardDescription} confirmLabel={t.crmWidgets.lifecycle.discard}
      pending={lifecycle.action === "discard"} blocked={detail.blocked || detail.isLoading} error={state.lifecycleError}
      onClose={() => lifecycle.setDiscardOpen(false)} onConfirm={() => void state.discard()} />}
  </div>;
}
