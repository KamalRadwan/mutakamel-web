"use client";
import { CalendarRange, Eye, Lock, LockOpen, RefreshCw } from "lucide-react";
import { Badge, Button, DataTable, DetailSection, Dialog, DialogContent, DialogDescription, DialogTitle, EmptyState, Field, Input, NameSelect,
  PageHeader, PermissionGate, ReasonDialog, type ColumnDef } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../components/InventoryListPagination";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import { PERIOD_STATUSES, type InventoryPeriod, type PeriodStatus } from "../inventory-governance-contract";
import { inventoryMessage } from "../inventory-messages";
import { useInventoryPeriods } from "./hooks/useInventoryPeriods";
import { useInventoryPeriodsView } from "./hooks/useInventoryPeriodsView";
import { CreatePeriodModal } from "./components/CreatePeriodModal";

export default function InventoryPeriodsPage() {
  const model = useInventoryPeriods();
  const view = useInventoryPeriodsView(model.scopeIdentity);
  const { t, lang } = model;
  const inv = t.tradeInventory;
  const loadError = model.queryError ? { ...model.queryError, message: inventoryMessage(model.queryError, t) ?? inv.periodsLoadFailed } : null;
  const target = model.items.find((item) => item.id === model.transition?.id);
  const columns: ColumnDef<InventoryPeriod>[] = [
    { id: "code", header: inv.periodCode, cell: (row) => <bdi className="font-mono">{row.code}</bdi> },
    { id: "start", header: inv.periodStartsOn, cell: (row) => <bdi>{row.startsOn}</bdi> },
    { id: "end", header: inv.periodEndsOn, cell: (row) => <bdi>{row.endsOn}</bdi> },
    { id: "status", header: t.common.status, cell: (row) => <Badge tone="neutral">{row.status === "OPEN" ? <LockOpen className="size-3" aria-hidden="true" /> : <Lock className="size-3" aria-hidden="true" />}{row.status === "OPEN" ? t.tradeStatus.OPEN : t.tradeStatus.CLOSED}</Badge> },
    { id: "backdate", header: inv.periodMaxBackdateDays, cell: (row) => formatTemplate(inv.periodDays, { count: formatNumber(row.maxBackdateDays, lang) }) },
    { id: "closed", header: inv.periodClosedAt, cell: (row) => row.closedAt ? formatDateTime(row.closedAt, lang) : t.tradeCommon.notSet },
    { id: "closedBy", header: inv.periodClosedBy, cell: (row) => model.actorLabel(row.closedBy) },
    { id: "actions", header: t.common.actions, cell: (row) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => view.inspect(row)}><Eye className="size-4" aria-hidden="true" />{t.tradeCommon.overview}</Button>
      {model.canManage ? <Button size="sm" variant="outline" onClick={() => model.openTransition(row, row.status === "OPEN" ? "close" : "reopen")}>{row.status === "OPEN" ? inv.periodClose : inv.periodReopen}</Button> : null}</div> },
  ];
  return <PermissionGate require={model.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!model.canRead || model.queryError?.status === 403}><div className="flex flex-col gap-4">
    <InventoryModuleSubnav active="periods" />
    <PageHeader title={inv.periodsTitle} description={inv.periodsSubtitle} primaryAction={model.canManage ? { label: inv.periodCreate, onClick: model.openCreate } : undefined}
      secondaryActions={<TenantBranchSelect branchIds={model.branchIds} branchId={model.branchId} onChange={model.selectBranch} />} />

    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <Field showLabel label={t.common.status} className="min-w-44"><NameSelect value={model.statusFilter ?? "ALL"} onValueChange={(value) => model.setStatusFilter(value === "ALL" ? undefined : value as PeriodStatus)} placeholder={t.common.status}
        options={[{ value: "ALL", label: inv.filterAll }, ...PERIOD_STATUSES.map((value) => ({ value, label: t.tradeStatus[value] }))]} /></Field>
      <Field showLabel label={inv.effectiveFrom} className="min-w-60"><Input type="datetime-local" value={model.effectiveAtFilter} onChange={(event) => model.setEffectiveAtFilter(event.target.value)} /></Field>
      <Button variant="outline" onClick={model.applyFilters}>{t.tradeInventory.readViews.apply}</Button>
      <Button variant="outline" onClick={model.clearFilters}>{inv.governanceClearFilters}</Button>
      <Button variant="outline" onClick={() => void model.reload()} disabled={model.isRefreshing}><RefreshCw className={model.isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />{t.tradeCommon.reload}</Button>
    </div>
    {loadError && model.hasLoaded ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 text-sm"><p>{inv.governanceStaleList}</p><Button variant="outline" size="sm" onClick={() => void model.reload()} disabled={model.isRefreshing}>{t.common.retry}</Button></div> : null}
    {!model.isScopeResolved ? <EmptyState icon={CalendarRange} title={inv.selectCompanyFirst} description={inv.selectCompanyFirstDescription} /> : <>
      <DataTable columns={columns} rows={model.items} rowKey={(row) => row.id} isLoading={model.isLoading} error={model.hasLoaded ? null : loadError} onRetry={() => void model.reload()}
        labels={{ retry: t.common.retry, errorTitle: inv.periodsLoadFailed, emptyTitle: inv.periodsEmpty, selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />
      <InventoryListPagination page={model.pagination} onPageChange={model.setPage} isRefreshing={model.isRefreshing} />
    </>}
    <p className="text-caption text-muted-foreground">{inv.periodUtcHint}</p>
    <Dialog open={view.inspected !== null} onOpenChange={(open) => { if (!open) view.close(); }}><DialogContent size="2xl" closeLabel={t.common.close}>
      <DialogTitle>{view.inspected?.code}</DialogTitle><DialogDescription>{inv.periodsSubtitle}</DialogDescription>
      {view.inspected ? <DetailSection title={t.tradeCommon.overview} emptyValueLabel={t.tradeCommon.notSet} fields={[
        { label: inv.periodStartsOn, value: view.inspected.startsOn }, { label: inv.periodEndsOn, value: view.inspected.endsOn },
        { label: t.common.status, value: view.inspected.status === "OPEN" ? t.tradeStatus.OPEN : t.tradeStatus.CLOSED },
        { label: inv.periodMaxBackdateDays, value: formatNumber(view.inspected.maxBackdateDays, lang) },
        { label: inv.periodClosedAt, value: view.inspected.closedAt ? formatDateTime(view.inspected.closedAt, lang) : undefined },
        { label: inv.periodClosedBy, value: model.actorLabel(view.inspected.closedBy) },
        { label: inv.reasonCode, value: view.inspected.closeReason ?? undefined },
      ]} /> : null}
      <div className="flex justify-end"><Button variant="outline" onClick={view.close}>{t.common.close}</Button></div>
    </DialogContent></Dialog>
    <CreatePeriodModal key={model.createOpen ? "create-open" : "create-closed"} isOpen={model.createOpen} onClose={model.closeCreate} onSubmit={model.create} isSubmitting={model.isSubmitting} error={model.formError} initialValues={model.createDraft} unresolved={model.unresolved} onRetryOriginal={model.retryOriginal} canRetryOriginal={model.canRetryOriginal} />
    <ReasonDialog key={model.transition?.id ?? "reason-closed"} open={model.transition !== null} onOpenChange={(open) => { if (!open) model.closeTransition(); }}
      title={model.transition?.action === "reopen" ? inv.periodReopenTitle : inv.periodCloseTitle}
      description={model.transition?.action === "reopen" ? inv.periodReopenImpact : inv.periodCloseImpact}
      summarySlot={target ? <p className="rounded-md border border-border bg-muted p-3 text-sm"><bdi>{target.code}</bdi> · <bdi>{target.startsOn}</bdi> – <bdi>{target.endsOn}</bdi></p> : undefined}
      reasonRequired showLabel maxLength={80} onConfirm={(reason) => void model.runTransition(reason)} loading={model.pending !== null || model.transitionUnresolved} error={model.transitionError ?? undefined}
      footerLeading={model.transitionUnresolved ? <div className="flex flex-col gap-2"><p role="status">{inv.governanceUnknownWrite}</p><Button variant="outline" disabled={model.pending !== null} onClick={() => void model.runTransition()}>{inv.governanceRetryOriginal}</Button></div> : undefined}
      labels={{ reason: inv.reasonCode, reasonHint: inv.reasonCodeHint, confirm: model.transition?.action === "reopen" ? inv.periodReopen : inv.periodClose, cancel: t.common.cancel }} />
  </div></PermissionGate>;
}






