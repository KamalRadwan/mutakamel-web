"use client";

import { Eye, RefreshCw, Search } from "lucide-react";
import { Badge, Button, DataTable, DegradedBanner, EmptyState, Input, PageActions, PageHeader,
  PermissionGate, type ColumnDef } from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { CatalogueDetailsDialog } from "./components/CatalogueDetailsDialog";
import { type StaticCatalogueGroup, useCrmStaticCatalogue } from "./hooks/useCrmStaticCatalogue";

export default function CrmStaticCataloguePage() {
  const state = useCrmStaticCatalogue();
  const { t, lang } = state;
  const copy = t.crmStaticCatalogue;
  const columns: ColumnDef<StaticCatalogueGroup>[] = [
    { id: "group", header: copy.group, cell: (item) => <span className="text-foreground">{item.label}</span> },
    { id: "entries", header: copy.entries, cell: (item) => item.sizeLabel
      ? <Badge tone="neutral">{item.sizeLabel}</Badge>
      : item.kind === "permission" || item.kind === "event" ? copy.reference
      : item.key === "rejectedAttachmentFamilies" ? copy.policy
      : <bdi dir="ltr">{formatNumber(item.entriesCount, lang)}</bdi> },
    { id: "values", header: copy.examples, cell: (item) => <span className="block max-w-xl truncate text-foreground">
      {item.kind === "permission" ? copy.permissionSummary : item.kind === "event" ? copy.eventSummary
        : item.values.slice(0, 5).join(" · ") || "—"}
      {item.kind !== "permission" && item.kind !== "event" && item.values.length > 5 ? " · …" : ""}
    </span> },
    { id: "details", header: copy.details, cell: (item) => <Button size="sm" variant="outline" className="size-8 p-0"
      aria-label={formatTemplate(copy.viewDetails, { group: item.label })} onClick={() => state.openDetails(item.key)}>
      <Eye className="size-4" aria-hidden="true" />
    </Button> },
  ];

  return <PermissionGate require="crm.settings.read" denied={state.denied}>
    <div className="flex min-w-0 flex-col gap-4" aria-busy={state.isLoading}>
      <PageHeader title={copy.title} description={copy.subtitle}
        secondaryActions={<Button size="sm" variant="outline" onClick={() => void state.reload()}
          disabled={state.isLoading} loading={state.isLoading}>
          <RefreshCw className="size-4" aria-hidden="true" />{copy.reload}
        </Button>} />
      <PageActions slot="search">
        <div className="relative w-full min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input size="sm" type="search" className="ps-9" value={state.searchQuery}
            placeholder={copy.search} aria-label={copy.search} onChange={(event) => state.setSearchQuery(event.target.value)} />
        </div>
      </PageActions>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge tone="neutral">{copy.readOnly}</Badge>
        {state.catalogue && <span>{formatTemplate(copy.groupCount, { count: formatNumber(state.allGroups.length, lang) })}</span>}
      </div>
      {state.isStale && <DegradedBanner message={copy.stale} />}
      <DataTable columns={columns} rows={state.groups} showRowNumbers={false}
        isLoading={state.isLoading && !state.catalogue} error={state.loadError} onRetry={() => void state.reload()}
        rowKey={(item) => item.id}
        emptyState={<EmptyState title={state.isFiltered ? copy.empty : copy.emptyCatalogue}
          description={state.isFiltered ? copy.noMatchesHint : copy.emptyHint}
          action={state.isFiltered ? { label: copy.clearSearch, onClick: () => state.setSearchQuery("") }
            : { label: copy.reload, onClick: () => void state.reload() }} />}
        labels={{
          retry: t.common.retry, errorTitle: copy.loadFailed, emptyTitle: copy.emptyCatalogue,
          selectAll: t.views.selectAll, selectRow: t.views.selectRow,
          sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) },
        }} />
      <p className="text-xs text-muted-foreground">{copy.advertisedPolicy}</p>
      <CatalogueDetailsDialog group={state.selectedGroup} onClose={state.closeDetails} />
    </div>
  </PermissionGate>;
}
