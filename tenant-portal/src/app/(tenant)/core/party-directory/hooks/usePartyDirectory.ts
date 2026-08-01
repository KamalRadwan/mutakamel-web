"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PartyItem {
  id: string;
  name: string;
  partyType: "individual" | "organization";
  phone: string;
  email: string;
  roles: string[];
  status: "active" | "inactive";
}

const mockParties: PartyItem[] = [
  { id: "pty-101", name: "شركة الأمل للتوريدات الطبية", partyType: "organization", phone: "+966 50 123 4567", email: "info@alamal-med.com", roles: ["مورد", "عميل تجاري"], status: "active" },
  { id: "pty-102", name: "الدكتور خالد بن عبد العزيز", partyType: "individual", phone: "+966 55 987 6543", email: "khalid@hospital.sa", roles: ["عميل متميز"], status: "active" },
  { id: "pty-103", name: "مؤسسة الأفق للحلول البرمجية", partyType: "organization", phone: "+966 11 444 3322", email: "contact@alofoq.sa", roles: ["شريك تقني"], status: "active" },
];

export function usePartyDirectory() {
  const { t } = useI18n();
  const [items, setItems] = useState<PartyItem[]>(mockParties);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PartyItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.includes(searchQuery)
  );

  const handleCreate = (newItem: Omit<PartyItem, "id" | "status">) => {
    const created: PartyItem = {
      ...newItem,
      id: `pty-${Date.now().toString().slice(-4)}`,
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
