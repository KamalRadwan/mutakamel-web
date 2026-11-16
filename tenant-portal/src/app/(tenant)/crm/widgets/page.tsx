"use client";
import { useId, useRef, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { Button, DataTable, DegradedBanner, Field, FormModal, Input, PageHeader, PermissionGate,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { useWidgetColumns } from "./components/useWidgetColumns";
import { useWidgetLibraryPage } from "./hooks/useWidgetLibraryPage";
import { WidgetDeleteDialog } from "./components/WidgetDeleteDialog";
import { WIDGET_LIBRARY_ACCESS, WIDGET_LIBRARY_SEARCH_LIMIT, WIDGET_LIBRARY_SOURCES, WIDGET_LIBRARY_STATUSES, widgetLibraryListPath } from "../dashboards/widget-library-contract";
import { WidgetUsagePanel } from "./components/WidgetUsagePanel";
import { WidgetLibraryOwnerFilter } from "./components/WidgetLibraryOwnerFilter";

export default function WidgetsPage() {
  const { t } = useI18n();
  const state = useWidgetLibraryPage();
  const { list } = state;
  const labels = t.crmWidgets.review;
  const usagePanelId = useId();
  const usageTrigger = useRef<HTMLButtonElement>(null);
  const [inspection, setInspection] = useState<{ key: string; id: string } | null>(null);
  const resultKey = `${list.scope}:${widgetLibraryListPath(list.filters)}`;
  const inspected = inspection?.key === resultKey ? list.items.find(item => item.id === inspection.id) : undefined;
  const filtered = !!(list.searchQuery.trim() || list.filters.access || list.filters.status || list.filters.source || list.filters.ownerUserId);
  const filtersDisabled = !!list.pendingId || list.isSubmitting;
  const columns = useWidgetColumns({ canCreate: list.canCreate && !list.blocked, canDelete: list.canDelete && !list.blocked,
    pendingId: list.pendingId, onClone: state.openClone, onDelete: state.openDelete,
    usageWidgetId: inspected?.id ?? null, usagePanelId,
    onInspectUsage: (widget, trigger) => {
      usageTrigger.current = trigger;
      setInspection(inspected?.id === widget.id ? null : { key: resultKey, id: widget.id });
    },
  });
  return <PermissionGate require="crm.widgets.read" denied={list.queryError?.status === 403}>
    <div className="flex w-full flex-col gap-4 px-1 pb-6 sm:px-3">
      <PageHeader title={t.crmWidgets.title} description={t.crmWidgets.subtitle}
        primaryAction={list.canCreate ? { label: t.crmWidgets.add, icon: <Plus className="size-4" aria-hidden="true" />, disabled: list.blocked, onClick: state.openCreate } : undefined}
        secondaryActions={<Button size="xl" variant="outline" disabled={list.isLoading || !!list.pendingId} onClick={state.reload}><RefreshCw className="size-4" aria-hidden="true" />{t.connectivity.reload}</Button>} />
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div role="group" aria-label={labels.libraryAccess} className="flex flex-wrap items-center gap-2">
          {[null, ...WIDGET_LIBRARY_ACCESS].map(access => <Button key={access ?? "all"}
            variant={list.filters.access === access ? "secondary" : "outline"} aria-pressed={list.filters.access === access}
            disabled={filtersDisabled} onClick={() => list.setAccess(access)}>{labels.libraryAccessOptions[access ?? "ALL"]}</Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-lg"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={list.searchQuery} maxLength={WIDGET_LIBRARY_SEARCH_LIMIT} disabled={filtersDisabled}
              onChange={event => list.setSearchQuery(event.target.value)} placeholder={t.crmWidgets.search} aria-label={t.crmWidgets.search} className="ps-8" /></div>
          <Select value={list.filters.source ?? "ALL"} disabled={filtersDisabled}
            onValueChange={value => list.setSource(WIDGET_LIBRARY_SOURCES.find(source => source === value) ?? null)}>
            <SelectTrigger aria-label={labels.librarySource} className="w-full sm:w-auto"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">{labels.allWidgetSources}</SelectItem>
              {WIDGET_LIBRARY_SOURCES.map(source => <SelectItem key={source} value={source}>
                {source === "unclassified" ? labels.unclassifiedSource : t.crmWidgets.metricPicker.resources[source]}
              </SelectItem>)}
            </SelectContent>
          </Select>
          <WidgetLibraryOwnerFilter key={`${list.scope}:${list.filters.access}`} access={list.filters.access} value={list.filters.ownerUserId}
            onChange={list.setOwner} disabled={filtersDisabled} />
          <Select value={list.filters.status ?? "ALL"} disabled={filtersDisabled}
            onValueChange={value => list.setStatus(WIDGET_LIBRARY_STATUSES.find(status => status === value) ?? null)}>
            <SelectTrigger aria-label={t.crmWidgets.lifecycle.status} className="w-full sm:w-auto"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">{labels.allWidgetStatuses}</SelectItem>
              {WIDGET_LIBRARY_STATUSES.map(status => <SelectItem key={status} value={status}>{t.crmWidgets.lifecycle.statuses[status]}</SelectItem>)}</SelectContent>
          </Select>
          {filtered && <Button variant="ghost" disabled={filtersDisabled} onClick={list.clearFilters}>{labels.clearLibraryFilters}</Button>}
        </div>
      </div>
      {list.catalogFailed && <DegradedBanner message={t.crmWidgets.catalogueUnavailableForBuilder} />}
      {(list.readOnly || !list.canCreate) && <p role="note" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">{t.crmWidgets.readOnlyReason}</p>}
      {list.queryError && list.hasLoaded && <DegradedBanner message={labels.staleList} />}
      {list.needsReview && <div className="space-y-2"><DegradedBanner message={labels.uncertain} /><div className="flex gap-2">
        <Button variant="outline" onClick={state.reload} disabled={!!list.pendingId}>{labels.checkCurrent}</Button>
        <Button variant="outline" onClick={list.review} disabled={!list.reviewReady || !!list.pendingId}>{labels.reviewed}</Button></div></div>}
      <DataTable columns={columns} rows={list.items} isLoading={list.isLoading && !list.hasLoaded} error={list.hasLoaded ? null : list.queryError}
        showRowNumbers={false}
        onRetry={state.reload} rowKey={(widget) => widget.id} onRowClick={state.openDetail}
        labels={{ retry: t.common.retry, errorTitle: t.crmWidgets.loadFailed, emptyTitle: filtered ? t.crmWidgets.emptyFiltered : t.crmWidgets.empty,
          selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />
      {inspected && <WidgetUsagePanel id={usagePanelId} key={`${resultKey}:${inspected.id}`} widgetId={inspected.id} widgetName={inspected.name}
        onClose={() => { setInspection(null); usageTrigger.current?.focus(); }} />}
      {list.hasMore && <div className="flex justify-end"><Button variant="outline" disabled={list.isLoading || filtersDisabled}
        loading={list.isLoading} onClick={() => void list.loadMore()}>{t.crmDashboards.loadMoreWidgets}</Button></div>}
      <p role="note" className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">{labels.reusableHint}</p>
      <FormModal open={state.active?.kind === "clone"} onOpenChange={(open) => { if (!open) state.close(); }}
        title={labels.cloneTitle} description={labels.cloneHint} size="card" isDirty={state.cloneName !== ""} isSubmitting={!!list.pendingId}
        submitDisabled={list.blocked || state.cloneName.trim().length > 120} onSubmit={() => void state.clone()} error={state.error}
        labels={{ submit: t.crmWidgets.clone, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
          discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel, sections: labels.sections, sectionInvalid: labels.invalidSection }}>
        <Field showLabel label={labels.cloneName} hint={labels.nameLimit}><Input maxLength={120} value={state.cloneName} disabled={!!list.pendingId} onChange={(event) => state.setCloneName(event.target.value)} /></Field>
        {list.needsReview && <div className="space-y-2"><DegradedBanner message={labels.uncertain} /><div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={state.reload} disabled={!!list.pendingId}>{labels.checkCurrent}</Button>
          <Button variant="outline" onClick={list.review} disabled={!list.reviewReady || !!list.pendingId}>{labels.reviewed}</Button></div></div>}
      </FormModal>
      <WidgetDeleteDialog open={state.active?.kind === "delete"} onClose={state.close}
        title={t.crmWidgets.deleteTitle} description={formatTemplate(t.crmWidgets.deleteDescription, { name: state.active?.target?.name ?? "" })}
        pending={!!list.pendingId} blocked={list.blocked}
        error={state.error} onConfirm={() => void state.remove()} />
    </div>
  </PermissionGate>;
}

