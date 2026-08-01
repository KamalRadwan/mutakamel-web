"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CrmModuleSettingItem {
  id: string;
  settingName: string;
  key: string;
  value: string;
  group: "lead_routing" | "deal_limits" | "email_integration" | "security";
  updatedAt: string;
  status: "active" | "overridden";
}

const mockCrmSettings: CrmModuleSettingItem[] = [
  { id: "set-crm-1", settingName: "I18N_FALLBACK", key: "crm.auto_lead_routing", value: "Enabled (Balanced)", group: "lead_routing", updatedAt: "2026-07-20", status: "active" },
  { id: "set-crm-2", settingName: "I18N_FALLBACK", key: "crm.max_sales_rep_discount", value: "10.00%", group: "deal_limits", updatedAt: "2026-07-22", status: "active" },
  { id: "set-crm-3", settingName: "I18N_FALLBACK", key: "crm.smtp_gateway", value: "smtp.mutakamel.ai:587", group: "email_integration", updatedAt: "2026-07-24", status: "active" },
];

export function useCrmModuleSettings() {
  const { t } = useI18n();
  const [items, setItems] = useState<CrmModuleSettingItem[]>(mockCrmSettings);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CrmModuleSettingItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.settingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CrmModuleSettingItem, "id" | "updatedAt" | "status">) => {
    const created: CrmModuleSettingItem = {
      ...newItem,
      id: `set-crm-${Date.now().toString().slice(-4)}`,
      updatedAt: "2026-07-25",
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
