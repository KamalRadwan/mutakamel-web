"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RefreshCw, Trash2, Megaphone } from "lucide-react";
import type { AcquisitionSource } from "./acquisition-source-contract";
import { useAcquisitionSources } from "./hooks/useAcquisitionSources";
import { CreateAcquisitionSourcesModal } from "./components/CreateAcquisitionSourcesModal";
import { DeleteAcquisitionSourcesConfirmModal } from "./components/DeleteAcquisitionSourcesConfirmModal";

export default function AcquisitionSourcesPage() {
  const {
    t,
    lang,
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
  const copy =
    lang === "ar"
      ? {
          subtitle: "إدارة قائمة مصادر الاستقطاب الثنائية اللغة المعتمدة من CRM.",
          add: "إضافة مصدر",
          reload: "إعادة التحميل",
          search: "ابحث بالاسم العربي أو الإنجليزي...",
          source: "المصدر",
          order: "الترتيب",
          status: "الحالة",
          actions: "الإجراءات",
          active: "نشط",
          inactive: "غير نشط",
          loading: "جارٍ تحميل مصادر الاستقطاب...",
          empty: "لا توجد مصادر استقطاب مطابقة.",
          delete: "حذف",
        }
      : {
          subtitle: "Manage the bilingual acquisition-source catalogue owned by CRM.",
          add: "Add source",
          reload: "Reload",
          search: "Search Arabic or English names...",
          source: "Source",
          order: "Order",
          status: "Status",
          actions: "Actions",
          active: "Active",
          inactive: "Inactive",
          loading: "Loading acquisition sources...",
          empty: "No matching acquisition sources.",
          delete: "Delete",
        };

  const columns = [
    {
      header: copy.source,
      cell: (item: AcquisitionSource) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Megaphone className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">
              {lang === "ar" ? item.nameAr : item.nameEn}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === "ar" ? item.nameEn : item.nameAr}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: copy.order,
      cell: (item: AcquisitionSource) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {item.sortOrder}
        </span>
      ),
    },
    {
      header: copy.status,
      cell: (item: AcquisitionSource) => (
        <Badge variant={item.isActive ? "success" : "neutral"}>
          {item.isActive ? copy.active : copy.inactive}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            header: copy.actions,
            cell: (item: AcquisitionSource) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => selectForDelete(item)}
                disabled={isDeleting}
                aria-label={`${copy.delete}: ${lang === "ar" ? item.nameAr : item.nameEn}`}
              >
                <Trash2
                  className="w-4 h-4 text-red-500"
                  aria-hidden="true"
                />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.acquisitionSourcesAndMarket}
        subtitle={copy.subtitle}
        actionLabel={canManage ? copy.add : undefined}
        onAction={canManage ? openCreate : undefined}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={() => void reload()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {copy.reload}
        </Button>
      </PageHeader>

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={copy.search}
      />

      {queryError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {queryError}
        </div>
      )}

      {mutationError && !selectedForDelete && !isCreateOpen ? (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {mutationError}
        </p>
      ) : null}

      {isLoading && !hasLoadedItems ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          {copy.loading}
        </div>
      ) : (
        <Table columns={columns} data={items} emptyText={copy.empty} />
      )}

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
