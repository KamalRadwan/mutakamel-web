"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PipelineBoardItem {
  id: string;
  name: string;
  code: string;
  stagesCount: number;
  totalDealsValue: string;
  isDefault: boolean;
  status: "active" | "archived";
}

const mockPipelines: PipelineBoardItem[] = [
  { id: "pipe-101", name: "I18N_FALLBACK", code: "b2b_enterprise", stagesCount: 5, totalDealsValue: "1,390,000.00 SAR", isDefault: true, status: "active" },
  { id: "pipe-102", name: "I18N_FALLBACK", code: "b2b_sme", stagesCount: 4, totalDealsValue: "420,000.00 SAR", isDefault: false, status: "active" },
];

export function usePipelinesBoards() {
  const { t } = useI18n();
  const [items, setItems] = useState<PipelineBoardItem[]>(mockPipelines);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PipelineBoardItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PipelineBoardItem, "id" | "stagesCount" | "totalDealsValue" | "isDefault" | "status">) => {
    const created: PipelineBoardItem = {
      ...newItem,
      id: `pipe-${Date.now().toString().slice(-4)}`,
      stagesCount: 3,
      totalDealsValue: "0.00 SAR",
      isDefault: false,
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
