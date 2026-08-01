"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface WorkspaceProfileItem {
  id: string;
  tenantName: string;
  primaryColor: string;
  logoUrl: string;
  defaultTimezone: string;
  locale: "ar" | "en";
  status: "active" | "updating";
}

const mockWorkspaces: WorkspaceProfileItem[] = [
  { id: "ws-main", tenantName: "شركة متكامل كراود كابيتال", primaryColor: "#2563eb", logoUrl: "/logo-mutakamel.png", defaultTimezone: "Asia/Riyadh (GMT+3)", locale: "ar", status: "active" },
  { id: "ws-sub", tenantName: "فرع الاستثمار والتمويل الجماعي", primaryColor: "#059669", logoUrl: "/logo-finance.png", defaultTimezone: "Asia/Riyadh (GMT+3)", locale: "ar", status: "active" },
];

export function useWorkspaceSettingsBranding() {
  const { t } = useI18n();
  const [items, setItems] = useState<WorkspaceProfileItem[]>(mockWorkspaces);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<WorkspaceProfileItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.defaultTimezone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<WorkspaceProfileItem, "id" | "status">) => {
    const created: WorkspaceProfileItem = {
      ...newItem,
      id: `ws-${Date.now().toString().slice(-4)}`,
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
