"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, BookOpen } from "lucide-react";
import { useTradePricingPriceBooks, PriceBookItem } from "./hooks/useTradePricingPriceBooks";
import { CreateTradePricingPriceBooksModal } from "./components/CreateTradePricingPriceBooksModal";
import { DeleteTradePricingPriceBooksConfirmModal } from "./components/DeleteTradePricingPriceBooksConfirmModal";

export default function TradePricingPriceBooksPage() {
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
  } = useTradePricingPriceBooks();

  const columns = [
    {
      header: "اسم كتاب الأسعار",
      cell: (item: PriceBookItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.bookName}</p>
            <p className="text-[11px] text-slate-400">عدد المنتجات: {item.itemsCount} صنف</p>
          </div>
        </div>
      ),
    },
    {
      header: "المجموعة المستهدفة",
      cell: (item: PriceBookItem) => (
        <Badge variant="info">{item.targetCustomerGroup}</Badge>
      ),
    },
    {
      header: "الخصم الافتراضي",
      cell: (item: PriceBookItem) => (
        <span className="font-bold text-emerald-600">{item.discountPercentage}</span>
      ),
    },
    { header: "العملة", accessorKey: "currency" as keyof PriceBookItem },
    {
      header: "الحالة",
      cell: (item: PriceBookItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مفعل ومربوط" : "مؤرشف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PriceBookItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/pricing-price-books/${item.id}/general`}>
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
        title="كتالوجات وقوائم الأسعار (Pricing & Price Books)"
        subtitle="تحديد خصومات الفئات، قوائم أسعار الجملة والتجزئة وتخصيص العملات لكل شريحة عملاء"
        actionLabel="إضافة قائمة أسعار جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم كتاب الأسعار أو المجموعة..."
      />

      <Table columns={columns} data={items} />

      <CreateTradePricingPriceBooksModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradePricingPriceBooksConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
