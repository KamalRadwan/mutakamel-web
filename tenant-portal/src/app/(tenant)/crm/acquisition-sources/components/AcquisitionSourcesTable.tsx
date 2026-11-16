"use client";

import { Badge, DataTable, EmptyState, type ColumnDef } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../acquisition-source-contract";
import type { useAcquisitionSourcesWorkspace } from "../hooks/useAcquisitionSourcesWorkspace";
import { AcquisitionSourceActions } from "./AcquisitionSourceActions";
import { SourceIconPreview } from "./SourceIconPreview";

export function AcquisitionSourcesTable({ workspace }: { workspace: ReturnType<typeof useAcquisitionSourcesWorkspace> }) {
  const { state } = workspace;
  const { t, lang } = state;
  const columns: ColumnDef<AcquisitionSource>[] = [
    { id: "order", header: t.crmAcquisitionSources.order, width: "3.5rem", cell: (item) => <span className="tabular-nums">{formatNumber(item.sortOrder, lang)}</span> },
    { id: "nameAr", header: t.crmLeadStages.arabicName, cell: (item) => <div className="flex min-w-0 items-center gap-2">
      <SourceIconPreview source={item} /><bdi dir="rtl" className="min-w-0 whitespace-normal font-normal text-foreground">{item.nameAr}</bdi>
    </div> },
    { id: "nameEn", header: t.crmLeadStages.englishName, cell: (item) => <bdi dir="ltr" className="whitespace-normal font-normal text-foreground">{item.nameEn}</bdi> },
    { id: "status", header: t.common.status, width: "6rem", cell: (item) => <Badge tone={item.isActive ? "positive" : "neutral"}>
      {item.isActive ? t.common.active : t.common.inactive}
    </Badge> },
    ...(state.canManage ? [{ id: "actions", header: t.common.actions, width: "11rem", align: "end" as const, sticky: "end" as const,
      cell: (item: AcquisitionSource) => <AcquisitionSourceActions source={item} workspace={workspace} /> }] : []),
  ];
  return <DataTable
    className="min-w-0 [&_table]:min-w-3xl [&_tbody_tr]:bg-card [&_thead_th]:bg-muted"
    columns={columns} rows={state.items} rowKey={(item) => item.id} showRowNumbers={false}
    rowReorder={state.canManage && !state.isFiltered ? {
      onReorder: workspace.handleReorder, isPending: workspace.reorderBlocked || !!workspace.selectedForMove,
      rowLabel: (item) => localizedName(item, lang), dragHandleLabel: t.crmAcquisitionSources.dragHandle,
    } : undefined}
    isLoading={state.isLoading && !state.hasLoadedItems} error={state.queryError} onRetry={() => void state.reload()}
    emptyState={<EmptyState title={state.isFiltered ? t.crmAcquisitionSources.noMatch : t.crmAcquisitionSources.emptyCatalogue}
      description={state.isFiltered ? t.crmAcquisitionSources.noMatchDescription : t.crmAcquisitionSources.emptyDescription}
      action={state.isFiltered ? { label: t.crmAcquisitionSources.clearSearch, onClick: () => state.setSearchQuery("") }
        : state.canManage ? { label: t.crmAcquisitionSources.add, onClick: state.openCreate } : undefined} />}
    labels={{ retry: t.common.retry, errorTitle: t.crmAcquisitionSources.loadFailed, emptyTitle: t.crmAcquisitionSources.emptyCatalogue,
      selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending,
      sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
      pagination: { previous: t.common.previousPage, next: t.common.nextPage,
        summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }}
  />;
}
