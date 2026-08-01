"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PurchaseQuotationItem {
  id: string;
  rfqNumber: string;
  supplierName: string;
  quotedCost: string;
  validUntil: string;
  deliveryLeadTime: string;
  status: "under_evaluation font-bold" | "accepted" | "rejected font-bold";
}

const mockQuotations: PurchaseQuotationItem[] = [
  { id: "rfq-101", rfqNumber: "RFQ-2026-301", supplierName: "شركة الشفاء للمعدات الطبية", quotedCost: "780,000.00 SAR", validUntil: "2026-08-30", deliveryLeadTime: "14 يوماً", status: "under_evaluation font-bold" },
  { id: "rfq-102", rfqNumber: "RFQ-2026-302", supplierName: "مؤسسة الرعاية المتقدمة", quotedCost: "820,000.00 SAR", validUntil: "2026-08-15", deliveryLeadTime: "7 أيام", status: "accepted" },
];

export function useTradePurchaseQuotations() {
  const { t } = useI18n();
  const [items, setItems] = useState<PurchaseQuotationItem[]>(mockQuotations);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PurchaseQuotationItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PurchaseQuotationItem, "id" | "status">) => {
    const created: PurchaseQuotationItem = {
      ...newItem,
      id: `rfq-${Date.now().toString().slice(-4)}`,
      status: "under_evaluation font-bold",
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
