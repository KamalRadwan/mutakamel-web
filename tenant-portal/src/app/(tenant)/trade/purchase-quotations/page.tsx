"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FileText, CheckCircle2, Clock } from "lucide-react";
import { useTradePurchaseQuotations, PurchaseQuotationItem } from "./hooks/useTradePurchaseQuotations";
import { CreateTradePurchaseQuotationsModal } from "./components/CreateTradePurchaseQuotationsModal";
import { DeleteTradePurchaseQuotationsConfirmModal } from "./components/DeleteTradePurchaseQuotationsConfirmModal";

export default function TradePurchaseQuotationsPage() {
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
  } = useTradePurchaseQuotations();

  const columns = [
    {
      header: "رقم طلب RFQ والمورد",
      cell: (item: PurchaseQuotationItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.rfqNumber}</p>
            <p className="text-[11px] text-slate-400">{item.supplierName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "التكلفة المعروضة",
      cell: (item: PurchaseQuotationItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.quotedCost}</span>
      ),
    },
    { header: "المهلة الزمنية للتوريد", accessorKey: "deliveryLeadTime" as keyof PurchaseQuotationItem },
    { header: "صالح حتى تاريخ", accessorKey: "validUntil" as keyof PurchaseQuotationItem },
    {
      header: "الحالة التقييمية",
      cell: (item: PurchaseQuotationItem) => (
        <Badge variant={item.status === "accepted" ? "success" : "warning"}>
          {item.status === "accepted" ? "مقبول ومُعمد" : "قيد الدراسة والتقييم"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PurchaseQuotationItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/purchase-quotations/${item.id}/general`}>
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
        title="عروض أسعار الشراء والـ RFQs (Trade Purchase Quotations)"
        subtitle="جمع ومقارنة عروض الأسعار المقدمة من الموردين وتحويل المنافسة إلى أمر شراء مُعمد"
        actionLabel="تسجيل عرض سعر مورد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم RFQ أو اسم المورد..."
      />

      <Table columns={columns} data={items} />

      <CreateTradePurchaseQuotationsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradePurchaseQuotationsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
