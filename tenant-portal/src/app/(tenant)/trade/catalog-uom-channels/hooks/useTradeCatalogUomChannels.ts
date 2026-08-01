"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CatalogUomChannelItem {
  id: string;
  name: string;
  type: "catalog" | "uom" | "channel";
  code: string;
  conversionFactor?: string;
  status: "active" | "inactive";
}

const mockCatalogUom: CatalogUomChannelItem[] = [
  { id: "cat-uom-1", name: "كرتونة سعة 24 حبة (Box of 24)", type: "uom", code: "BOX24", conversionFactor: "24", status: "active" },
  { id: "cat-uom-2", name: "كتالوج الأجهزة والحلول الطبية 2026", type: "catalog", code: "CAT-MED-2026", conversionFactor: "-", status: "active" },
  { id: "cat-uom-3", name: "قناة البيع المباشر - البوابة السحابية", type: "channel", code: "CH-DIRECT-WEB", conversionFactor: "-", status: "active" },
];

export function useTradeCatalogUomChannels() {
  const { t } = useI18n();
  const [items, setItems] = useState<CatalogUomChannelItem[]>(mockCatalogUom);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CatalogUomChannelItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CatalogUomChannelItem, "id" | "status">) => {
    const created: CatalogUomChannelItem = {
      ...newItem,
      id: `cat-uom-${Date.now().toString().slice(-4)}`,
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
