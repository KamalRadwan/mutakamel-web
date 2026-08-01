"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, SlidersHorizontal, GitBranch, Layers } from "lucide-react";
import { useTradeConfigurationScope, ConfigScopeItem } from "./hooks/useTradeConfigurationScope";
import { CreateTradeConfigurationScopeModal } from "./components/CreateTradeConfigurationScopeModal";
import { DeleteTradeConfigurationScopeConfirmModal } from "./components/DeleteTradeConfigurationScopeConfirmModal";

export default function TradeConfigurationScopePage() {
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
  } = useTradeConfigurationScope();

  const columns = [
    {
      header: "اسم النطاق والكود",
      cell: (item: ConfigScopeItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.scopeName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.targetCode}</p>
          </div>
        </div>
      ),
    },
    {
      header: "المستوى (Level)",
      cell: (item: ConfigScopeItem) => (
        <Badge variant="info">{item.scopeLevel.toUpperCase()}</Badge>
      ),
    },
    {
      header: "الميزات المفعلة",
      cell: (item: ConfigScopeItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.activeFeaturesCount} ميزة</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: ConfigScopeItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مباشر وخاص" : "مورث من المركز"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ConfigScopeItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/configuration-scope/${item.id}/general`}>
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
        title="نطاقات وقواعد التهيئة (Trade Configuration Scope)"
        subtitle="عزل وتخصيص سياسات التسعير، الضرائب، وإعدادات المشتريات بحسب المستودع والفرع"
        actionLabel="إضافة نطاق تهيئة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم النطاق أو الكود المستهدف..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeConfigurationScopeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeConfigurationScopeConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
