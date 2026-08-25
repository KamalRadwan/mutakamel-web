"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Puzzle } from "lucide-react";
import { useTradeExtensionProfiles, ExtensionProfileItem } from "./hooks/useTradeExtensionProfiles";
import { CreateTradeExtensionProfilesModal } from "./components/CreateTradeExtensionProfilesModal";
import { DeleteTradeExtensionProfilesConfirmModal } from "./components/DeleteTradeExtensionProfilesConfirmModal";

export default function TradeExtensionProfilesPage() {
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
  } = useTradeExtensionProfiles();

  const columns = [
    {
      header: "اسم الملحق والـ Plugin ID",
      cell: (item: ExtensionProfileItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
            <Puzzle className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.extensionName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.pluginId}</p>
          </div>
        </div>
      ),
    },
    {
      header: "المكون المستهدف",
      cell: (item: ExtensionProfileItem) => (
        <Badge variant="neutral">{item.moduleTarget}</Badge>
      ),
    },
    {
      header: "الإصدار",
      cell: (item: ExtensionProfileItem) => (
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{item.version}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: ExtensionProfileItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مفعل ومربوط" : "موقف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ExtensionProfileItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/extension-profiles/${item.id}/general`}>
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
        title="بروفايلات الملحقات والتطبيقات (Trade Extension Profiles)"
        subtitle="توسيع موديول التجارة بمحركات الحسابات الخارجية وحقن خطوات العمل الربط باللوجستيات"
        actionLabel="إضافة ملحق توسعي"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الملحق أو Plugin ID..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeExtensionProfilesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeExtensionProfilesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
