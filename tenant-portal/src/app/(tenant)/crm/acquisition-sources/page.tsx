"use client";

import { ChevronDown, ChevronUp, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  NAV_SECTIONS,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { AcquisitionSourceIcon } from "../shared/components/AcquisitionSourceIcon";
import type { AcquisitionSource } from "./acquisition-source-contract";
import { AcquisitionSourceIconDrawer } from "./components/AcquisitionSourceIconDrawer";
import { CreateAcquisitionSourcesModal } from "./components/CreateAcquisitionSourcesModal";
import { DeleteAcquisitionSourcesConfirmModal } from "./components/DeleteAcquisitionSourcesConfirmModal";
import { useAcquisitionSourceIcon } from "./hooks/useAcquisitionSourceIcon";
import { useAcquisitionSources } from "./hooks/useAcquisitionSources";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function AcquisitionSourcesPage() {
  const { lang } = useI18n();
  const {
    t,
    items,
    hasLoadedItems,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    isDeleting,
    queryError,
    mutationError,
    canManage,
    isCreateOpen,
    openCreate,
    closeCreate,
    selectedForDelete,
    selectForDelete,
    closeDelete,
    handleCreate,
    handleDelete,
    reload,
    isFiltered,
    reorderingId,
    handleMove,
    applyUpdatedSource,
  } = useAcquisitionSources();
  const icon = useAcquisitionSourceIcon(canManage, applyUpdatedSource);

  const columns: ColumnDef<AcquisitionSource>[] = [
    {
      id: "source",
      header: t.crmAcquisitionSources.source,
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <AcquisitionSourceIcon source={item} size="md" />
          <div>
            <p className="font-medium text-foreground">{localizedName(item, lang)}</p>
            <p className="text-2xs text-muted-foreground">{alternateName(item, lang)}</p>
          </div>
        </div>
      ),
    },
    {
      id: "order",
      header: t.crmAcquisitionSources.order,
      numeric: true,
      cell: (item) => item.sortOrder,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (item) => (
        <Badge tone={item.isActive ? "positive" : "neutral"}>{item.isActive ? t.common.active : t.common.inactive}</Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (item: AcquisitionSource) => (
              <div className="flex items-center justify-end gap-1">
                {/* Reorder is earlier/later controls, not drag-only — the
                    same rule the column header follows. Each press sends the
                    COMPLETE ordered id list, so it is suppressed while a
                    search narrows the view: the visible order would not be
                    the order being written. */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleMove(item, -1)}
                  disabled={isFiltered || reorderingId !== null || item.sortOrder <= 1}
                  aria-label={`${t.crmAcquisitionSources.moveEarlier}: ${localizedName(item, lang)}`}
                >
                  <ChevronUp className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleMove(item, 1)}
                  disabled={isFiltered || reorderingId !== null || item.sortOrder >= items.length}
                  aria-label={`${t.crmAcquisitionSources.moveLater}: ${localizedName(item, lang)}`}
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => icon.select(item)}
                      disabled={icon.isUploading}
                      aria-label={`${t.crmAcquisitionSources.iconTitle}: ${localizedName(item, lang)}`}
                    >
                      <ImagePlus className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.crmAcquisitionSources.iconTitle}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectForDelete(item)}
                      disabled={isDeleting}
                      aria-label={`${t.common.delete}: ${localizedName(item, lang)}`}
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

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.acquisition_sources.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crm.acquisitionSourcesAndMarket}
          description={t.crmAcquisitionSources.subtitle}
          primaryAction={canManage ? { label: t.crmAcquisitionSources.add, onClick: openCreate } : undefined}
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              {t.crmAcquisitionSources.reload}
            </Button>
          }
        />

        <SubNav items={CRM_SETUP_ITEMS} />

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmAcquisitionSources.search}
        />

        {mutationError && !selectedForDelete && !isCreateOpen ? (
          <p role="alert" className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
            {mutationError}
          </p>
        ) : null}

        {/* No pagination: this endpoint returns the whole list and declares no
            page/limit query at all (verified in its controller). The fake
            single-page object this replaced rendered working-looking controls
            over data that could never advance —
            docs/design/states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading && !hasLoadedItems}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(item) => item.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmAcquisitionSources.loadFailed,
            emptyTitle: t.crmAcquisitionSources.empty,
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

        {/* Both keys remount their dialog on open so it never reopens holding
            the last edit. They are namespaced because these are siblings: two
            "closed" keys in one parent is a duplicate-key warning, and React is
            entitled to treat the pair as one child. */}
        <CreateAcquisitionSourcesModal
          key={isCreateOpen ? "create-open" : "create-closed"}
          isOpen={isCreateOpen}
          onClose={closeCreate}
          onSubmit={handleCreate}
          isSubmitting={isCreating}
          error={mutationError}
        />

        <AcquisitionSourceIconDrawer
          key={`icon-${icon.selected?.id ?? "closed"}`}
          source={icon.selected}
          isSubmitting={icon.isUploading}
          error={icon.error}
          onClose={icon.close}
          onSubmit={icon.upload}
        />

        <DeleteAcquisitionSourcesConfirmModal
          isOpen={!!selectedForDelete}
          item={selectedForDelete}
          onClose={closeDelete}
          onConfirm={() => void handleDelete()}
          isSubmitting={isDeleting}
          error={mutationError}
        />
      </div>
    </PermissionGate>
  );
}
