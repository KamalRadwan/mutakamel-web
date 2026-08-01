"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface OrgUnitItem {
  id: string;
  name: string;
  unitType: "company" | "branch" | "department" | "team";
  parentUnit: string;
  code: string;
  manager: string;
  status: "active" | "inactive";
}

const mockOrgUnits: OrgUnitItem[] = [
  { id: "org-1", name: "شركة متكامل كراود كابيتال القابضة", unitType: "company", parentUnit: "الشركة الأم", code: "COMP-01", manager: "منى علي", status: "active" },
  { id: "org-2", name: "فرع الرياض الرئيسي", unitType: "branch", parentUnit: "شركة متكامل كراود كابيتال", code: "BR-RUH", manager: "أحمد محمود", status: "active" },
  { id: "org-3", name: "قسم المبيعات والتسويق", unitType: "department", parentUnit: "فرع الرياض الرئيسي", code: "DEP-SALES", manager: "سارة حسن", status: "active" },
];

export function useOrganization() {
  const { t } = useI18n();
  const [items, setItems] = useState<OrgUnitItem[]>(mockOrgUnits);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<OrgUnitItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.manager.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<OrgUnitItem, "id" | "status">) => {
    const created: OrgUnitItem = {
      ...newItem,
      id: `org-${Date.now().toString().slice(-4)}`,
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
