"use client";
import { ArrowRight, Calculator, Eye, RefreshCw, Ruler } from "lucide-react";
import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Combobox, DataTable, DetailSection, Dialog, DialogContent, DialogDescription, DialogTitle, EmptyState, Field, IdentifierText, Input, NameSelect,
  PageHeader, PermissionGate, ReasonDialog, type ColumnDef } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../components/InventoryListPagination";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import { UOM_CONVERSION_STATUSES, type InventoryUomConversion, type UomConversionStatus } from "../inventory-governance-contract";
import { useUomConversions } from "./hooks/useUomConversions";
import { useUomConversionView } from "./hooks/useUomConversionView";
import { CreateUomConversionModal } from "./components/CreateUomConversionModal";
import { inventoryMessage } from "../inventory-messages";

export default function UomConversionsPage() {
  const model = useUomConversions();
  const view = useUomConversionView(model.scopeIdentity);
  const { t, lang, references: names } = model;
  const inv = t.tradeInventory;
  const loadError = model.queryError ? { ...model.queryError, message: inventoryMessage(model.queryError, t) ?? inv.conversionsLoadFailed } : null;
  const target = model.items.find((row) => row.id === model.transition?.id);
  const columns: ColumnDef<InventoryUomConversion>[] = [
    { id: "item", header: inv.conversionItem, cell: (row) => <span>{names.profileLabel(row.itemCompanyProfileId)}</span> },
    { id: "conversion", header: inv.factor, cell: (row) => <div className="flex flex-col gap-1"><span>{names.uomLabel(row.fromUomId)} <ArrowRight className="inline size-3 rtl:-scale-x-100" aria-hidden="true" /> {names.uomLabel(row.toUomId)}</span><bdi dir="ltr" className="font-mono text-caption text-muted-foreground">{row.factorNumerator} / {row.factorDenominator}</bdi></div> },
    { id: "revision", header: inv.revisionNumber, cell: (row) => formatTemplate(inv.conversionRevisionBadge, { revision: formatNumber(row.revisionNumber, lang) }) },
    { id: "status", header: t.common.status, cell: (row) => <Badge tone={row.status === "PUBLISHED" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, row.status, t.common.unknownCode)}</Badge> },
    { id: "effective", header: inv.effectiveFrom, cell: (row) => formatDateTime(row.effectiveFrom, lang) },
    { id: "actions", header: t.common.actions, cell: (row) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => view.inspect(row)}><Eye className="size-4" aria-hidden="true" />{inv.conversionInspect}</Button>
      {model.canManage && row.status !== "RETIRED" ? <Button size="sm" variant="outline" onClick={() => model.openTransition(row, row.status === "DRAFT" ? "publish" : "retire")}>{row.status === "DRAFT" ? inv.conversionPublishTitle : inv.conversionRetireTitle}</Button> : null}</div> },
  ];
  return <PermissionGate require={model.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!model.canRead || model.queryError?.status === 403}><div className="flex flex-col gap-4">
    <InventoryModuleSubnav active="uomConversions" />
    <PageHeader title={inv.conversionsTitle} description={inv.conversionsSubtitle} primaryAction={model.canManage ? { label: inv.conversionCreate, onClick: model.openCreate } : undefined}
      secondaryActions={<TenantBranchSelect branchIds={model.branchIds} branchId={model.branchId} onChange={model.selectBranch} />} />

    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <Field showLabel label={inv.conversionItem} className="min-w-60 flex-1"><Combobox value={model.filters.itemCompanyProfileId} selectedLabel={model.filters.itemCompanyProfileId ? names.profileLabel(model.filters.itemCompanyProfileId) : undefined}
        options={names.items.filter((item) => item.profileId).map((item) => ({ value: item.profileId as string, label: item.name, description: item.code }))}
        onSearch={names.searchItems} onValueChange={(value) => model.setFilters((current) => ({ ...current, itemCompanyProfileId: value }))}
        placeholder={inv.filterAll} searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.common.noData} disabled={!names.canCatalog} loading={names.isLoading} wrapLabels clearLabel={inv.governanceClearFilters}
        errorContent={names.itemError ? <div role="alert" className="p-3 text-sm text-destructive"><p>{inv.governanceReferenceLoadFailed}</p><Button variant="outline" onClick={names.refresh}>{t.common.retry}</Button></div> : undefined} /></Field>
      <Field showLabel label={inv.fromUom} className="min-w-40"><NameSelect value={model.filters.fromUomId ?? "ALL"} onValueChange={(value) => model.setFilters((current) => ({ ...current, fromUomId: value === "ALL" ? undefined : value }))} placeholder={inv.filterAll}
        options={[{ value: "ALL", label: inv.filterAll }, ...names.uoms.map((unit) => ({ value: unit.id, label: unit.name }))]} /></Field>
      <Field showLabel label={inv.toUom} className="min-w-40"><NameSelect value={model.filters.toUomId ?? "ALL"} onValueChange={(value) => model.setFilters((current) => ({ ...current, toUomId: value === "ALL" ? undefined : value }))} placeholder={inv.filterAll}
        options={[{ value: "ALL", label: inv.filterAll }, ...names.uoms.map((unit) => ({ value: unit.id, label: unit.name }))]} /></Field>
      <Field showLabel label={t.common.status} className="min-w-36"><NameSelect value={model.statusFilter ?? "ALL"} onValueChange={(value) => model.setStatusFilter(value === "ALL" ? undefined : value as UomConversionStatus)} placeholder={inv.filterAll}
        options={[{ value: "ALL", label: inv.filterAll }, ...UOM_CONVERSION_STATUSES.map((value) => ({ value, label: t.tradeStatus[value] }))]} /></Field>
      <Button variant="outline" onClick={model.applyFilters}>{t.tradeInventory.readViews.apply}</Button>
      <Button variant="outline" onClick={model.clearFilters}>{inv.governanceClearFilters}</Button>
      <Button variant="outline" onClick={() => void model.reload()} disabled={model.isRefreshing}><RefreshCw className={model.isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />{t.tradeCommon.reload}</Button>
    </div>
    {loadError && model.hasLoaded ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 text-sm"><p>{inv.governanceStaleList}</p><Button variant="outline" size="sm" onClick={() => void model.reload()} disabled={model.isRefreshing}>{t.common.retry}</Button></div> : null}
    {!model.isScopeResolved ? <EmptyState icon={Ruler} title={inv.selectCompanyFirst} description={inv.selectCompanyFirstDescription} /> : <>
      <DataTable columns={columns} rows={model.items} rowKey={(row) => row.id} isLoading={model.isLoading} error={model.hasLoaded ? null : loadError} onRetry={() => void model.reload()}
        labels={{ retry: t.common.retry, errorTitle: inv.conversionsLoadFailed, emptyTitle: inv.conversionsEmpty, selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />
      <InventoryListPagination page={model.pagination} onPageChange={model.setPage} isRefreshing={model.isRefreshing} />
    </>}
    <Dialog open={view.inspected !== null} onOpenChange={(open) => { if (!open) view.close(); }}><DialogContent size="2xl" closeLabel={t.common.close} className="max-h-[85dvh] overflow-y-auto">
      <DialogTitle>{inv.conversionsTitle} — {view.inspected ? formatTemplate(inv.conversionRevisionBadge, { revision: formatNumber(view.inspected.revisionNumber, lang) }) : ""}</DialogTitle>
      <DialogDescription>{inv.conversionLocalPreview}</DialogDescription>
      {view.inspected ? <>
        <DetailSection title={t.tradeCommon.overview} emptyValueLabel={t.tradeCommon.notSet} fields={[
          { label: inv.conversionItem, value: names.profileLabel(view.inspected.itemCompanyProfileId) },
          { label: inv.fromUom, value: names.uomLabel(view.inspected.fromUomId) }, { label: inv.toUom, value: names.uomLabel(view.inspected.toUomId) },
          { label: inv.factor, value: `${view.inspected.factorNumerator} / ${view.inspected.factorDenominator}` },
          { label: inv.effectiveFrom, value: formatDateTime(view.inspected.effectiveFrom, lang) },
          { label: inv.conversionPublishedAt, value: view.inspected.publishedAt ? formatDateTime(view.inspected.publishedAt, lang) : undefined },
          { label: inv.conversionPublishedBy, value: model.actorLabel(view.inspected.publishedBy) },
          { label: inv.conversionRetiredAt, value: view.inspected.retiredAt ? formatDateTime(view.inspected.retiredAt, lang) : undefined },
          { label: inv.conversionRetiredBy, value: model.actorLabel(view.inspected.retiredBy) },
        ]} />
        <div className="rounded-lg border border-border bg-muted p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><Calculator className="size-4" aria-hidden="true" />{inv.conversionLocalPreview}</h2>
          <Field showLabel label={inv.conversionInputQuantity} error={view.preview === null ? inv.conversionExactPrecision : undefined}><Input value={view.quantity} inputMode="decimal" onChange={(event) => view.setQuantity(event.target.value)} /></Field>
          {view.preview !== null ? <p className="mt-3 text-lg font-medium"><bdi>{formatDecimalString(view.preview, lang, { maximumFractionDigits: 8 })}</bdi> {names.uomLabel(view.inspected.toUomId)}</p> : null}
        </div>
        <Collapsible><CollapsibleTrigger className="text-sm text-muted-foreground">{inv.readViews.technicalDetails}</CollapsibleTrigger><CollapsibleContent className="flex flex-col gap-2 pt-3">
          <DetailSection title={inv.readViews.technicalDetails} emptyValueLabel={t.tradeCommon.notSet} fields={[
            { label: inv.readViews.recordReference, value: <IdentifierText>{view.inspected.id}</IdentifierText> },
            { label: inv.conversionContentHash, value: view.inspected.contentHash ? <IdentifierText>{view.inspected.contentHash}</IdentifierText> : undefined },
          ]} />
        </CollapsibleContent></Collapsible>
      </> : null}
      <div className="flex justify-end"><Button variant="outline" onClick={view.close}>{t.common.close}</Button></div>
    </DialogContent></Dialog>
    <CreateUomConversionModal key={model.createOpen ? "create-open" : "create-closed"} isOpen={model.createOpen} onClose={model.closeCreate} onSubmit={model.create} isSubmitting={model.isSubmitting} error={model.formError} references={names} initialValues={model.createDraft} unresolved={model.unresolved} onRetryOriginal={model.retryOriginal} canRetryOriginal={model.canRetryOriginal} />
    <ReasonDialog key={model.transition?.id ?? "reason-closed"} open={model.transition !== null} onOpenChange={(open) => { if (!open) model.closeTransition(); }} title={model.transition?.action === "retire" ? inv.conversionRetireTitle : inv.conversionPublishTitle}
      description={model.transition?.action === "retire" ? inv.conversionRetireImpact : inv.conversionPublishImpact}
      summarySlot={target ? <p className="rounded-md border border-border bg-muted p-3 text-sm">{names.profileLabel(target.itemCompanyProfileId)} · {names.uomLabel(target.fromUomId)} → {names.uomLabel(target.toUomId)} · <bdi>{target.factorNumerator}/{target.factorDenominator}</bdi></p> : undefined}
      reasonRequired showLabel maxLength={80} onConfirm={(reason) => void model.runTransition(reason)} loading={model.pending !== null || model.transitionUnresolved} error={model.transitionError ?? undefined}
      footerLeading={model.transitionUnresolved ? <div className="flex flex-col gap-2"><p role="status">{inv.governanceUnknownWrite}</p><Button variant="outline" disabled={model.pending !== null} onClick={() => void model.runTransition()}>{inv.governanceRetryOriginal}</Button></div> : undefined}
      labels={{ reason: inv.reasonCode, reasonHint: inv.reasonCodeHint, confirm: t.tradeCommon.confirm, cancel: t.common.cancel }} />
  </div></PermissionGate>;
}





