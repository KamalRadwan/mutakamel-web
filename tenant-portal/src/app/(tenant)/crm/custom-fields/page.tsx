"use client";

import { FormInput, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { CreateCrmCustomFieldsModal } from "./components/CreateCrmCustomFieldsModal";
import {
  type CustomFieldItem,
  useCrmCustomFields,
} from "./hooks/useCrmCustomFields";

export default function CrmCustomFieldsPage() {
  const {
    t,
    lang,
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    error,
    createError,
    canManage,
    isCreateOpen,
    openCreate,
    closeCreate,
    handleCreate,
    reload,
  } = useCrmCustomFields();

  const copy =
    lang === "ar"
      ? {
          subtitle:
            "تعريفات الحقول المخصصة الحالية من CRM. الإنشاء هنا يقتصر على الأنواع التي لا تحتاج قائمة خيارات.",
          reload: "إعادة التحميل",
          search: "ابحث بالاسم أو المفتاح أو نوع السجل...",
          arabicName: "الاسم بالعربية",
          englishName: "الاسم بالإنجليزية",
          owner: "نوع السجل",
          fieldType: "نوع الحقل",
          properties: "الخصائص",
          searchable: "قابل للبحث",
          options: "خيارات",
          active: "نشط",
          inactive: "غير نشط",
          loading: "جارٍ تحميل تعريفات الحقول المخصصة...",
          empty: "لا توجد تعريفات مطابقة.",
        }
      : {
          subtitle:
            "Current CRM custom-field definitions. Creation is limited to field types that do not require option configuration.",
          reload: "Reload",
          search: "Search by name, key, or record type...",
          arabicName: "Arabic name",
          englishName: "English name",
          owner: "Record type",
          fieldType: "Field type",
          properties: "Properties",
          searchable: "Searchable",
          options: "options",
          active: "Active",
          inactive: "Inactive",
          loading: "Loading custom-field definitions...",
          empty: "No matching definitions.",
        };

  const columns = [
    {
      header: copy.arabicName,
      cell: (item: CustomFieldItem) => (
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
            <FormInput className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p
              className="font-bold text-slate-900 dark:text-slate-100"
              dir="rtl"
            >
              {item.nameAr}
            </p>
            <code className="text-[11px] text-slate-500 dark:text-slate-400">
              {item.fieldKey}
            </code>
          </div>
        </div>
      ),
    },
    {
      header: copy.englishName,
      cell: (item: CustomFieldItem) => <span dir="ltr">{item.nameEn}</span>,
    },
    {
      header: copy.owner,
      cell: (item: CustomFieldItem) => (
        <Badge variant="info">{item.ownerType.replaceAll("_", " ")}</Badge>
      ),
    },
    {
      header: copy.fieldType,
      cell: (item: CustomFieldItem) => (
        <Badge variant="neutral">{item.type.replaceAll("_", " ")}</Badge>
      ),
    },
    {
      header: copy.properties,
      cell: (item: CustomFieldItem) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={item.isActive ? "success" : "neutral"}>
            {item.isActive ? copy.active : copy.inactive}
          </Badge>
          {item.isSearchable && (
            <Badge variant="warning">{copy.searchable}</Badge>
          )}
          {item.optionsCount > 0 && (
            <Badge variant="neutral">
              {item.optionsCount} {copy.options}
            </Badge>
          )}
        </div>
      ),
    },
  ];
  const canCreate = canManage && !isLoading && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.cRMFormCustomFieldsCustom}
        subtitle={copy.subtitle}
        actionLabel={canCreate ? t.crm.addACustomField : undefined}
        onAction={canCreate ? openCreate : undefined}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={() => void reload()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {copy.reload}
        </Button>
      </PageHeader>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {createError && !isCreateOpen ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {createError}
        </div>
      ) : null}

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={copy.search}
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

      <CreateCrmCustomFieldsModal
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        isSubmitting={isCreating}
        error={createError}
        onClose={closeCreate}
        onSubmit={handleCreate}
      />
    </div>
  );
}
