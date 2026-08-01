"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface WorkflowVersionItem {
  id: string;
  workflowName: string;
  versionNumber: string;
  targetDocumentType: "Sales Order" | "Purchase Order" | "Credit Approval";
  stepsCount: number;
  isActiveVersion: boolean;
  publishedAt: string;
}

const mockWorkflowVersions: WorkflowVersionItem[] = [
  { id: "wf-ver-101", workflowName: "دورة اعتماد الفواتير الضريبية ذات القيمة المرتفعة", versionNumber: "v3.2.0", targetDocumentType: "Sales Order", stepsCount: 4, isActiveVersion: true, publishedAt: "2026-07-01 09:00" },
  { id: "wf-ver-102", workflowName: "مسار تعميد أوامر الشراء والاستلام المستودعي", versionNumber: "v1.5.0", targetDocumentType: "Purchase Order", stepsCount: 3, isActiveVersion: true, publishedAt: "2026-07-10 14:30" },
];

export function useTradeWorkflowVersions() {
  const { t } = useI18n();
  const [items, setItems] = useState<WorkflowVersionItem[]>(mockWorkflowVersions);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<WorkflowVersionItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.versionNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<WorkflowVersionItem, "id" | "stepsCount" | "isActiveVersion" | "publishedAt">) => {
    const created: WorkflowVersionItem = {
      ...newItem,
      id: `wf-ver-${Date.now().toString().slice(-4)}`,
      stepsCount: 2,
      isActiveVersion: true,
      publishedAt: "الآن",
    };
    setItems((prev) => [created, ...prev]);
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
