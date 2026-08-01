"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ProvisioningUpdateItem {
  id: string;
  version: string;
  releaseNotes: string;
  targetComponent: string;
  appliedAt: string;
  status: "applied" | "pending" | "failed";
}

const mockUpdates: ProvisioningUpdateItem[] = [
  { id: "upd-101", version: "v2.4.0", releaseNotes: "تحديثات الأمان وتوسيع نطاق قاعدة بيانات المستأجر", targetComponent: "Core Database Schema", appliedAt: "2026-07-20", status: "applied" },
  { id: "upd-102", version: "v2.4.1", releaseNotes: "إصلاح تحسين استعلامات موديول CRM ورسائل البريد", targetComponent: "CRM Service Pack", appliedAt: "2026-07-24", status: "applied" },
  { id: "upd-103", version: "v2.5.0-beta", releaseNotes: "تحديث نظام الصلاحيات المتقدم وتخصيص الباقات", targetComponent: "Platform Worker", appliedAt: "-", status: "pending" },
];

export function useProvisioningUpdates() {
  const { t } = useI18n();
  const [items, setItems] = useState<ProvisioningUpdateItem[]>(mockUpdates);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ProvisioningUpdateItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetComponent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ProvisioningUpdateItem, "id" | "appliedAt" | "status">) => {
    const created: ProvisioningUpdateItem = {
      ...newItem,
      id: `upd-${Date.now().toString().slice(-4)}`,
      appliedAt: "-",
      status: "pending",
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
