"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface RoleItem {
  id: string;
  name: string;
  code: string;
  description: string;
  permissionsCount: number;
  usersAssignedCount: number;
  isSystem: boolean;
}

const mockRoles: RoleItem[] = [
  { id: "role-1", name: "مدير المستأجر الأخصائي (Tenant Admin)", code: "tenant.admin", description: "صلاحية كاملة لإدارة مستخدمي وموديولات المستأجر", permissionsCount: 142, usersAssignedCount: 3, isSystem: true },
  { id: "role-2", name: "مدير المبيعات والعملاء (Sales Manager)", code: "tenant.sales_manager", description: "إدارة صفقات الـ CRM، العملاء، وعروض الأسعار", permissionsCount: 45, usersAssignedCount: 8, isSystem: false },
  { id: "role-3", name: "أخصائي المخزون والتجارة (Inventory Specialist)", code: "tenant.inventory_spec", description: "متابعة المنتجات، المخازن، والكتالوج", permissionsCount: 28, usersAssignedCount: 5, isSystem: false },
];

export function useRolesRoleAssignments() {
  const { t } = useI18n();
  const [items, setItems] = useState<RoleItem[]>(mockRoles);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<RoleItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<RoleItem, "id" | "permissionsCount" | "usersAssignedCount" | "isSystem">) => {
    const created: RoleItem = {
      ...newItem,
      id: `role-${Date.now().toString().slice(-4)}`,
      permissionsCount: 10,
      usersAssignedCount: 0,
      isSystem: false,
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
