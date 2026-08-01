"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeWidgetCatalogItem {
  id: string;
  widgetName: string;
  widgetType: "chart" | "kpi_card" | "table" | "gauge";
  dataSourceApi: string;
  size: "1x1" | "2x1" | "2x2" | "3x2";
  status: "active" | "inactive";
}

const mockWidgets: TradeWidgetCatalogItem[] = [
  { id: "wdg-tr-101", widgetName: "حركة الإيرادات اليومية حسب الفرع (Daily Sales Trend)", widgetType: "chart", dataSourceApi: "/api/tenant/trade/v1/analytics/daily-revenue", size: "2x2", status: "active" },
  { id: "wdg-tr-102", widgetName: "بطاقة مؤشر السقف الائتماني المتاح (Available Credit Metric)", widgetType: "kpi_card", dataSourceApi: "/api/tenant/trade/v1/credit/available-limit", size: "1x1", status: "active" },
  { id: "wdg-tr-103", widgetName: "جدول المنتجات الأعلى مبيعاً والأسرع تدويداً", widgetType: "table", dataSourceApi: "/api/tenant/trade/v1/products/top-selling", size: "3x2", status: "active" },
];

export function useTradeDashboardWidgets() {
  const { t } = useI18n();
  const [items, setItems] = useState<TradeWidgetCatalogItem[]>(mockWidgets);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<TradeWidgetCatalogItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.widgetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dataSourceApi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<TradeWidgetCatalogItem, "id" | "status">) => {
    const created: TradeWidgetCatalogItem = {
      ...newItem,
      id: `wdg-tr-${Date.now().toString().slice(-4)}`,
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
