"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface LeadStageItem {
  id: string;
  name: string;
  order: number;
  color: string;
  winProbability: string;
  leadsCount: number;
  status: "active" | "archived";
}

const mockStages: LeadStageItem[] = [
  { id: "stg-1", name: "عميل محتمل جديد (New Lead)", order: 1, color: "#3b82f6", winProbability: "10%", leadsCount: 42, status: "active" },
  { id: "stg-2", name: "تم التواصل والتأهيل (Qualified)", order: 2, color: "#8b5cf6", winProbability: "30%", leadsCount: 28, status: "active" },
  { id: "stg-3", name: "تقديم العرض الفني (Demo Delivered)", order: 3, color: "#eab308", winProbability: "60%", leadsCount: 15, status: "active" },
  { id: "stg-4", name: "المفاوضات النهائية (Negotiation)", order: 4, color: "#f97316", winProbability: "85%", leadsCount: 8, status: "active" },
  { id: "stg-5", name: "صفقة ناجحة (Won)", order: 5, color: "#22c55e", winProbability: "100%", leadsCount: 94, status: "active" },
];

export function useLeadStages() {
  const { t } = useI18n();
  const [items, setItems] = useState<LeadStageItem[]>(mockStages);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadStageItem | null>(null);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<LeadStageItem, "id" | "leadsCount" | "status">) => {
    const created: LeadStageItem = {
      ...newItem,
      id: `stg-${Date.now().toString().slice(-4)}`,
      leadsCount: 0,
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
