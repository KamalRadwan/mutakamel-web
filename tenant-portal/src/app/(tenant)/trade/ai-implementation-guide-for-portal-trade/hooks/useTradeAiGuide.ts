"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeAiGuideItem {
  id: string;
  guideTitle: string;
  moduleTarget: string;
  aiPromptPattern: string;
  recommendedModel: string;
  status: "verified" | "draft";
}

const mockAiGuides: TradeAiGuideItem[] = [
  { id: "ai-tr-01", guideTitle: "دليل تسعير المنتجات التلقائي والخصم الكلي", moduleTarget: "trade-app", aiPromptPattern: "Calculate dynamic bulk discount based on order quantity", recommendedModel: "Gemini 1.5 Pro", status: "verified" },
  { id: "ai-tr-02", guideTitle: "دليل ترحيل الشحنات والتنبؤ بنواقص المخزن", moduleTarget: "trade-app", aiPromptPattern: "Predict stock depletion date using current order velocity", recommendedModel: "Gemini Flash 1.5", status: "verified" },
];

export function useTradeAiGuide() {
  const { t } = useI18n();
  const [items, setItems] = useState<TradeAiGuideItem[]>(mockAiGuides);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<TradeAiGuideItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.guideTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aiPromptPattern.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<TradeAiGuideItem, "id" | "status">) => {
    const created: TradeAiGuideItem = {
      ...newItem,
      id: `ai-tr-${Date.now().toString().slice(-4)}`,
      status: "verified",
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
