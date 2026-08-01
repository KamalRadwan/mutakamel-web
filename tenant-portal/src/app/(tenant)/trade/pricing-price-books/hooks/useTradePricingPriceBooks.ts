"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PriceBookItem {
  id: string;
  bookName: string;
  currency: string;
  targetCustomerGroup: string;
  itemsCount: number;
  discountPercentage: string;
  isDefault: boolean;
  status: "active" | "archived";
}

const mockPriceBooks: PriceBookItem[] = [
  { id: "pb-101", bookName: "كتالوج أسعار المستشفيات والقطاع الطبي العام", currency: "SAR", targetCustomerGroup: "Enterprise Medical", itemsCount: 420, discountPercentage: "15.00%", isDefault: true, status: "active" },
  { id: "pb-102", bookName: "قائمة أسعار التجزئة والمبيعات المباشرة", currency: "SAR", targetCustomerGroup: "Retail Direct", itemsCount: 890, discountPercentage: "0.00%", isDefault: false, status: "active" },
  { id: "pb-103", bookName: "قائمة أسعار التصدير بالدولار الأمريكي", currency: "USD", targetCustomerGroup: "Export Clients", itemsCount: 150, discountPercentage: "8.50%", isDefault: false, status: "active" },
];

export function useTradePricingPriceBooks() {
  const { t } = useI18n();
  const [items, setItems] = useState<PriceBookItem[]>(mockPriceBooks);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PriceBookItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.bookName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetCustomerGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PriceBookItem, "id" | "itemsCount" | "isDefault" | "status">) => {
    const created: PriceBookItem = {
      ...newItem,
      id: `pb-${Date.now().toString().slice(-4)}`,
      itemsCount: 0,
      isDefault: false,
      status: "active",
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
