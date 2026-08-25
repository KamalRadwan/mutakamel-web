"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FileText } from "lucide-react";
import { useBusinessLetters, BusinessLetterItem } from "./hooks/useBusinessLetters";
import { CreateBusinessLettersModal } from "./components/CreateBusinessLettersModal";
import { DeleteBusinessLettersConfirmModal } from "./components/DeleteBusinessLettersConfirmModal";

export default function BusinessLettersPage() {
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
  } = useBusinessLetters();

  const columns = [
    {
      header: "رقم وموضوع الخطاب",
      cell: (item: BusinessLetterItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.subject}</p>
            <p className="text-[11px] text-slate-400">{item.letterNumber} · {item.templateType}</p>
          </div>
        </div>
      ),
    },
    { header: "الجهة الموجه إليها", accessorKey: "recipient" as keyof BusinessLetterItem },
    { header: "تاريخ الإنشاء", accessorKey: "createdAt" as keyof BusinessLetterItem },
    {
      header: "الحالة",
      cell: (item: BusinessLetterItem) => (
        <Badge variant={item.status === "issued" ? "success" : item.status === "draft" ? "warning" : "neutral"}>
          {item.status === "issued" ? "صادر برقم رسمي" : item.status === "draft" ? "مسودة" : "مؤرشف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: BusinessLetterItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/business-letters/${item.id}/general`}>
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
        title="منصة الخطابات والوثائق الرسمية (Business Letters)"
        subtitle="إنشاء، صياغة، وطباعة الخطابات والشهادات المعتمدة بختم وترقيمة المستأجر"
        actionLabel="إنشاء خطاب جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بموضوع الخطاب أو رقم الصدور أو الجهة..."
      />

      <Table columns={columns} data={items} />

      <CreateBusinessLettersModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteBusinessLettersConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
