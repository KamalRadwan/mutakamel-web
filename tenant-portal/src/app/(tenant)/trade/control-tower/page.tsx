"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Activity, Radar, ShieldAlert } from "lucide-react";
import { useTradeControlTower, ControlTowerItem } from "./hooks/useTradeControlTower";
import { CreateTradeControlTowerModal } from "./components/CreateTradeControlTowerModal";
import { DeleteTradeControlTowerConfirmModal } from "./components/DeleteTradeControlTowerConfirmModal";

export default function TradeControlTowerPage() {
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
  } = useTradeControlTower();

  const columns = [
    {
      header: "المؤشر القيادي (Metric Name)",
      cell: (item: ControlTowerItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
            <Radar className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.metricName}</p>
            <p className="text-[11px] text-slate-400">الفئة: {item.category.toUpperCase()}</p>
          </div>
        </div>
      ),
    },
    {
      header: "القيمة الحالية",
      cell: (item: ControlTowerItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.currentValue}</span>
      ),
    },
    {
      header: "الحد الموصى به",
      cell: (item: ControlTowerItem) => (
        <span className="font-mono text-xs text-slate-500">{item.targetThreshold}</span>
      ),
    },
    {
      header: "حالة التنبيه",
      cell: (item: ControlTowerItem) => (
        <Badge variant={item.alertStatus === "normal" ? "success" : item.alertStatus === "warning" ? "warning" : "danger"}>
          {item.alertStatus === "normal" ? "مستقر" : item.alertStatus === "warning" ? "تنبيه مبكر" : "حرج جداً"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ControlTowerItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/control-tower/${item.id}/general`}>
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
        title="برج مراقبة العمليات والتجارة (Trade Control Tower)"
        subtitle="شاشة المراقبة المركزية والتحذيرات المبكرة لسلسلة الإمداد ومخاطر الائتمان وسرعة البيع"
        actionLabel="إضافة مؤشر برج المراقبة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المؤشر أو الفئة..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeControlTowerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeControlTowerConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
