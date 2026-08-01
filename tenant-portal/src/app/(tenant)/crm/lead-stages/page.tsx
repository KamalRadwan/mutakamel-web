"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, GitCommit, ArrowRightLeft } from "lucide-react";
import { useLeadStages, LeadStageItem } from "./hooks/useLeadStages";
import { CreateLeadStagesModal } from "./components/CreateLeadStagesModal";
import { DeleteLeadStagesConfirmModal } from "./components/DeleteLeadStagesConfirmModal";

export default function LeadStagesPage() {
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
  } = useLeadStages();

  const columns = [
    {
      header: "اسم المرحلة",
      cell: (item: LeadStageItem) => (
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: item.color }} />
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">الترتيب: #{item.order}</p>
          </div>
        </div>
      ),
    },
    {
      header: "احتمالية النجاح",
      cell: (item: LeadStageItem) => (
        <Badge variant="info">{item.winProbability}</Badge>
      ),
    },
    {
      header: "عدد العملاء المترابطين",
      cell: (item: LeadStageItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.leadsCount} عميل</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: LeadStageItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشطة" : "مؤرشفة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: LeadStageItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/lead-stages/${item.id}/general`}>
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
        title="مراحل قمع المبيعات (Lead Stages & Pipeline Builder)"
        subtitle="تهيئة وتسلسل مراحل تقدم العملاء المحتملين من الاستقطاب وحتى الإغلاق"
        actionLabel="إضافة مرحلة جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المرحلة..."
      />

      <Table columns={columns} data={items} />

      <CreateLeadStagesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteLeadStagesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
