"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FileCheck2 } from "lucide-react";
import { useTradeDocumentProfile, DocumentProfileItem } from "./hooks/useTradeDocumentProfile";
import { CreateTradeDocumentProfileModal } from "./components/CreateTradeDocumentProfileModal";
import { DeleteTradeDocumentProfileConfirmModal } from "./components/DeleteTradeDocumentProfileConfirmModal";

export default function TradeDocumentProfilePage() {
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
  } = useTradeDocumentProfile();

  const columns = [
    {
      header: "اسم البروفايل المستندي",
      cell: (item: DocumentProfileItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.profileName}</p>
            <p className="text-[11px] text-slate-400">الحقول المطلوبة: {item.requiredFieldsCount}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الفئة",
      cell: (item: DocumentProfileItem) => (
        <Badge variant="info">{item.documentCategory.toUpperCase()}</Badge>
      ),
    },
    {
      header: "مرحلة ZATCA",
      cell: (item: DocumentProfileItem) => (
        <Badge variant="success">{item.zatcaPhase}</Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: DocumentProfileItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مفعل وافتراضي" : "مسودة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: DocumentProfileItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/document-profile-platform/${item.id}/general`}>
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
        title="منصة بروفايلات المستندات والفوترة الفوترية (Document Profile Platform)"
        subtitle="إدارة وتخصيص هيكل الفواتير الضريبية وقواعد الفسح الإلكتروني والربط مع ZATCA Phase 2"
        actionLabel="إضافة بروفايل مستندي"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم البروفايل أو الفئة..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeDocumentProfileModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeDocumentProfileConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
