"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface WidgetItem {
  id: string;
  name: string;
  type: "chart_bar" | "chart_line" | "stat_card" | "funnel";
  metric: string;
  refreshInterval: string;
  isDefault: boolean;
  status: "active" | "hidden";
}

const mockWidgets: WidgetItem[] = [
  { id: "wdg-101", name: "I18N_FALLBACK", type: "funnel", metric: "Leads to Deals Rate", refreshInterval: "5 mins", isDefault: true, status: "active" },
  { id: "wdg-102", name: "I18N_FALLBACK", type: "chart_bar", metric: "Monthly Revenue (SAR)", refreshInterval: "15 mins", isDefault: true, status: "active" },
  { id: "wdg-103", name: "I18N_FALLBACK", type: "stat_card", metric: "Top Reps Won Deals", refreshInterval: "Real-time", isDefault: false, status: "active" },
];

export function useCrmDashboardBuilder() {
  const { t } = useI18n();
  const [items, setItems] = useState<WidgetItem[]>(mockWidgets);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<WidgetItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.metric.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<WidgetItem, "id" | "isDefault" | "status">) => {
    const created: WidgetItem = {
      ...newItem,
      id: `wdg-${Date.now().toString().slice(-4)}`,
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
