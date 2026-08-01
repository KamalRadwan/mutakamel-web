"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface UserModuleAssignmentItem {
  id: string;
  userName: string;
  userEmail: string;
  moduleKey: string;
  moduleName: string;
  assignedAt: string;
  status: "active" | "suspended";
}

const mockAssignments: UserModuleAssignmentItem[] = [
  { id: "uma-101", userName: "منى علي", userEmail: "mona@tenant.com", moduleKey: "core", moduleName: "النظام الأساسي (Core System)", assignedAt: "2026-07-01", status: "active" },
  { id: "uma-102", userName: "أحمد محمود", userEmail: "ahmed@tenant.com", moduleKey: "crm", moduleName: "إدارة العملاء (CRM Module)", assignedAt: "2026-07-10", status: "active" },
  { id: "uma-103", userName: "سارة حسن", userEmail: "sara@tenant.com", moduleKey: "trade", moduleName: "التجارة والعمليات (Trade Module)", assignedAt: "2026-07-15", status: "active" },
];

export function useUserModuleAssignments() {
  const { t } = useI18n();
  const [items, setItems] = useState<UserModuleAssignmentItem[]>(mockAssignments);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<UserModuleAssignmentItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.moduleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<UserModuleAssignmentItem, "id" | "assignedAt" | "status">) => {
    const created: UserModuleAssignmentItem = {
      ...newItem,
      id: `uma-${Date.now().toString().slice(-4)}`,
      assignedAt: "2026-07-25",
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
