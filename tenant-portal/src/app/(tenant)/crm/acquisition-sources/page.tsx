"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, TrendingUp, Share2, Megaphone } from "lucide-react";
import { useAcquisitionSources, AcquisitionSourceItem } from "./hooks/useAcquisitionSources";
import { CreateAcquisitionSourcesModal } from "./components/CreateAcquisitionSourcesModal";
import { DeleteAcquisitionSourcesConfirmModal } from "./components/DeleteAcquisitionSourcesConfirmModal";

export default function AcquisitionSourcesPage() {
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
  } = useAcquisitionSources();

  const columns = [
    {
      header: "مصدر الاستقطاب",
      cell: (item: AcquisitionSourceItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">نوع القناة: {item.channelType}</p>
          </div>
        </div>
      ),
    },
    {
      header: "عدد العملاء المستجلبين",
      cell: (item: AcquisitionSourceItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.totalLeadsCount} عميل</span>
      ),
    },
    {
      header: "معدل التحويل (Conversion Rate)",
      cell: (item: AcquisitionSourceItem) => (
        <Badge variant="success">{item.conversionRate}</Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: AcquisitionSourceItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشط" : "موقف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: AcquisitionSourceItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/acquisition-sources/${item.id}/general`}>
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
        title="مصادر الاستقطاب والقنوات التسويقية (Acquisition Sources)"
        subtitle="تتبع وتحليل كفاءة مصادر جلب العملاء المحتملين ومعدلات التحويل المباشرة"
        actionLabel="إضافة مصدر جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المصدر أو القناة..."
      />

      <Table columns={columns} data={items} />

      <CreateAcquisitionSourcesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteAcquisitionSourcesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
