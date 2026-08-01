"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Code2, Server, CheckCircle2 } from "lucide-react";
import { useCrmApiDocs, ApiDocItem } from "./hooks/useCrmApiDocs";
import { CreateCrmApiDocsModal } from "./components/CreateCrmApiDocsModal";
import { DeleteCrmApiDocsConfirmModal } from "./components/DeleteCrmApiDocsConfirmModal";

export default function CrmApiDocsPage() {
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
  } = useCrmApiDocs();

  const columns = [
    {
      header: "عنوان API",
      cell: (item: ApiDocItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.methodPath}</p>
          </div>
        </div>
      ),
    },
    {
      header: "التطبيق الخلفي (App)",
      cell: (item: ApiDocItem) => (
        <Badge variant="neutral">{item.owningBackendApp}</Badge>
      ),
    },
    {
      header: "فئة DTO Validation",
      cell: (item: ApiDocItem) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{item.dtoValidation}</span>
      ),
    },
    {
      header: "تاريخ المطابقة",
      cell: (item: ApiDocItem) => (
        <span className="text-xs text-slate-500">{item.verificationDate}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: ApiDocItem) => (
        <Badge variant={item.status === "verified" ? "success" : "warning"}>
          {item.status === "verified" ? "مطابق للمواصفات" : "مسودة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ApiDocItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/api-documentation/${item.id}/general`}>
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
        title="توثيق واجهات CRM (CRM API Documentation)"
        subtitle="سجل وثائق عقد الواجهات البرمجية والتأكد من مطابقة الـ DTO لخدمات موديول إدارة العملاء"
        actionLabel="إضافة توثيق API"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالعنوان، المسار، أو اسم الـ DTO..."
      />

      <Table columns={columns} data={items} />

      <CreateCrmApiDocsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmApiDocsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
