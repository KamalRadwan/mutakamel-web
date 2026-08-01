"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface DocumentProfileItem {
  id: string;
  profileName: string;
  documentCategory: "tax_invoice" | "customs_declaration" | "bill_of_lading" | "certificate_origin";
  requiredFieldsCount: number;
  zatcaPhase: "Phase 1" | "Phase 2 Clearance" | "Phase 2 Reporting";
  isDefaultProfile: boolean;
  status: "active" | "draft";
}

const mockProfiles: DocumentProfileItem[] = [
  { id: "doc-prof-101", profileName: "ملف الفاتورة الضريبية المبسطة ZATCA B2C", documentCategory: "tax_invoice", requiredFieldsCount: 18, zatcaPhase: "Phase 2 Reporting", isDefaultProfile: true, status: "active" },
  { id: "doc-prof-102", profileName: "ملف الفاتورة الضريبية الأساسية ZATCA B2B", documentCategory: "tax_invoice", requiredFieldsCount: 26, zatcaPhase: "Phase 2 Clearance", isDefaultProfile: false, status: "active" },
  { id: "doc-prof-103", profileName: "ملف شهادات المنشأ والاستيراد الدولي", documentCategory: "certificate_origin", requiredFieldsCount: 12, zatcaPhase: "Phase 1", isDefaultProfile: false, status: "active" },
];

export function useTradeDocumentProfile() {
  const { t } = useI18n();
  const [items, setItems] = useState<DocumentProfileItem[]>(mockProfiles);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<DocumentProfileItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.profileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.documentCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<DocumentProfileItem, "id" | "requiredFieldsCount" | "isDefaultProfile" | "status">) => {
    const created: DocumentProfileItem = {
      ...newItem,
      id: `doc-prof-${Date.now().toString().slice(-4)}`,
      requiredFieldsCount: 10,
      isDefaultProfile: false,
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
