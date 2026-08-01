"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Kanban, Layers, GitMerge } from "lucide-react";
import { usePipelinesBoards, PipelineBoardItem } from "./hooks/usePipelinesBoards";
import { CreatePipelinesBoardsModal } from "./components/CreatePipelinesBoardsModal";
import { DeletePipelinesBoardsConfirmModal } from "./components/DeletePipelinesBoardsConfirmModal";

export default function PipelinesBoardsPage() {
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
  } = usePipelinesBoards();

  const columns = [
    {
      header: "اسم المسار / البورد",
      cell: (item: PipelineBoardItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Kanban className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: "عدد المراحل",
      cell: (item: PipelineBoardItem) => (
        <Badge variant="info">{item.stagesCount} مراحل</Badge>
      ),
    },
    {
      header: "إجمالي قيمة الصفقات",
      cell: (item: PipelineBoardItem) => (
        <span className="font-bold text-emerald-600">{item.totalDealsValue}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: PipelineBoardItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشط ومستعمل" : "مؤرشف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PipelineBoardItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/pipelines-boards-opportunity-stages/${item.id}/general`}>
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
        title="لوحات ومسارات المبيعات (Pipelines & Kanban Boards)"
        subtitle="بناء مسارات تفاعلية بنمط كانبان، وتوزيع الصفقات على مراحل الفرص المحددة"
        actionLabel="إنشاء مسار مبيعات جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المسار أو الكود..."
      />

      <Table columns={columns} data={items} />

      <CreatePipelinesBoardsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeletePipelinesBoardsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
