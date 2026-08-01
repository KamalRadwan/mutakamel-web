"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PresetDashboardItem {
  id: string;
  name: string;
  category: "executive" | "sales_rep" | "marketing" | "operations";
  widgetsCount: number;
  isSystemPreset: boolean;
  status: "active" | "archived";
}

const mockPresets: PresetDashboardItem[] = [
  { id: "dash-101", name: "I18N_FALLBACK", category: "executive", widgetsCount: 8, isSystemPreset: true, status: "active" },
  { id: "dash-102", name: "I18N_FALLBACK", category: "sales_rep", widgetsCount: 6, isSystemPreset: true, status: "active" },
  { id: "dash-103", name: "I18N_FALLBACK", category: "marketing", widgetsCount: 5, isSystemPreset: false, status: "active" },
];

export function usePresetDashboards() {
  const { t } = useI18n();
  const [items, setItems] = useState<PresetDashboardItem[]>(mockPresets);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PresetDashboardItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PresetDashboardItem, "id" | "widgetsCount" | "isSystemPreset" | "status">) => {
    const created: PresetDashboardItem = {
      ...newItem,
      id: `dash-${Date.now().toString().slice(-4)}`,
      widgetsCount: 4,
      isSystemPreset: false,
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
