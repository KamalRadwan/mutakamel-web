"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ExtensionProfileItem {
  id: string;
  extensionName: string;
  pluginId: string;
  moduleTarget: string;
  version: string;
  hookPointsCount: number;
  status: "active" | "disabled";
}

const mockExtensions: ExtensionProfileItem[] = [
  { id: "ext-prof-101", extensionName: "ملحق الحسابات والمراجعة المحاسبية الفورية", pluginId: "ext-acc-auditor", moduleTarget: "trade-app", version: "v2.4.0", hookPointsCount: 6, status: "active" },
  { id: "ext-prof-102", extensionName: "ملحق الشحن والتتبع اللوجستي المباشر (DHL/SMSA)", pluginId: "ext-logistics-tracking", moduleTarget: "trade-app", version: "v1.8.2", hookPointsCount: 4, status: "active" },
];

export function useTradeExtensionProfiles() {
  const { t } = useI18n();
  const [items, setItems] = useState<ExtensionProfileItem[]>(mockExtensions);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ExtensionProfileItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.extensionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pluginId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ExtensionProfileItem, "id" | "hookPointsCount" | "status">) => {
    const created: ExtensionProfileItem = {
      ...newItem,
      id: `ext-prof-${Date.now().toString().slice(-4)}`,
      hookPointsCount: 2,
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
