"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Download, Trash2, Eye, FileCode } from "lucide-react";
import { useCoreSignedFileDownloads, SignedFileItem } from "./hooks/useCoreSignedFileDownloads";
import { CreateCoreSignedFileDownloadsModal } from "./components/CreateCoreSignedFileDownloadsModal";
import { DeleteCoreSignedFileDownloadsConfirmModal } from "./components/DeleteCoreSignedFileDownloadsConfirmModal";

export default function CoreSignedFileDownloadsPage() {
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedFileForDelete,
    setSelectedFileForDelete,
    handleCreate,
    handleDelete,
  } = useCoreSignedFileDownloads();

  const columns = [
    {
      header: "اسم الملف",
      cell: (item: SignedFileItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.filename}</p>
            <p className="text-[11px] text-slate-400">{item.contentType} · {item.sizeKb} KB</p>
          </div>
        </div>
      ),
    },
    { header: "Bucket", accessorKey: "bucket" as keyof SignedFileItem },
    {
      header: "تاريخ الانتهاء",
      accessorKey: "expiresAt" as keyof SignedFileItem,
    },
    {
      header: "الحالة",
      cell: (item: SignedFileItem) => (
        <Badge variant={item.status === "active" ? "success" : "danger"}>
          {item.status === "active" ? "نشط" : "منتهي الصلاحية"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: SignedFileItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/core-signed-file-downloads/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setSelectedFileForDelete(item)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="روابط تحميل الملفات الموقعة (Signed File Downloads)"
        subtitle="توليد وإدارة روابط التنزيل الموقعة الخاصة بالمستأجر للوصول الآمن المؤقت للمستندات"
        actionLabel="توليد رابط موقع جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الملف أو الـ Bucket..."
      />

      <Table columns={columns} data={items} />

      <CreateCoreSignedFileDownloadsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCoreSignedFileDownloadsConfirmModal
        isOpen={!!selectedFileForDelete}
        item={selectedFileForDelete}
        onClose={() => setSelectedFileForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
