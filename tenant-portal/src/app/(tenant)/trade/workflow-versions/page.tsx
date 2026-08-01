"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, GitBranch, CheckCircle2, Layers } from "lucide-react";
import { useTradeWorkflowVersions, WorkflowVersionItem } from "./hooks/useTradeWorkflowVersions";
import { CreateTradeWorkflowVersionsModal } from "./components/CreateTradeWorkflowVersionsModal";
import { DeleteTradeWorkflowVersionsConfirmModal } from "./components/DeleteTradeWorkflowVersionsConfirmModal";

export default function TradeWorkflowVersionsPage() {
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
  } = useTradeWorkflowVersions();

  const columns = [
    {
      header: "اسم سير العمل والإصدار",
      cell: (item: WorkflowVersionItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.workflowName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.versionNumber} · {item.targetDocumentType}</p>
          </div>
        </div>
      ),
    },
    {
      header: "عدد الخطوات الإجبارية",
      cell: (item: WorkflowVersionItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.stepsCount} مراحل</span>
      ),
    },
    { header: "تاريخ النشر", accessorKey: "publishedAt" as keyof WorkflowVersionItem },
    {
      header: "الحالة",
      cell: (item: WorkflowVersionItem) => (
        <Badge variant={item.isActiveVersion ? "success" : "neutral"}>
          {item.isActiveVersion ? "الإصدار النشط حالياً" : "إصدار سابق"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: WorkflowVersionItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/workflow-versions/${item.id}/general`}>
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
        title="إصدارات وسلاسل مسارات العمل (Trade Workflow Versions)"
        subtitle="إدارة وتتبع تدرج إصدارات مسارات اعتماد المبيعات والمشتريات وتوثيق السجل التاريخي"
        actionLabel="نشر إصدار مسار جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم مسار العمل أو الإصدار..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeWorkflowVersionsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeWorkflowVersionsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
