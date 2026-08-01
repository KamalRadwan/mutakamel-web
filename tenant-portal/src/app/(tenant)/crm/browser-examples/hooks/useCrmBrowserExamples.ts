"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface BrowserExampleItem {
  id: string;
  name: string;
  targetEndpoint: string;
  samplePayload: string;
  httpStatusExpected: number;
  environment: "sandbox" | "production";
}

const mockBrowserExamples: BrowserExampleItem[] = [
  { id: "ex-crm-01", name: "نموذج تسجيل زائر من الموقع (Web-to-Lead)", targetEndpoint: "/api/tenant/crm/v1/leads/public", samplePayload: '{"name":"أحمد", "phone":"+966500000000"}', httpStatusExpected: 201, environment: "sandbox" },
  { id: "ex-crm-02", name: "طلب استعلام رصيد العقد والصفقة", targetEndpoint: "/api/tenant/crm/v1/deals/check", samplePayload: '{"dealId":"dl-992"}', httpStatusExpected: 200, environment: "sandbox" },
];

export function useCrmBrowserExamples() {
  const { t } = useI18n();
  const [items, setItems] = useState<BrowserExampleItem[]>(mockBrowserExamples);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<BrowserExampleItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetEndpoint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<BrowserExampleItem, "id">) => {
    const created: BrowserExampleItem = {
      ...newItem,
      id: `ex-crm-${Date.now().toString().slice(-4)}`,
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
