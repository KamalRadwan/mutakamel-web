"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Component } from "lucide-react";
import { useTradeDashboardWidgets, TradeWidgetCatalogItem } from "./hooks/useTradeDashboardWidgets";
import { CreateTradeDashboardWidgetsModal } from "./components/CreateTradeDashboardWidgetsModal";
import { DeleteTradeDashboardWidgetsConfirmModal } from "./components/DeleteTradeDashboardWidgetsConfirmModal";

export default function TradeDashboardWidgetsPage() {
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
  } = useTradeDashboardWidgets();

  const columns = [
    {
      header: "اسم الويدجت والرابط",
      cell: (item: TradeWidgetCatalogItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Component className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.widgetName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.dataSourceApi}</p>
          </div>
        </div>
      ),
    },
    {
      header: "نوع العرض",
      cell: (item: TradeWidgetCatalogItem) => (
        <Badge variant="info">{item.widgetType.toUpperCase()}</Badge>
      ),
    },
    {
      header: "الأبعاد",
      cell: (item: TradeWidgetCatalogItem) => (
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{item.size}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: TradeWidgetCatalogItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مفعلة ومتاحة" : "غير مفعلة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: TradeWidgetCatalogItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/dashboard-widgets/${item.id}/general`}>
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
        title="كتالوج ودجت ومكونات التجارة (Trade Dashboard Widgets)"
        subtitle="مكتبة المكونات والرسوم البيانية التفاعلية الجاهزة للإضافة إلى لوحات التحليل التجاري"
        actionLabel="إضافة ويدجت جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الويدجت، النوع، أو API المصدر..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeDashboardWidgetsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeDashboardWidgetsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
