"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, ShoppingBag, Truck, Calendar } from "lucide-react";
import { useTradePurchaseOrders, PurchaseOrderItem } from "./hooks/useTradePurchaseOrders";
import { CreateTradePurchaseOrdersModal } from "./components/CreateTradePurchaseOrdersModal";
import { DeleteTradePurchaseOrdersConfirmModal } from "./components/DeleteTradePurchaseOrdersConfirmModal";

export default function TradePurchaseOrdersPage() {
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
  } = useTradePurchaseOrders();

  const columns = [
    {
      header: "رقم الأمر والمورد",
      cell: (item: PurchaseOrderItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.poNumber}</p>
            <p className="text-[11px] text-slate-400">{item.supplierName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "المستودع المستلم",
      cell: (item: PurchaseOrderItem) => (
        <Badge variant="neutral">{item.warehouseName}</Badge>
      ),
    },
    {
      header: "التكلفة الإجمالية",
      cell: (item: PurchaseOrderItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.totalCost}</span>
      ),
    },
    { header: "التسليم المتوقع", accessorKey: "expectedDeliveryDate" as keyof PurchaseOrderItem },
    {
      header: "الحالة",
      cell: (item: PurchaseOrderItem) => (
        <Badge variant={item.status === "issued" ? "info" : item.status === "partially_received" ? "warning" : "success"}>
          {item.status === "issued" ? "تم الإصدار للمورد" : item.status === "partially_received" ? "مستلم جزئياً" : "مستلم بالكامل"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PurchaseOrderItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/purchase-orders/${item.id}/general`}>
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
        title="أوامر الشراء (Trade Purchase Orders)"
        subtitle="إدارة المشتريات الخارجية والتعميدات الموجهة للموردين وتلقي بضائع التوريد في المستودعات"
        actionLabel="إصدار أمر شراء"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم الأمر، المورد، أو المستودع..."
      />

      <Table columns={columns} data={items} />

      <CreateTradePurchaseOrdersModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradePurchaseOrdersConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
