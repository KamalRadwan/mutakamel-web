"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CommercialAccountItem {
  id: string;
  accountName: string;
  accountNumber: string;
  creditLimit: string;
  currentBalance: string;
  paymentTerms: string;
  creditStatus: "good" | "warning" | "blocked";
}

const mockCommercialAccounts: CommercialAccountItem[] = [
  { id: "acc-trade-101", accountName: "مستشفى السلام الدولي", accountNumber: "ACT-88201", creditLimit: "500,000.00 SAR", currentBalance: "120,500.00 SAR", paymentTerms: "Net 60 Days", creditStatus: "good" },
  { id: "acc-trade-102", accountName: "شركة المتحدون للتجارة", accountNumber: "ACT-44109", creditLimit: "250,000.00 SAR", currentBalance: "248,000.00 SAR", paymentTerms: "Net 30 Days", creditStatus: "warning" },
  { id: "acc-trade-103", accountName: "مؤسسة السرعة اللوجستية", accountNumber: "ACT-10992", creditLimit: "100,000.00 SAR", currentBalance: "105,000.00 SAR", paymentTerms: "Immediate Cash", creditStatus: "blocked" },
];

export function useCommercialAccountsCredit() {
  const { t } = useI18n();
  const [items, setItems] = useState<CommercialAccountItem[]>(mockCommercialAccounts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CommercialAccountItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.accountNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CommercialAccountItem, "id" | "currentBalance" | "creditStatus">) => {
    const created: CommercialAccountItem = {
      ...newItem,
      id: `acc-trade-${Date.now().toString().slice(-4)}`,
      currentBalance: "0.00 SAR",
      creditStatus: "good",
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
