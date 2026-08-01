"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CurrencyItem {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isDefault: boolean;
}

const mockCurrencies: CurrencyItem[] = [
  { id: "curr-1", code: "SAR", name: "ريال سعودي", symbol: "ر.س", exchangeRate: 1.0, isDefault: true },
  { id: "curr-2", code: "USD", name: "دولار أمريكي", symbol: "$", exchangeRate: 3.75, isDefault: false },
  { id: "curr-3", code: "AED", name: "درهم إماراتي", symbol: "د.إ", exchangeRate: 1.02, isDefault: false },
];

export function useCurrenciesTaxesNumbering() {
  const { t } = useI18n();
  const [items, setItems] = useState<CurrencyItem[]>(mockCurrencies);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CurrencyItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CurrencyItem, "id" | "isDefault">) => {
    const created: CurrencyItem = {
      ...newItem,
      id: `curr-${Date.now().toString().slice(-4)}`,
      isDefault: false,
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
