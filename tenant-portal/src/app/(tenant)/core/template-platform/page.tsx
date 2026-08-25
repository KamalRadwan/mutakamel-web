"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, LayoutTemplate } from "lucide-react";
import { useTemplatePlatform, TemplateItem } from "./hooks/useTemplatePlatform";
import { CreateTemplatePlatformModal } from "./components/CreateTemplatePlatformModal";
import { DeleteTemplatePlatformConfirmModal } from "./components/DeleteTemplatePlatformConfirmModal";

export default function TemplatePlatformPage() {
  const {
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  } = useTemplatePlatform();

  const columns = [
    {
      header: "اسم القالب",
      cell: (item: TemplateItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.version} · تحديث: {item.updatedAt}</p>
          </div>
        </div>
      ),
    },
    {
      header: "التصنيف",
      cell: (item: TemplateItem) => (
        <Badge variant={item.category === "pdf" ? "info" : item.category === "email" ? "warning" : "neutral"}>
          {item.category.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: TemplateItem) => (
        <Badge variant={item.status === "published" ? "success" : item.status === "draft" ? "warning" : "neutral"}>
          {item.status === "published" ? "منشور" : item.status === "draft" ? "مسودة" : "مؤرشف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: TemplateItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/template-platform/${item.id}/general`}>
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
        title="منصة ومحرك القوالب (Template Platform)"
        subtitle="تصميم وصياغة واستعراض قوالب الـ PDF، رسائل البريد، والواجهات للمستأجر"
        actionLabel="إنشاء قالب جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم القالب أو النوع..."
      />

      <Table columns={columns} data={items} />

      <CreateTemplatePlatformModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTemplatePlatformConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
