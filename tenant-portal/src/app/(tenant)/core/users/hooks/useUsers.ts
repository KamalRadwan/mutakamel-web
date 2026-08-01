"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roleName: string;
  branch: string;
  status: "active" | "invited" | "suspended";
}

const mockUsers: UserItem[] = [
  { id: "usr-101", fullName: "منى علي", email: "mona@tenant.mutakamel.ai", phone: "+966 50 111 2233", roleName: "مدير المستأجر الأخصائي", branch: "المركز الرئيسي", status: "active" },
  { id: "usr-102", fullName: "أحمد محمود", email: "ahmed@tenant.mutakamel.ai", phone: "+966 55 444 5566", roleName: "مدير المبيعات والعملاء", branch: "فرع الرياض الرئيسي", status: "active" },
  { id: "usr-103", fullName: "سارة حسن", email: "sara@tenant.mutakamel.ai", phone: "+966 54 777 8899", roleName: "أخصائي المخزون والتجارة", branch: "فرع جدة", status: "invited" },
];

export function useUsers() {
  const { t } = useI18n();
  const [items, setItems] = useState<UserItem[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<UserItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<UserItem, "id" | "status">) => {
    const created: UserItem = {
      ...newItem,
      id: `usr-${Date.now().toString().slice(-4)}`,
      status: "invited",
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
