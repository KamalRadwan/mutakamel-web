"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface InventoryStockItem {
  id: string;
  sku: string;
  productName: string;
  warehouseName: string;
  quantityOnHand: number;
  reservedQuantity: number;
  reorderPoint: number;
  unitPrice: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

const mockInventory: InventoryStockItem[] = [
  { id: "inv-101", sku: "MED-EQ-0091", productName: "جهاز مراقبة العلامات الحيوية (Patient Monitor)", warehouseName: "المستودع الرئيسي - الرياض", quantityOnHand: 450, reservedQuantity: 20, reorderPoint: 50, unitPrice: "3,200.00 SAR", status: "in_stock" },
  { id: "inv-102", sku: "MED-SUP-4402", productName: "حزمة المستلزمات الطبية المعقمة", warehouseName: "مستودع التوزيع - جدة", quantityOnHand: 18, reservedQuantity: 10, reorderPoint: 30, unitPrice: "450.00 SAR", status: "low_stock" },
  { id: "inv-103", sku: "MED-ACC-1100", productName: "أسلاك التوصيل والمجسات الكهربائية", warehouseName: "المستودع الرئيسي - الرياض", quantityOnHand: 0, reservedQuantity: 0, reorderPoint: 25, unitPrice: "120.00 SAR", status: "out_of_stock" },
];

export function useTradeInventory() {
  const { t } = useI18n();
  const [items, setItems] = useState<InventoryStockItem[]>(mockInventory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<InventoryStockItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.warehouseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<InventoryStockItem, "id" | "reservedQuantity" | "status">) => {
    const created: InventoryStockItem = {
      ...newItem,
      id: `inv-${Date.now().toString().slice(-4)}`,
      reservedQuantity: 0,
      status: newItem.quantityOnHand > newItem.reorderPoint ? "in_stock" : newItem.quantityOnHand > 0 ? "low_stock" : "out_of_stock",
    };
    setItems((prev) => [...prev, created]);
    setIsCreateOpen(false);
  };

  const handleDelete = () => {
    if (selectedForDelete) {
      setItems((prev) => prev.filter((i) => i.id !== selectedForDelete.id));
      setSelectedForDelete(null);
    }
  };

  return {
    t,
    items: filteredItems,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  };
}
