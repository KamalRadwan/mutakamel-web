"use client";

import { RotateCw, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { CreateLeadStagesModal } from "./components/CreateLeadStagesModal";
import { DeleteLeadStagesConfirmModal } from "./components/DeleteLeadStagesConfirmModal";
import { useLeadStages, type LeadStageItem } from "./hooks/useLeadStages";

export default function LeadStagesPage() {
  const {
    t,
    lang,
    items,
    isLoading,
    isCreating,
    isDeleting,
    settingDefaultId,
    error,
    createError,
    deleteError,
    canManage,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    openCreate,
    closeCreate,
    selectedForDelete,
    openDelete,
    closeDelete,
    handleCreate,
    handleDelete,
    handleSetDefault,
    fetchStages,
  } = useLeadStages();
  const copy =
    lang === "ar"
      ? {
          arabicName: "الاسم بالعربية",
          englishName: "الاسم بالإنجليزية",
          semantics: "دلالة دورة العميل",
          order: "الترتيب",
          state: "الحالة",
          actions: "الإجراءات",
          default: "افتراضية",
          setDefault: "تعيين كافتراضية",
          retry: "إعادة المحاولة",
          loading: "جارٍ تحميل مراحل العملاء...",
          empty: "لا توجد مراحل عملاء مطابقة",
          delete: "حذف المرحلة",
        }
      : {
          arabicName: "Arabic name",
          englishName: "English name",
          semantics: "Lifecycle semantics",
          order: "Order",
          state: "Status",
          actions: "Actions",
          default: "Default",
          setDefault: "Set as default",
          retry: "Retry",
          loading: "Loading lead stages...",
          empty: "No matching lead stages",
          delete: "Delete stage",
        };

  const columns = [
    {
      header: copy.arabicName,
      cell: (item: LeadStageItem) => (
        <span
          className="font-bold text-slate-900 dark:text-slate-100"
          dir="rtl"
        >
          {item.nameAr}
        </span>
      ),
    },
    {
      header: copy.englishName,
      cell: (item: LeadStageItem) => <span dir="ltr">{item.nameEn}</span>,
    },
    {
      header: copy.semantics,
      cell: (item: LeadStageItem) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="info">{item.flag.replaceAll("_", " ")}</Badge>
          <Badge variant="neutral">
            {item.category.replaceAll("_", " ")}
          </Badge>
        </div>
      ),
    },
    {
      header: copy.order,
      cell: (item: LeadStageItem) => item.sortOrder,
    },
    {
      header: copy.state,
      cell: (item: LeadStageItem) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={item.isActive ? "success" : "neutral"}>
            {item.isActive ? t.common.active : t.common.inactive}
          </Badge>
          {item.isDefault && <Badge variant="warning">{copy.default}</Badge>}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            header: copy.actions,
            cell: (item: LeadStageItem) => (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleSetDefault(item)}
                  disabled={
                    !item.isActive ||
                    item.isDefault ||
                    item.flag === "CONVERTED" ||
                    settingDefaultId !== null
                  }
                  aria-label={`${copy.setDefault}: ${item.nameEn}`}
                  title={copy.setDefault}
                >
                  <Star className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDelete(item)}
                  disabled={
                    item.flag === "NEW" || item.isDefault || isDeleting
                  }
                  aria-label={`${copy.delete}: ${item.nameEn}`}
                  title={copy.delete}
                >
                  <Trash2
                    className="size-4 text-red-500"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.salesFunnelStagesLeadStag}
        subtitle={t.crm.preparingAndSequencingTheS}
        actionLabel={canManage ? t.crm.addANewStage : undefined}
        onAction={canManage ? openCreate : undefined}
      />

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchStages()}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        </div>
      )}

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByStageName}
      />

      {isLoading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        >
          {copy.loading}
        </p>
      ) : (
        <Table columns={columns} data={items} emptyText={copy.empty} />
      )}

      <CreateLeadStagesModal
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        isSubmitting={isCreating}
        error={createError}
        onClose={closeCreate}
        onSubmit={handleCreate}
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
  );
}
