"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PurchaseOrderItem {
  id: string;
  poNumber: string;
  supplierName: string;
  warehouseName: string;
  totalCost: string;
  expectedDeliveryDate: string;
  paymentTerms: string;
  status: "issued" | "partially_received" | "received" | "cancelled";
}

const mockPurchaseOrders: PurchaseOrderItem[] = [
  { id: "po-101", poNumber: "PO-2026-7701", supplierName: "شركة فيليبس للأجهزة الطبية العالمية", warehouseName: "المستودع الرئيسي - الرياض", totalCost: "850,000.00 SAR", expectedDeliveryDate: "2026-08-10", paymentTerms: "Net 60 Days", status: "issued" },
  { id: "po-102", poNumber: "PO-2026-7702", supplierName: "مجموعة الأمل للتوريدات الطبية", warehouseName: "مستودع التوزيع - جدة", totalCost: "120,000.00 SAR", expectedDeliveryDate: "2026-07-28", paymentTerms: "Net 30 Days", status: "partially_received" },
];

export function useTradePurchaseOrders() {
  const { t } = useI18n();
  const [items, setItems] = useState<PurchaseOrderItem[]>(mockPurchaseOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PurchaseOrderItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.warehouseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PurchaseOrderItem, "id" | "status">) => {
    const created: PurchaseOrderItem = {
      ...newItem,
      id: `po-${Date.now().toString().slice(-4)}`,
      status: "issued",
    };
    setItems((prev) => [created, ...prev]);
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
