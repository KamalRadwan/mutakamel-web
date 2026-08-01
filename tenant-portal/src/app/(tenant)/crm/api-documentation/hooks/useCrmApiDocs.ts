"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ApiDocItem {
  id: string;
  title: string;
  methodPath: string;
  owningBackendApp: string;
  dtoValidation: string;
  verificationDate: string;
  status: "verified" | "draft" | "deprecated";
}

const mockApiDocs: ApiDocItem[] = [
  { id: "api-crm-01", title: "I18N_FALLBACK", methodPath: "GET /api/tenant/crm/v1/leads", owningBackendApp: "crm-app", dtoValidation: "LeadQueryDto", verificationDate: "2026-07-24", status: "verified" },
  { id: "api-crm-02", title: "I18N_FALLBACK", methodPath: "POST /api/tenant/crm/v1/deals", owningBackendApp: "crm-app", dtoValidation: "CreateDealDto", verificationDate: "2026-07-24", status: "verified" },
  { id: "api-crm-03", title: "I18N_FALLBACK", methodPath: "PATCH /api/tenant/crm/v1/pipelines/stage", owningBackendApp: "crm-app", dtoValidation: "UpdateStageDto", verificationDate: "2026-07-25", status: "verified" },
];

export function useCrmApiDocs() {
  const { t } = useI18n();
  const [items, setItems] = useState<ApiDocItem[]>(mockApiDocs);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ApiDocItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.methodPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dtoValidation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ApiDocItem, "id" | "verificationDate" | "status">) => {
    const created: ApiDocItem = {
      ...newItem,
      id: `api-crm-${Date.now().toString().slice(-4)}`,
      verificationDate: "2026-07-25",
      status: "verified",
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
