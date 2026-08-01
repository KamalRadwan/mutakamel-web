"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ControlTowerItem {
  id: string;
  metricName: string;
  category: "supply_chain" | "sales_velocity" | "inventory_health" | "credit_risk";
  currentValue: string;
  targetThreshold: string;
  trend: "up" | "down" | "stable";
  alertStatus: "normal" | "warning" | "critical";
}

const mockMetrics: ControlTowerItem[] = [
  { id: "ct-101", metricName: "معدل سرعة تدوير المخزون (Stock Turnover Rate)", category: "inventory_health", currentValue: "4.8x", targetThreshold: "5.0x", trend: "up", alertStatus: "normal" },
  { id: "ct-102", metricName: "نسبة الطلبات المتأخرة في التوريد (Backorder Ratio)", category: "supply_chain", currentValue: "6.2%", targetThreshold: "2.0%", trend: "up", alertStatus: "critical" },
  { id: "ct-103", metricName: "متوسط أيام التحصيل التجاري (DSO - Days Sales Outstanding)", category: "credit_risk", currentValue: "42 يوماً", targetThreshold: "30 يوماً", trend: "down", alertStatus: "warning" },
];

export function useTradeControlTower() {
  const { t } = useI18n();
  const [items, setItems] = useState<ControlTowerItem[]>(mockMetrics);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ControlTowerItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.metricName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ControlTowerItem, "id" | "trend" | "alertStatus">) => {
    const created: ControlTowerItem = {
      ...newItem,
      id: `ct-${Date.now().toString().slice(-4)}`,
      trend: "stable",
      alertStatus: "normal",
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
