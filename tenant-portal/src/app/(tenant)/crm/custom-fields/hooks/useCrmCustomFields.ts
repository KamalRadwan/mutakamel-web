"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CustomFieldItem {
  id: string;
  label: string;
  key: string;
  targetEntity: "lead" | "deal" | "contact" | "organization";
  fieldType: "text" | "number" | "select" | "date";
  isRequired: boolean;
  status: "active" | "hidden";
}

const mockCustomFields: CustomFieldItem[] = [
  { id: "cf-101", label: "ميزانية العميل المتوقعة", key: "expected_budget", targetEntity: "lead", fieldType: "number", isRequired: true, status: "active" },
  { id: "cf-102", label: "نوع الترخيص الطبي المطلوبة", key: "medical_license_type", targetEntity: "organization", fieldType: "select", isRequired: false, status: "active" },
  { id: "cf-103", label: "تاريخ الافتتاح المستهدف", key: "target_opening_date", targetEntity: "deal", fieldType: "date", isRequired: false, status: "active" },
];

export function useCrmCustomFields() {
  const { t } = useI18n();
  const [items, setItems] = useState<CustomFieldItem[]>(mockCustomFields);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CustomFieldItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetEntity.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CustomFieldItem, "id" | "status">) => {
    const created: CustomFieldItem = {
      ...newItem,
      id: `cf-${Date.now().toString().slice(-4)}`,
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
