"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, ShoppingCart } from "lucide-react";
import { useTradeQuotationsSalesOrders, QuotationSalesOrderItem } from "./hooks/useTradeQuotationsSalesOrders";
import { CreateTradeQuotationsSalesOrdersModal } from "./components/CreateTradeQuotationsSalesOrdersModal";
import { DeleteTradeQuotationsSalesOrdersConfirmModal } from "./components/DeleteTradeQuotationsSalesOrdersConfirmModal";

export default function TradeQuotationsSalesOrdersPage() {
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
  } = useTradeQuotationsSalesOrders();

  const columns = [
    {
      header: "رقم المستند والعميل",
      cell: (item: QuotationSalesOrderItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.orderNumber}</p>
            <p className="text-[11px] text-slate-400">{item.customerName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "النوع",
      cell: (item: QuotationSalesOrderItem) => (
        <Badge variant={item.type === "sales_order" ? "info" : "neutral"}>
          {item.type === "sales_order" ? "أمر بيع SO" : "عرض سعر QT"}
        </Badge>
      ),
    },
    {
      header: "المبلغ الإجمالي",
      cell: (item: QuotationSalesOrderItem) => (
        <span className="font-bold text-emerald-600">{item.totalAmount}</span>
      ),
    },
    { header: "عدد الأصناف", accessorKey: "itemsCount" as keyof QuotationSalesOrderItem },
    { header: "التسليم / الصلاحية", accessorKey: "validityOrDeliveryDate" as keyof QuotationSalesOrderItem },
    {
      header: "الحالة",
      cell: (item: QuotationSalesOrderItem) => (
        <Badge variant={item.status === "confirmed_order" ? "success" : "info"}>
          {item.status === "confirmed_order" ? "مأكد وجاهز للصرف" : "مرسل للعميل"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: QuotationSalesOrderItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/quotations-sales-orders/${item.id}/general`}>
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
        title="عروض الأسعار وأوامر المبيعات (Quotations & Sales Orders)"
        subtitle="دورة المبيعات الكاملة بدءاً من طلبات الأسعار للعميل وحتى التعميد وحجز المخزون"
        actionLabel="إصدار عرض / أمر بيع"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم المستند أو اسم العميل..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeQuotationsSalesOrdersModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeQuotationsSalesOrdersConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
