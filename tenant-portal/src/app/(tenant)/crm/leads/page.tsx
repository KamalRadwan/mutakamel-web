"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, UserPlus, Flame, Target } from "lucide-react";
import { useLeads, LeadItem } from "./hooks/useLeads";
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";

export default function LeadsPage() {
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
  } = useLeads();

  const columns = [
    {
      header: "العميل المحتمل والشركة",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.leadName}</p>
            <p className="text-[11px] text-slate-400">{item.company} · {item.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: "المرحلة الحالية",
      cell: (item: LeadItem) => (
        <Badge variant="info">{item.stage}</Badge>
      ),
    },
    {
      header: "درجة التأهيل (Score)",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-1 font-bold text-xs text-amber-600">
          <Flame className="w-3.5 h-3.5" />
          <span>{item.score}/100</span>
        </div>
      ),
    },
    { header: "المصدر", accessorKey: "source" as keyof LeadItem },
    { header: "المسؤول", accessorKey: "assignedTo" as keyof LeadItem },
    {
      header: "الإجراءات",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/leads/${item.id}/general`}>
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
        title="إدارة العملاء المحتملين (Leads Management)"
        subtitle="متابعة طلبات الاهتمام، حساب نقاط التأهيل الآلي، وتعيين مسؤول المبيعات المباشر"
        actionLabel="إضافة عميل محتمل"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم العميل المحتمل، الشركة، أو البريد..."
      />

      <Table columns={columns} data={items} />

      <CreateLeadsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteLeadsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
