"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CustomerProfileItem {
  id: string;
  name: string;
  category: "VIP" | "Enterprise" | "SME";
  contactPerson: string;
  phone: string;
  email: string;
  totalDealsValue: string;
  status: "active" | "churned";
}

const mockCustomerProfiles: CustomerProfileItem[] = [
  { id: "cust-101", name: "شركة الأمل الطبية", category: "Enterprise", contactPerson: "د. سامي المالك", phone: "+966 50 123 4567", email: "info@alamal-med.com", totalDealsValue: "450,000.00 SAR", status: "active" },
  { id: "cust-102", name: "مؤسسة الأفق للتجارة", category: "VIP", contactPerson: "منير سعد", phone: "+966 55 987 6543", email: "muneer@alofok.com", totalDealsValue: "820,000.00 SAR", status: "active" },
  { id: "cust-103", name: "مدارس الرواد الأهلية", category: "SME", contactPerson: "سارة عبدالكريم", phone: "+966 54 222 3333", email: "sara@alruwad.sa", totalDealsValue: "120,000.00 SAR", status: "active" },
];

export function useCustomerProfiles() {
  const { t } = useI18n();
  const [items, setItems] = useState<CustomerProfileItem[]>(mockCustomerProfiles);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CustomerProfileItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CustomerProfileItem, "id" | "totalDealsValue" | "status">) => {
    const created: CustomerProfileItem = {
      ...newItem,
      id: `cust-${Date.now().toString().slice(-4)}`,
      totalDealsValue: "0.00 SAR",
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
