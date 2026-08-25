"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Scale } from "lucide-react";
import { useTradePolicyStudio, PolicyRuleItem } from "./hooks/useTradePolicyStudio";
import { CreateTradePolicyStudioModal } from "./components/CreateTradePolicyStudioModal";
import { DeleteTradePolicyStudioConfirmModal } from "./components/DeleteTradePolicyStudioConfirmModal";

export default function TradePolicyStudioPage() {
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
  } = useTradePolicyStudio();

  const columns = [
    {
      header: "اسم السياسة والتعبير الشرطي",
      cell: (item: PolicyRuleItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.policyName}</p>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs">{item.conditionExpression}</p>
          </div>
        </div>
      ),
    },
    {
      header: "نوع السياسة",
      cell: (item: PolicyRuleItem) => (
        <Badge variant="info">{item.policyType.toUpperCase()}</Badge>
      ),
    },
    {
      header: "الأولوية",
      cell: (item: PolicyRuleItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">#{item.priorityOrder}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: PolicyRuleItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مفعل ومطبق" : "مسودة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PolicyRuleItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/policy-studio/${item.id}/general`}>
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
        title="ستوديو محرك السياسات وقواعد الأعمال (Trade Policy Studio)"
        subtitle="بناء قواعد التسعير الديناميكي، مسارات الموافقات، والتحقق الآلي من شروط البيع والشراء"
        actionLabel="إنشاء سياسة جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم السياسة أو الشرط البرمجي..."
      />

      <Table columns={columns} data={items} />

      <CreateTradePolicyStudioModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradePolicyStudioConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
