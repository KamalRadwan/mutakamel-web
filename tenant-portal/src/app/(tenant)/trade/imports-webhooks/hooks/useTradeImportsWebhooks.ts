"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ImportWebhookItem {
  id: string;
  name: string;
  type: "excel_import" | "webhook_listener" | "outbound_webhook";
  targetEndpointOrFile: string;
  processedRecordsCount: number;
  lastTriggeredAt: string;
  status: "active" | "error" | "completed";
}

const mockWebhooks: ImportWebhookItem[] = [
  { id: "wh-tr-101", name: "استيراد ملف المنتجات والتسعير المجمّع (CSV/XLSX)", type: "excel_import", targetEndpointOrFile: "products_bulk_import_2026.xlsx", processedRecordsCount: 1420, lastTriggeredAt: "2026-07-25 11:30", status: "completed" },
  { id: "wh-tr-102", name: "رابط الـ Webhook لإشعار نظام المستودعات عند صدور الأوامر", type: "outbound_webhook", targetEndpointOrFile: "https://wms.domain.com/api/v1/orders/created", processedRecordsCount: 384, lastTriggeredAt: "2026-07-25 12:00", status: "active" },
];

export function useTradeImportsWebhooks() {
  const { t } = useI18n();
  const [items, setItems] = useState<ImportWebhookItem[]>(mockWebhooks);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ImportWebhookItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetEndpointOrFile.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ImportWebhookItem, "id" | "processedRecordsCount" | "lastTriggeredAt" | "status">) => {
    const created: ImportWebhookItem = {
      ...newItem,
      id: `wh-tr-${Date.now().toString().slice(-4)}`,
      processedRecordsCount: 0,
      lastTriggeredAt: "الآن",
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
