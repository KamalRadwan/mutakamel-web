"use client";

import { Pencil, RotateCw, Star, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  StatusBadge,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  NAV_SECTIONS,
  type ColumnDef,
} from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import { useAccessMode } from "@/hooks/useAccessMode";
import { formatTemplate } from "@/lib/format/template";
import { CreateLeadStagesModal } from "./components/CreateLeadStagesModal";
import { DeleteLeadStagesConfirmModal } from "./components/DeleteLeadStagesConfirmModal";
import { EditLeadStageModal } from "./components/EditLeadStageModal";
import { useLeadStages, type LeadStageItem } from "./hooks/useLeadStages";
import {
  canBeDefaultLeadStage,
  isProtectedLeadStage,
} from "./lead-stage-contract";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function LeadStagesPage() {
  const { canMutate } = useAccessMode();
  const {
    t,
    items,
    isLoading,
    isDeleting,
    settingDefaultId,
    error,
    loadError,
    canManage: capabilityCanManage,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    openCreate,
    closeCreate,
    isCreating,
    createError,
    selectedForDelete,
    openDelete,
    closeDelete,
    handleCreate,
    handleDelete,
    handleSetDefault,
    fetchStages,
    deleteError,
    isUpdating,
    editError,
    selectedForEdit,
    openEdit,
    closeEdit,
    handleUpdate,
    isFiltered,
    fixedStageIds,
    isReordering,
    handleReorder,
    lang,
  } = useLeadStages();
  const canManage = canMutate && capabilityCanManage;

  const columns: ColumnDef<LeadStageItem>[] = [
    {
      id: "nameAr",
      header: t.crmLeadStages.arabicName,
      cell: (item) => (
        <span dir="rtl" className="font-medium text-foreground">
          {item.nameAr}
        </span>
      ),
    },
    {
      id: "nameEn",
      header: t.crmLeadStages.englishName,
      cell: (item) => <span dir="ltr">{item.nameEn}</span>,
    },
    {
      id: "semantics",
      header: t.crmLeadStages.semantics,
      cell: (item) => (
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge value={item.flag} kind="LeadStageFlag" />
          <StatusBadge value={item.category} kind="StageCategory" />
        </div>
      ),
    },
    {
      id: "order",
      header: t.crmLeadStages.order,
      numeric: true,
      cell: (item) => item.sortOrder,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (item) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={item.isActive ? "positive" : "neutral"}>
            {item.isActive ? t.common.active : t.common.inactive}
          </Badge>
          {item.isDefault && <Badge tone="caution">{t.crmLeadStages.default}</Badge>}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (item: LeadStageItem) => (
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                      tabIndex={isProtectedLeadStage(item) || isUpdating ? 0 : undefined}
                      role={isProtectedLeadStage(item) || isUpdating ? "group" : undefined}
                      aria-disabled={isProtectedLeadStage(item) || isUpdating || undefined}
                      aria-label={isProtectedLeadStage(item) || isUpdating
                        ? `${t.crmLeadStages.editTitle}: ${localizedName(item, lang)}. ${isProtectedLeadStage(item) ? t.crmLeadStages.protectedHint : t.crmConfigActionHints.pending}`
                        : undefined}
                    >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(item)}
                      disabled={isProtectedLeadStage(item) || isUpdating}
                      className="disabled:pointer-events-none"
                      aria-label={`${t.crmLeadStages.editTitle}: ${item.nameEn}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isProtectedLeadStage(item)
                      ? t.crmLeadStages.protectedHint
                      : isUpdating ? t.crmConfigActionHints.pending : t.crmLeadStages.editTitle}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                      tabIndex={!canBeDefaultLeadStage(item) || item.isDefault || settingDefaultId !== null ? 0 : undefined}
                      role={!canBeDefaultLeadStage(item) || item.isDefault || settingDefaultId !== null ? "group" : undefined}
                      aria-disabled={!canBeDefaultLeadStage(item) || item.isDefault || settingDefaultId !== null || undefined}
                      aria-label={!canBeDefaultLeadStage(item) || item.isDefault || settingDefaultId !== null
                        ? `${t.crmLeadStages.setDefault}: ${localizedName(item, lang)}. ${item.flag === "DISQUALIFIED" || item.flag === "CONVERTED"
                          ? t.crmLeadStages.terminalDefaultHint
                          : !item.isActive ? t.crmConfigActionHints.inactiveStage
                          : item.isDefault ? t.crmConfigActionHints.alreadyDefault
                          : t.crmConfigActionHints.pending}`
                        : undefined}
                    >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleSetDefault(item)}
                      disabled={!canBeDefaultLeadStage(item) || item.isDefault || settingDefaultId !== null}
                      className="disabled:pointer-events-none"
                      loading={settingDefaultId === item.id}
                      aria-label={`${t.crmLeadStages.setDefault}: ${item.nameEn}`}
                    >
                      <Star className="size-4" aria-hidden="true" />
                    </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {item.flag === "DISQUALIFIED" || item.flag === "CONVERTED"
                      ? t.crmLeadStages.terminalDefaultHint
                      : !item.isActive ? t.crmConfigActionHints.inactiveStage
                      : item.isDefault ? t.crmConfigActionHints.alreadyDefault
                      : settingDefaultId !== null ? t.crmConfigActionHints.pending
                      : t.crmLeadStages.setDefault}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                      tabIndex={isProtectedLeadStage(item) || item.isDefault || isDeleting ? 0 : undefined}
                      role={isProtectedLeadStage(item) || item.isDefault || isDeleting ? "group" : undefined}
                      aria-disabled={isProtectedLeadStage(item) || item.isDefault || isDeleting || undefined}
                      aria-label={isProtectedLeadStage(item) || item.isDefault || isDeleting
                        ? `${t.common.delete}: ${localizedName(item, lang)}. ${isProtectedLeadStage(item)
                          ? t.crmLeadStages.protectedHint
                          : item.isDefault ? t.crmConfigActionHints.defaultStageDelete
                          : t.crmConfigActionHints.pending}`
                        : undefined}
                    >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDelete(item)}
                      disabled={isProtectedLeadStage(item) || item.isDefault || isDeleting}
                      className="disabled:pointer-events-none"
                      aria-label={`${t.common.delete}: ${item.nameEn}`}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                    </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isProtectedLeadStage(item)
                      ? t.crmLeadStages.protectedHint
                      : item.isDefault ? t.crmConfigActionHints.defaultStageDelete
                      : isDeleting ? t.crmConfigActionHints.pending : t.common.delete}
                  </TooltipContent>
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
    <PermissionGate require="crm.lead_stages.read" denied={loadError?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader className="sr-only"
          title={t.crm.salesFunnelStagesLeadStag}
          description={t.crm.preparingAndSequencingTheS}
          primaryAction={canManage ? { label: t.crm.addANewStage, onClick: openCreate } : undefined}
        />

        <SubNav items={CRM_SETUP_ITEMS} />

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crm.searchByStageName}
        />

        {/* Write feedback only. A failed LOAD is handed to DataTable below, so
            its error state replaces the empty state instead of stacking. */}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchStages()}>
              <RotateCw className="size-4" aria-hidden="true" />
              {t.common.retry}
            </Button>
          </div>
        )}

        {/* Reorder is the whole order in one write, so it is driven by the
            unfiltered catalogue: while a search narrows the table the handles
            are gone, and this says why rather than leaving them mysteriously
            absent. */}
        {canManage && isFiltered && (
          <p role="note" className="text-xs text-muted-foreground">
            {t.crmLeadStages.reorderFilteredHint}
          </p>
        )}

        {/* No pagination: this endpoint returns the whole list and declares no
            page/limit query at all (verified in its controller). The fake
            single-page object this replaced rendered working-looking controls
            over data that could never advance —
            docs/design/states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          error={loadError}
          onRetry={() => void fetchStages()}
          rowKey={(item) => item.id}
          // NEW is pinned first and the terminal anchors are pinned in the
          // last two positions. A drop through any of them is refused before
          // it becomes a server round trip.
          rowReorder={
            canManage && !isFiltered
              ? {
                  onReorder: (orderedIds) => void handleReorder(orderedIds),
                  isPinned: (id) => fixedStageIds.has(id),
                  isPending: isReordering,
                  rowLabel: (item) => localizedName(item, lang),
                  dragHandleLabel: t.crmLeadStages.dragHandle,
                }
              : undefined
          }
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmLeadStages.loadFailed,
            emptyTitle: t.crmLeadStages.empty,
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
            "closed" keys in one parent is a duplicate-key warning, and React
            is entitled to treat the pair as one child. */}
        <CreateLeadStagesModal
          key={isCreateOpen ? "create-open" : "create-closed"}
          isOpen={canManage && isCreateOpen}
          isSubmitting={isCreating}
          error={createError}
          onClose={closeCreate}
          onSubmit={handleCreate}
        />

        <EditLeadStageModal
          key={`edit-${selectedForEdit?.id ?? "closed"}`}
          stage={canManage ? selectedForEdit : null}
          isSubmitting={isUpdating}
          error={editError}
          onClose={closeEdit}
          onSubmit={handleUpdate}
        />

        <DeleteLeadStagesConfirmModal
          isOpen={canManage && selectedForDelete !== null}
          isSubmitting={isDeleting}
          item={selectedForDelete}
          error={deleteError}
          onClose={closeDelete}
          onConfirm={() => void handleDelete()}
        />
      </div>
    </PermissionGate>
  );
}
