"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface AcquisitionSourceItem {
  id: string;
  name: string;
  channelType: "digital" | "referral" | "event" | "cold_call";
  totalLeadsCount: number;
  conversionRate: string;
  status: "active" | "inactive";
}

const mockSources: AcquisitionSourceItem[] = [
  { id: "src-1", name: "إعلانات جوجل ورصيد البحث (Google Ads)", channelType: "digital", totalLeadsCount: 1420, conversionRate: "18.4%", status: "active" },
  { id: "src-2", name: "معرض الصحة والتكنولوجيا الرياض 2026", channelType: "event", totalLeadsCount: 320, conversionRate: "24.1%", status: "active" },
  { id: "src-3", name: "التوصيات المباشرة للشركاء (Referrals)", channelType: "referral", totalLeadsCount: 88, conversionRate: "42.0%", status: "active" },
];

export function useAcquisitionSources() {
  const { t } = useI18n();
  const [items, setItems] = useState<AcquisitionSourceItem[]>(mockSources);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<AcquisitionSourceItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.channelType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<AcquisitionSourceItem, "id" | "totalLeadsCount" | "conversionRate" | "status">) => {
    const created: AcquisitionSourceItem = {
      ...newItem,
      id: `src-${Date.now().toString().slice(-4)}`,
      totalLeadsCount: 0,
      conversionRate: "0%",
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
