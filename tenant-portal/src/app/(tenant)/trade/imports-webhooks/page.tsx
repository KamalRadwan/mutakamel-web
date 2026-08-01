"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Webhook, UploadCloud, CheckCircle2 } from "lucide-react";
import { useTradeImportsWebhooks, ImportWebhookItem } from "./hooks/useTradeImportsWebhooks";
import { CreateTradeImportsWebhooksModal } from "./components/CreateTradeImportsWebhooksModal";
import { DeleteTradeImportsWebhooksConfirmModal } from "./components/DeleteTradeImportsWebhooksConfirmModal";

export default function TradeImportsWebhooksPage() {
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
  } = useTradeImportsWebhooks();

  const columns = [
    {
      header: "اسم العملية والهدف",
      cell: (item: ImportWebhookItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
            <Webhook className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs">{item.targetEndpointOrFile}</p>
          </div>
        </div>
      ),
    },
    {
      header: "النوع",
      cell: (item: ImportWebhookItem) => (
        <Badge variant="info">{item.type.toUpperCase()}</Badge>
      ),
    },
    {
      header: "السجلات المعالجة",
      cell: (item: ImportWebhookItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.processedRecordsCount} سجل</span>
      ),
    },
    { header: "آخر تشغيل", accessorKey: "lastTriggeredAt" as keyof ImportWebhookItem },
    {
      header: "الحالة",
      cell: (item: ImportWebhookItem) => (
        <Badge variant={item.status === "completed" || item.status === "active" ? "success" : "danger"}>
          {item.status === "completed" ? "مكتمل" : item.status === "active" ? "مفعل وجاهز" : "خطأ"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ImportWebhookItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/imports-webhooks/${item.id}/general`}>
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
        title="استيراد البيانات والروابط البرمجية (Imports & Webhooks)"
        subtitle="رفع البيانات المجمعة من ملفات Excel وتكوين إشعارات الـ Webhooks مع الأنظمة الخارجية"
        actionLabel="إضافة استيراد / Webhook"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالاسم، الرابط، أو النوع..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeImportsWebhooksModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeImportsWebhooksConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
