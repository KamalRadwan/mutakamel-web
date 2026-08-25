"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Package } from "lucide-react";
import { useTradeInventory, InventoryStockItem } from "./hooks/useTradeInventory";
import { CreateTradeInventoryModal } from "./components/CreateTradeInventoryModal";
import { DeleteTradeInventoryConfirmModal } from "./components/DeleteTradeInventoryConfirmModal";

export default function TradeInventoryPage() {
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
  } = useTradeInventory();

  const columns = [
    {
      header: "اسم المنتج والـ SKU",
      cell: (item: InventoryStockItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.productName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.sku} · {item.warehouseName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الكمية المتاحة (OnHand)",
      cell: (item: InventoryStockItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.quantityOnHand} قطعة</span>
      ),
    },
    {
      header: "الكمية المحجوزة",
      cell: (item: InventoryStockItem) => (
        <span className="font-mono text-xs text-amber-600 font-bold">{item.reservedQuantity} قطعة</span>
      ),
    },
    { header: "سعر الوحدة", accessorKey: "unitPrice" as keyof InventoryStockItem },
    {
      header: "حالة المخزون",
      cell: (item: InventoryStockItem) => (
        <Badge variant={item.status === "in_stock" ? "success" : item.status === "low_stock" ? "warning" : "danger"}>
          {item.status === "in_stock" ? "متوفر بكثرة" : item.status === "low_stock" ? "مخزون منخفض" : "نفد المخزون"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: InventoryStockItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/inventory/${item.id}/general`}>
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
        title="إدارة المخزون والتخزين (Trade Inventory & Warehouse Stock)"
        subtitle="متابعة الكميات الفطرية المتاحة، الحجوزات الآلية وأشرطة الإنذار لنقاط إعادة الطلب"
        actionLabel="إضافة صنف مخزوني"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المنتج، الـ SKU، أو المستودع..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeInventoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeInventoryConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
