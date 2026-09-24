"use client";

import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import {
  Button,
  DataTable,
  DateTime,
  FilterBar,
  NAV_SECTIONS,
  PageHeader,
  PermissionGate,
  SubNav,
  TagChip,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  findTagColorPreset,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { crmTagColor, type CrmTagCatalogueItem } from "../shared/tag-contract";
import { CrmTagFormModal } from "./components/CrmTagFormModal";
import { DeleteCrmTagConfirmModal } from "./components/DeleteCrmTagConfirmModal";
import { useCrmTags } from "./hooks/useCrmTags";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function CrmTagsPage() {
  const { t, lang } = useI18n();
  const tags = useCrmTags();

  // The colour column names the pair in words — a preset by its name, a
  // custom pair by its two hex values — so the chip's hue is never the only
  // thing saying which colour a tag has.
  function colourCell(item: CrmTagCatalogueItem) {
    const color = crmTagColor(item);
    if (color === null) return <span className="text-muted-foreground">{t.tagColors.none}</span>;
    const preset = findTagColorPreset(color);
    if (preset) return t.tagColors.names[preset.key];
    return (
      <span className="flex flex-wrap items-center gap-x-1.5">
        {t.crmTags.customColour}
        <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">
          {color.backgroundColor} / {color.textColor}
        </bdi>
      </span>
    );
  }

  const columns: ColumnDef<CrmTagCatalogueItem>[] = [
    {
      id: "tag",
      header: t.crmTags.tag,
      cell: (item) => (
        <TagChip label={item.name} backgroundColor={item.backgroundColor} textColor={item.textColor} />
      ),
    },
    { id: "colour", header: t.crmTags.colour, cell: colourCell },
    {
      id: "updated",
      header: t.crmTags.updated,
      cell: (item) => <DateTime value={item.updatedAt} language={lang} />,
    },
    ...(tags.canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (item: CrmTagCatalogueItem) => (
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => tags.openEdit(item)}
                      aria-label={`${t.crmTags.edit}: ${item.name}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.crmTags.edit}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => tags.selectForDelete(item)}
                      disabled={tags.isDeleting}
                      aria-label={`${t.common.delete}: ${item.name}`}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.common.delete}</TooltipContent>
                </Tooltip>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Permission string and scoping mirror CRM_ENTRY_ROUTES in
  // src/lib/navigation/tenant-routes.ts; a direct URL still gets the 403 surface.
  return (
    <PermissionGate require="crm.tags.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.nav.crmTags}
          description={t.crmTags.subtitle}
          primaryAction={tags.canManage ? { label: t.crmTags.add, onClick: tags.openCreate } : undefined}
          secondaryActions={
            <Button size="sm" variant="outline" onClick={tags.reload} disabled={tags.isLoading}>
              <RefreshCw className={cn("size-4", tags.isLoading && "animate-spin")} aria-hidden="true" />
              {t.crmTags.reload}
            </Button>
          }
        />

        <SubNav items={CRM_SETUP_ITEMS} />

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={tags.searchQuery}
          onSearchChange={tags.setSearchQuery}
          searchPlaceholder={t.crmTags.search}
        />

        {tags.notice && (
          <p role="alert" className="rounded-sm bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground">
            {tags.notice}
          </p>
        )}

        {/* No pagination: GET /tags returns the whole catalogue (at most 500)
            and declares no page/limit query — docs/design/states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={tags.items}
          isLoading={tags.isLoading && !tags.hasLoaded}
          error={tags.queryError}
          onRetry={tags.reload}
          rowKey={(item) => item.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmTags.loadFailed,
            emptyTitle: t.crmTags.empty,
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

        {tags.formTarget && (
          <CrmTagFormModal
            key={tags.formTarget.mode === "edit" ? `edit-${tags.formTarget.tag.id}` : "create"}
            target={tags.formTarget}
            existingTags={tags.allItems}
            onClose={tags.closeForm}
            onSaved={tags.handleSaved}
            onReloadNeeded={tags.handleFormReload}
          />
        )}

        <DeleteCrmTagConfirmModal
          tag={tags.deleteTarget}
          error={tags.deleteError}
          isSubmitting={tags.isDeleting}
          onClose={tags.closeDelete}
          onConfirm={() => void tags.handleDelete()}
        />
      </div>
    </PermissionGate>
  );
}
