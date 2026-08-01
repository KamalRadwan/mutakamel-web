"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface BrowserContractRuleItem {
  id: string;
  ruleName: string;
  envelopeStructure: string;
  errorCategory: string;
  statusCode: number;
  status: "active" | "enforced";
}

const mockContractRules: BrowserContractRuleItem[] = [
  { id: "cbc-01", ruleName: "الغلاف الموحد للاستجابات الناجحة (Success Envelope)", envelopeStructure: "{ success, status, statusCode, code, message, data, meta }", errorCategory: "N/A", statusCode: 200, status: "enforced" },
  { id: "cbc-02", ruleName: "معالجة أخطاء المدخلات والتحقق (Validation Error Envelope)", envelopeStructure: "{ success: false, status: 'ERROR', errorCategory: 'VALIDATION' }", errorCategory: "VALIDATION", statusCode: 422, status: "enforced" },
  { id: "cbc-03", ruleName: "المرور الهيكلي عبر Gateway Path", envelopeStructure: "/api/tenant/crm/v1/*", errorCategory: "ROUTING", statusCode: 200, status: "enforced" },
];

export function useCommonBrowserContract() {
  const { t } = useI18n();
  const [items, setItems] = useState<BrowserContractRuleItem[]>(mockContractRules);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<BrowserContractRuleItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.envelopeStructure.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<BrowserContractRuleItem, "id" | "status">) => {
    const created: BrowserContractRuleItem = {
      ...newItem,
      id: `cbc-${Date.now().toString().slice(-4)}`,
      status: "enforced",
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
