"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, LayoutGrid, Plus, Layers } from "lucide-react";
import { useTradeDashboardBuilder, TradeDashboardItem } from "./hooks/useTradeDashboardBuilder";
import { CreateTradeDashboardBuilderModal } from "./components/CreateTradeDashboardBuilderModal";
import { DeleteTradeDashboardBuilderConfirmModal } from "./components/DeleteTradeDashboardBuilderConfirmModal";

export default function TradeDashboardBuilderPage() {
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
  } = useTradeDashboardBuilder();

  const columns = [
    {
      header: "اسم اللوحة التجاري",
      cell: (item: TradeDashboardItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: "تنسيق الشبكة",
      cell: (item: TradeDashboardItem) => (
        <Badge variant="info">{item.layoutGrid}</Badge>
      ),
    },
    {
      header: "عدد الويدجتس",
      cell: (item: TradeDashboardItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.widgetsCount} عنصر</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: TradeDashboardItem) => (
        <Badge variant={item.status === "published" ? "success" : "neutral"}>
          {item.status === "published" ? "منشورة ومفعلة" : "مسودة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: TradeDashboardItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/dashboard-builder/${item.id}/general`}>
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
        title="مُنشئ لوحات مؤشرات التجارة (Trade Dashboard Builder)"
        subtitle="تصميم وتخصيص شاشات متابعة المبيعات والمخزون وسلاسل الإمداد سحباً وإسقاطاً"
        actionLabel="إنشاء لوحة مؤشرات"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم اللوحة أو الكود..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeDashboardBuilderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeDashboardBuilderConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
