"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface PolicyRuleItem {
  id: string;
  policyName: string;
  policyType: "pricing_rule" | "approval_workflow" | "credit_guard" | "inventory_reservation";
  targetModule: string;
  priorityOrder: number;
  conditionExpression: string;
  status: "active" | "draft";
}

const mockPolicies: PolicyRuleItem[] = [
  { id: "pol-tr-101", policyName: "سياسة الخصم التلقائي لطلبات الجملة (> 100,000 SAR)", policyType: "pricing_rule", targetModule: "sales-orders", priorityOrder: 1, conditionExpression: "order.total_amount >= 100000", status: "active" },
  { id: "pol-tr-102", policyName: "سياسة الحظر الفوري عند تجاوز السقف الائتماني", policyType: "credit_guard", targetModule: "commercial-accounts", priorityOrder: 2, conditionExpression: "account.balance > account.credit_limit", status: "active" },
];

export function useTradePolicyStudio() {
  const { t } = useI18n();
  const [items, setItems] = useState<PolicyRuleItem[]>(mockPolicies);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<PolicyRuleItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.policyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.conditionExpression.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<PolicyRuleItem, "id" | "status">) => {
    const created: PolicyRuleItem = {
      ...newItem,
      id: `pol-tr-${Date.now().toString().slice(-4)}`,
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
