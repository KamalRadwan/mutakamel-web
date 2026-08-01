"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FormInput, Layers, Hash } from "lucide-react";
import { useCrmCustomFields, CustomFieldItem } from "./hooks/useCrmCustomFields";
import { CreateCrmCustomFieldsModal } from "./components/CreateCrmCustomFieldsModal";
import { DeleteCrmCustomFieldsConfirmModal } from "./components/DeleteCrmCustomFieldsConfirmModal";

export default function CrmCustomFieldsPage() {
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  } = useCrmCustomFields();

  const columns = [
    {
      header: "عنوان الحقل",
      cell: (item: CustomFieldItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
            <FormInput className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.key}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الكيان المستهدف",
      cell: (item: CustomFieldItem) => (
        <Badge variant="info">{item.targetEntity.toUpperCase()}</Badge>
      ),
    },
    {
      header: "نوع الحقل",
      cell: (item: CustomFieldItem) => (
        <Badge variant="neutral">{item.fieldType}</Badge>
      ),
    },
    {
      header: "إجباري؟",
      cell: (item: CustomFieldItem) => (
        <Badge variant={item.isRequired ? "danger" : "neutral"}>
          {item.isRequired ? "نعم (إجباري)" : "اختياري"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: CustomFieldItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/custom-fields/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الحقول المخصصة لنموذج الـ CRM (Custom Fields Builder)"
        subtitle="توسيع واستحداث حقول ديناميكية للعملاء المحتملين والصفقات والشركات"
        actionLabel="إضافة حقل مخصص"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالعنوان، المفتاح البرمجي، أو الكيان..."
      />

      <Table columns={columns} data={items} />

      <CreateCrmCustomFieldsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmCustomFieldsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
