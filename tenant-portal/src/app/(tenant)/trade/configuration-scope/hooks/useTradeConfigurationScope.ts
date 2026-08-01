"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ConfigScopeItem {
  id: string;
  scopeName: string;
  scopeLevel: "global" | "branch" | "warehouse" | "pos";
  targetCode: string;
  activeFeaturesCount: number;
  lastModified: string;
  status: "active" | "inherited";
}

const mockScopes: ConfigScopeItem[] = [
  { id: "scope-101", scopeName: "نطاق التهيئة للمركز الرئيسي - الرياض", scopeLevel: "global", targetCode: "HQ-RUH", activeFeaturesCount: 24, lastModified: "2026-07-20", status: "active" },
  { id: "scope-102", scopeName: "نطاق مستودعات التوزيع الغربية - جدة", scopeLevel: "warehouse", targetCode: "WH-JED-01", activeFeaturesCount: 18, lastModified: "2026-07-22", status: "active" },
  { id: "scope-103", scopeName: "نطاق نقاط البيع السريعة (POS Outlets)", scopeLevel: "pos", targetCode: "POS-GRP-NORTH", activeFeaturesCount: 12, lastModified: "2026-07-25", status: "inherited" },
];

export function useTradeConfigurationScope() {
  const { t } = useI18n();
  const [items, setItems] = useState<ConfigScopeItem[]>(mockScopes);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ConfigScopeItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.scopeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ConfigScopeItem, "id" | "activeFeaturesCount" | "lastModified" | "status">) => {
    const created: ConfigScopeItem = {
      ...newItem,
      id: `scope-${Date.now().toString().slice(-4)}`,
      activeFeaturesCount: 5,
      lastModified: "2026-07-25",
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
