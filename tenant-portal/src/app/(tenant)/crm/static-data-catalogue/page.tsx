"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { Badge, Button, DataTable, DegradedBanner, FilterBar, PageHeader, SubNav, NAV_SECTIONS, type ColumnDef } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import {
  type StaticCatalogueGroup,
  useCrmStaticCatalogue,
} from "./hooks/useCrmStaticCatalogue";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function CrmStaticCataloguePage() {
  const { t, catalogue, groups, searchQuery, setSearchQuery, isLoading, error, reload } = useCrmStaticCatalogue();

  const columns: ColumnDef<StaticCatalogueGroup>[] = [
    {
      id: "group",
      header: t.crmStaticCatalogue.group,
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <code className="font-mono text-xs font-medium text-foreground">{item.key}</code>
        </div>
      ),
    },
    {
      id: "kind",
      header: t.crmStaticCatalogue.kind,
      cell: (item) => <Badge tone="neutral">{t.crmStaticCatalogue.kinds[item.kind] ?? item.kind}</Badge>,
    },
    {
      id: "entries",
      header: t.crmStaticCatalogue.entries,
      numeric: true,
      cell: (item) => item.entriesCount,
    },
    {
      id: "examples",
      header: t.crmStaticCatalogue.examples,
      cell: (item) => (
        <span className="block max-w-xl truncate text-muted-foreground" title={item.values.join(" · ")}>
          {item.values.slice(0, 3).join(" · ") || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.crm.staticDataCatalogAndRefere}
        description={t.crmStaticCatalogue.subtitle}
        secondaryActions={
          <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {t.crmStaticCatalogue.reload}
          </Button>
        }
      />

      <SubNav items={CRM_SETUP_ITEMS} />

      {catalogue && <DegradedBanner message={t.crmStaticCatalogue.advertisedPolicy} />}

      <FilterBar
        filters={[]}
        values={{}}
        onChange={() => undefined}
        onReset={() => undefined}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t.crmStaticCatalogue.search}
      />

      {error && (
        <div role="alert" className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={groups}
        isLoading={isLoading && !catalogue}
        error={null}
        page={{ page: 1, limit: Math.max(groups.length, 1), total: groups.length }}
        onPageChange={() => undefined}
        rowKey={(item) => item.id}
        labels={{
          retry: t.common.retry,
          errorTitle: "",
          emptyTitle: t.crmStaticCatalogue.empty,
          selectAll: t.common.actions,
          selectRow: t.common.actions,
          sortAscending: t.common.actions,
          sortDescending: t.common.actions,
          notSorted: t.common.actions,
          pagination: {
            previous: t.common.previousPage,
            next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
          },
        }}
      />
    </div>
  );
}
