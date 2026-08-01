"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeDashboardItem {
  id: string;
  name: string;
  code: string;
  widgetsCount: number;
  layoutGrid: string;
  isDefault: boolean;
  status: "published" | "draft";
}

const mockTradeDashboards: TradeDashboardItem[] = [
  { id: "tdb-101", name: "شاشة متابعة المبيعات والمخزون الحي (Live Trade Overview)", code: "b2b_trade_live", widgetsCount: 6, layoutGrid: "3x2 Grid Responsive", isDefault: true, status: "published" },
  { id: "tdb-102", name: "لوحة أداء الموردين وأوامر الشراء (Purchase Analytics)", code: "po_supplier_hub", widgetsCount: 4, layoutGrid: "2x2 Grid", isDefault: false, status: "published" },
];

export function useTradeDashboardBuilder() {
  const { t } = useI18n();
  const [items, setItems] = useState<TradeDashboardItem[]>(mockTradeDashboards);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<TradeDashboardItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<TradeDashboardItem, "id" | "widgetsCount" | "isDefault" | "status">) => {
    const created: TradeDashboardItem = {
      ...newItem,
      id: `tdb-${Date.now().toString().slice(-4)}`,
      widgetsCount: 2,
      isDefault: false,
      status: "published",
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
