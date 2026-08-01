"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface StaticCatalogueItem {
  id: string;
  catalogName: string;
  category: "lead_sources" | "industry_types" | "deal_reasons" | "currencies";
  entriesCount: number;
  lastUpdated: string;
  status: "active" | "synced";
}

const mockCatalogues: StaticCatalogueItem[] = [
  { id: "cat-101", catalogName: "I18N_FALLBACK", category: "industry_types", entriesCount: 48, lastUpdated: "2026-07-20", status: "synced" },
  { id: "cat-102", catalogName: "I18N_FALLBACK", category: "deal_reasons", entriesCount: 12, lastUpdated: "2026-07-22", status: "active" },
  { id: "cat-103", catalogName: "I18N_FALLBACK", category: "lead_sources", entriesCount: 15, lastUpdated: "2026-07-25", status: "synced" },
];

export function useCrmStaticCatalogue() {
  const { t } = useI18n();
  const [items, setItems] = useState<StaticCatalogueItem[]>(mockCatalogues);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<StaticCatalogueItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.catalogName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<StaticCatalogueItem, "id" | "entriesCount" | "lastUpdated" | "status">) => {
    const created: StaticCatalogueItem = {
      ...newItem,
      id: `cat-${Date.now().toString().slice(-4)}`,
      entriesCount: 1,
      lastUpdated: "2026-07-25",
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
