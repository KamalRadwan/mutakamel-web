"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  NAV_SECTIONS,
  type ColumnDef,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import {
  type StaticCatalogueGroup,
  useCrmStaticCatalogue,
} from "./hooks/useCrmStaticCatalogue";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function CrmStaticCataloguePage() {
  const { t, catalogue, groups, searchQuery, setSearchQuery, isLoading, loadError, isStale, reload } =
    useCrmStaticCatalogue();

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

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.settings.read">
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

        {/* The degraded surface is for partial or stale data, and nothing
            else — see docs/design/patterns.md#where-a-result-belongs. It used
            to fire on every successful load, which left a real degradation
            with nowhere to appear. */}
        {isStale && <DegradedBanner message={t.crmStaticCatalogue.stale} />}

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmStaticCatalogue.search}
        />

        {/* A permanent caveat about what this catalogue means, not a condition
            that can clear. It reads as a caption, not a banner. */}
        <p className="text-xs text-muted-foreground">{t.crmStaticCatalogue.advertisedPolicy}</p>

        {/* No pagination: this endpoint returns the whole list and declares no
            page/limit query at all (verified in its controller). The fake
            single-page object this replaced rendered working-looking controls
            over data that could never advance —
            docs/design/states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={groups}
          isLoading={isLoading && !catalogue}
          error={loadError}
          onRetry={() => void reload()}
          rowKey={(item) => item.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmStaticCatalogue.loadFailed,
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
    </PermissionGate>
  );
}
