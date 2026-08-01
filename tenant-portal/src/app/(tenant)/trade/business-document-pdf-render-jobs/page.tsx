"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FileCode, Printer, Download, Clock } from "lucide-react";
import { useTradePdfRenderJobs, PdfRenderJobItem } from "./hooks/useTradePdfRenderJobs";
import { CreateTradePdfRenderJobsModal } from "./components/CreateTradePdfRenderJobsModal";
import { DeleteTradePdfRenderJobsConfirmModal } from "./components/DeleteTradePdfRenderJobsConfirmModal";

export default function TradePdfRenderJobsPage() {
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
  } = useTradePdfRenderJobs();

  const columns = [
    {
      header: "رقم المستند المرجعي",
      cell: (item: PdfRenderJobItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.referenceNumber}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.templateName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "نوع المستند",
      cell: (item: PdfRenderJobItem) => (
        <Badge variant="info">{item.documentType.toUpperCase()}</Badge>
      ),
    },
    { header: "حجم الملف", accessorKey: "fileSize" as keyof PdfRenderJobItem },
    { header: "تاريخ الرندر", accessorKey: "renderedAt" as keyof PdfRenderJobItem },
    {
      header: "الحالة الفنية",
      cell: (item: PdfRenderJobItem) => (
        <Badge variant={item.status === "completed" ? "success" : item.status === "processing" ? "warning" : "neutral"}>
          {item.status === "completed" ? "تم التوليد بنجاح" : "جاري المعالجة (Worker)"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PdfRenderJobItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/business-document-pdf-render-jobs/${item.id}/general`}>
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
        title="مهام طباعة وتوليد مستندات الـ PDF (Business Document PDF Render Jobs)"
        subtitle="طابور معالجة الخلفية ورندر الفواتير وعروض الأسعار الضريبية بصيغة PDF لطباعتها"
        actionLabel="إرسال مهمة طباعة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم المستند، القالب، أو النوع..."
      />

      <Table columns={columns} data={items} />

      <CreateTradePdfRenderJobsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradePdfRenderJobsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
