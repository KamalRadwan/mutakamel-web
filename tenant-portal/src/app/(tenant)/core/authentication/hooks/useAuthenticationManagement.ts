"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface AuthSessionItem {
  id: string;
  userEmail: string;
  ipAddress: string;
  device: string;
  lastActive: string;
  status: "active" | "revoked";
}

const mockSessions: AuthSessionItem[] = [
  { id: "sess-101", userEmail: "admin@tenant.mutakamel.ai", ipAddress: "197.38.12.4", device: "Chrome on macOS", lastActive: "الآن", status: "active" },
  { id: "sess-102", userEmail: "ahmed@tenant.mutakamel.ai", ipAddress: "41.235.10.88", device: "Safari on iPhone", lastActive: "منذ 15 دقيقة", status: "active" },
  { id: "sess-103", userEmail: "sara@tenant.mutakamel.ai", ipAddress: "156.204.3.11", device: "Firefox on Windows", lastActive: "أمس", status: "revoked" },
];

export function useAuthenticationManagement() {
  const { t } = useI18n();
  const [items, setItems] = useState<AuthSessionItem[]>(mockSessions);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<AuthSessionItem | null>(null);

  const filteredItems = items.filter((item) =>
    item.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.ipAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<AuthSessionItem, "id" | "lastActive" | "status">) => {
    const created: AuthSessionItem = {
      ...newItem,
      id: `sess-${Date.now().toString().slice(-4)}`,
      lastActive: "الآن",
      status: "active",
    };
    setItems((prev) => [created, ...prev]);
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
