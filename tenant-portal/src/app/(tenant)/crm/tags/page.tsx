"use client";

import { Plus, RefreshCw, Search, Tags } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  DateTime,
  DegradedBanner,
  EmptyState,
  Input,
  PageActions,
  PageHeader,
  PermissionGate,
  cn,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTagCatalogueItem } from "../shared/tag-contract";
import { CrmTagNameCell, CrmTagColourCell, CrmTagActionsCell } from "./components/CrmTagTableCells";
import { CrmTagFormModal } from "./components/CrmTagFormModal";
import { DeleteCrmTagConfirmModal } from "./components/DeleteCrmTagConfirmModal";
import { useCrmTags } from "./hooks/useCrmTags";

export default function CrmTagsPage() {
  const { t, lang } = useI18n();
  const tags = useCrmTags();

  const columns: ColumnDef<CrmTagCatalogueItem>[] = [
    { id: "tag", header: t.crmTags.tag, width: "40%", cell: (item) => <CrmTagNameCell item={item} /> },
    { id: "colour", header: t.crmTags.colour, width: "25%", cell: (item) => <CrmTagColourCell item={item} /> },
    { id: "updated", header: t.crmTags.updated, width: "20%", cell: (item) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        <DateTime value={item.updatedAt} precision="date" language={lang} />
      </span>
    ) },
    ...(tags.canManage ? [{
      id: "actions", header: t.common.actions, align: "end" as const, sticky: "end" as const,
      cell: (item: CrmTagCatalogueItem) => <CrmTagActionsCell item={item} disabled={tags.writesBlocked}
        onEdit={tags.openEdit} onDelete={tags.selectForDelete} />,
    }] : []),
  ];

  // Permission string and scoping mirror CRM_ENTRY_ROUTES in
  // src/lib/navigation/tenant-routes.ts; a direct URL still gets the 403 surface.
  return (
    <PermissionGate require="crm.tags.read" denied={tags.queryError?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.nav.crmTags}
          primaryAction={tags.canManage ? {
            label: t.crmTags.add, icon: <Plus className="size-4" aria-hidden="true" />,
            onClick: tags.openCreate, disabled: tags.writesBlocked || tags.atCapacity,
          } : undefined}
          secondaryActions={
            <Button size="sm" variant="outline" onClick={tags.reload} disabled={tags.isLoading || tags.isDeleting}>
              <RefreshCw className={cn("size-4", tags.isLoading && "animate-spin")} aria-hidden="true" />
              {t.crmTags.reload}
            </Button>
          }
        />

        <PageActions slot="search">
          <div className="relative w-full min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input size="sm" type="search" className="ps-9" value={tags.searchQuery}
              placeholder={t.crmTags.search} aria-label={t.crmTags.search}
              onChange={(event) => tags.setSearchQuery(event.target.value)} />
          </div>
        </PageActions>

        {!tags.canManage && tags.hasLoaded && <DegradedBanner message={t.crmTags.readOnly} />}
        {tags.atCapacity && tags.canManage && <DegradedBanner message={t.crmTags.errors.limitExceeded} />}

        {tags.notice && (
          <div className="flex flex-col items-start gap-2" role="status">
            <DegradedBanner message={tags.notice} />
            {tags.needsReload && <Button size="sm" variant="outline" onClick={tags.reload} disabled={tags.isLoading}>
              <RefreshCw className="size-4" aria-hidden="true" />{t.crmTags.reload}
            </Button>}
          </div>
        )}

        <section aria-labelledby="tag-library-heading" aria-busy={tags.isLoading} className="min-w-0">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <Tags className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 id="tag-library-heading" className="text-lg font-semibold text-foreground">{t.nav.crmTags}</h2>
                    {tags.catalogueCount !== undefined && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-count-active-surface px-1.5 text-xs text-count-active-fg">
                      {tags.catalogueCount}
                    </span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.crmTags.subtitle}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t.crmTags.editAppliesEverywhere}</p>
            </div>

            {/* No pagination: GET /tags returns the whole catalogue (at most 500)
                and declares no page/limit query — docs/design/states.md#pagination-is-real-or-absent. */}
            <DataTable
              surface="embedded"
              columns={columns}
              rows={tags.items}
              rowKey={(item) => item.id}
              showRowNumbers={false}
              density="default"
              className="mx-3 [&_table]:min-w-xl [&_table]:text-sm [&_tbody_tr]:h-11 [&_td]:py-2 [&_thead_th]:h-9 [&_thead_th]:bg-muted"
              isLoading={tags.isLoading && !tags.hasLoaded}
              error={tags.queryError}
              onRetry={tags.reload}
              emptyState={<EmptyState
                icon={Tags}
                title={tags.isFiltered ? t.crmTags.empty : t.crmTags.emptyCatalogue}
                description={tags.isFiltered ? t.crmTags.noMatchesHint : t.crmTags.emptyHint}
                action={tags.isFiltered ? { label: t.crmTags.clearSearch, onClick: () => tags.setSearchQuery("") }
                  : tags.canManage && !tags.writesBlocked ? { label: t.crmTags.add, onClick: tags.openCreate } : undefined}
              />}
              labels={{
                retry: t.common.retry,
                errorTitle: t.crmTags.loadFailed,
                emptyTitle: t.crmTags.empty,
                selectAll: t.views.selectAll,
                selectRow: t.views.selectRow,
                sortAscending: t.views.sortAscending,
                sortDescending: t.views.sortDescending,
                notSorted: t.views.notSorted,
                pagination: {
                  previous: t.common.previousPage,
                  next: t.common.nextPage,
                  summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
                },
              }}
            />
            {tags.catalogueCountLabel && <p role="status" aria-live="polite" aria-atomic="true"
              className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {tags.catalogueCountLabel}
            </p>}
          </Card>
        </section>

        {tags.canManage && tags.formTarget && (
          <CrmTagFormModal
            key={tags.formTarget.mode === "edit" ? `edit-${tags.formTarget.tag.id}` : "create"}
            target={tags.formTarget}
            existingTags={tags.allItems}
            onClose={tags.closeForm}
            onSaved={tags.handleSaved}
            onReloadNeeded={tags.handleFormReload}
            canWrite={!tags.writesBlocked}
          />
        )}

        <DeleteCrmTagConfirmModal
          tag={tags.canManage ? tags.deleteTarget : null}
          error={tags.deleteError}
          isSubmitting={tags.isDeleting}
          blocked={tags.deleteBlocked}
          leadCount={tags.deleteLeadCount}
          onClose={tags.closeDelete}
          onConfirm={() => void tags.handleDelete()}
        />
      </div>
    </PermissionGate>
  );
}
