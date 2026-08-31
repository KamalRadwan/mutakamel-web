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
import { formatTemplate } from "@/lib/format/template";
import { CreateLeadStagesModal } from "./components/CreateLeadStagesModal";
import { DeleteLeadStagesConfirmModal } from "./components/DeleteLeadStagesConfirmModal";
import { EditLeadStageDrawer } from "./components/EditLeadStageDrawer";
import { useLeadStages, type LeadStageItem } from "./hooks/useLeadStages";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function LeadStagesPage() {
  const {
    t,
    items,
    isLoading,
    isDeleting,
    settingDefaultId,
    error,
    loadError,
    canManage,
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
  } = useLeadStages();

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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(item)}
                      disabled={isUpdating}
                      aria-label={`${t.crmLeadStages.editTitle}: ${item.nameEn}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.crmLeadStages.editTitle}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleSetDefault(item)}
                      disabled={!item.isActive || item.isDefault || item.flag === "CONVERTED" || settingDefaultId !== null}
                      loading={settingDefaultId === item.id}
                      aria-label={`${t.crmLeadStages.setDefault}: ${item.nameEn}`}
                    >
                      <Star className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.crmLeadStages.setDefault}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDelete(item)}
                      disabled={item.flag === "NEW" || item.isDefault || isDeleting}
                      aria-label={`${t.common.delete}: ${item.nameEn}`}
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
    <PermissionGate require="crm.lead_stages.read">
      <div className="flex flex-col gap-4">
        <PageHeader
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

        <CreateLeadStagesModal
          key={isCreateOpen ? "open" : "closed"}
          isOpen={isCreateOpen}
          isSubmitting={isCreating}
          error={createError}
          onClose={closeCreate}
          onSubmit={handleCreate}
        />

        <EditLeadStageDrawer
          key={selectedForEdit?.id ?? "closed"}
          stage={selectedForEdit}
          isSubmitting={isUpdating}
          error={editError}
          onClose={closeEdit}
          onSubmit={handleUpdate}
        />

        <DeleteLeadStagesConfirmModal
          isOpen={selectedForDelete !== null}
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
