"use client";

import { Megaphone, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  NAV_SECTIONS,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "./acquisition-source-contract";
import { CreateAcquisitionSourcesModal } from "./components/CreateAcquisitionSourcesModal";
import { DeleteAcquisitionSourcesConfirmModal } from "./components/DeleteAcquisitionSourcesConfirmModal";
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
  } = useAcquisitionSources();

  const columns: ColumnDef<AcquisitionSource>[] = [
    {
      id: "source",
      header: t.crmAcquisitionSources.source,
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
            <Megaphone className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium text-foreground">{lang === "ar" ? item.nameAr : item.nameEn}</p>
            <p className="text-2xs text-muted-foreground">{lang === "ar" ? item.nameEn : item.nameAr}</p>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectForDelete(item)}
                    disabled={isDeleting}
                    aria-label={`${t.common.delete}: ${lang === "ar" ? item.nameAr : item.nameEn}`}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.common.delete}</TooltipContent>
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  return (
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

      {queryError && (
        <div role="alert" className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
          {queryError}
        </div>
      )}

      {mutationError && !selectedForDelete && !isCreateOpen ? (
        <p role="alert" className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
          {mutationError}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading && !hasLoadedItems}
        error={null}
        page={{ page: 1, limit: Math.max(items.length, 1), total: items.length }}
        onPageChange={() => undefined}
        rowKey={(item) => item.id}
        labels={{
          retry: t.common.retry,
          errorTitle: "",
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

      <CreateAcquisitionSourcesModal
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        onClose={closeCreate}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        error={mutationError}
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
  );
}
