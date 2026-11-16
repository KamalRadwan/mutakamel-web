"use client";

import { ChevronDown } from "lucide-react";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, Dialog,
  DialogContent, DialogDescription, DialogHeader, DialogTitle, IdentifierText, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { StaticCatalogueGroup, StaticCatalogueRule } from "../hooks/static-catalogue-groups";

export function CatalogueDetailsDialog({ group, onClose }: { group: StaticCatalogueGroup | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const copy = t.crmStaticCatalogue;
  const columns: ColumnDef<StaticCatalogueRule>[] = [
    { id: "stage", header: copy.stage, cell: (rule) => rule.stage },
    { id: "status", header: copy.resultingStatus, cell: (rule) => <Badge tone={rule.tone}>{rule.status}</Badge> },
  ];
  return <Dialog open={group !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    {group && <DialogContent size="2xl" className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader className="pe-10">
        <DialogTitle>{group.label}</DialogTitle>
        <DialogDescription>{copy.subtitle}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{copy.readOnly}</Badge>
        <span className="text-xs text-muted-foreground">{copy.entries}: <bdi dir="ltr">{formatNumber(group.entriesCount, lang)}</bdi></span>
        {group.sizeLabel && <span className="text-xs text-muted-foreground">{copy.maximumSize}: {group.sizeLabel}</span>}
      </div>
      {group.rules ? <DataTable columns={columns} rows={group.rules} showRowNumbers={false} isLoading={false}
        rowKey={(rule) => rule.key} labels={{
          retry: t.common.retry, errorTitle: copy.loadFailed, emptyTitle: copy.emptyCatalogue,
          selectAll: t.views.selectAll, selectRow: t.views.selectRow,
          sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) },
        }} /> : <section aria-label={copy.examples} className="rounded-md border border-border bg-card p-3">
          <h2 className="mb-2 text-sm font-medium text-foreground">{copy.examples}</h2>
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {group.values.map((value, index) => <li key={index} className="wrap-anywhere"><bdi>{value}</bdi></li>)}
          </ul>
        </section>}
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground">
          <ChevronDown className="size-4" aria-hidden="true" />{copy.technicalDetails}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 flex flex-col gap-1 rounded-md border border-border bg-muted p-3 text-xs">
            <IdentifierText>{group.key}</IdentifierText>
            {group.technicalValues.map((value, index) => <IdentifierText key={index}>{value}</IdentifierText>)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </DialogContent>}
  </Dialog>;
}
