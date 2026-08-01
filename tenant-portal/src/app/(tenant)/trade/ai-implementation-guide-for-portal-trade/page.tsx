"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Bot, Sparkles, Cpu } from "lucide-react";
import { useTradeAiGuide, TradeAiGuideItem } from "./hooks/useTradeAiGuide";
import { CreateTradeAiGuideModal } from "./components/CreateTradeAiGuideModal";
import { DeleteTradeAiGuideConfirmModal } from "./components/DeleteTradeAiGuideConfirmModal";

export default function TradeAiGuidePage() {
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
  } = useTradeAiGuide();

  const columns = [
    {
      header: "عنوان الدليل والنمط",
      cell: (item: TradeAiGuideItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.guideTitle}</p>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs">{item.aiPromptPattern}</p>
          </div>
        </div>
      ),
    },
    {
      header: "المكون المستهدف",
      cell: (item: TradeAiGuideItem) => (
        <Badge variant="neutral">{item.moduleTarget}</Badge>
      ),
    },
    {
      header: "النموذج الموصى به",
      cell: (item: TradeAiGuideItem) => (
        <Badge variant="info">{item.recommendedModel}</Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: TradeAiGuideItem) => (
        <Badge variant="success">معتمد ومفعل</Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: TradeAiGuideItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/ai-implementation-guide-for-portal-trade/${item.id}/general`}>
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
        title="دليل تطبيق الذكاء الاصطناعي لموديول التجارة (AI Guide for Trade)"
        subtitle="أنماط وقواعد الدمج والذكاء الاصطناعي للتسعير الديناميكي والتنبؤ بمخزون المستأجر"
        actionLabel="إضافة دليل جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالعنوان أو الـ Prompt Pattern..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeAiGuideModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeAiGuideConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
