"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface OpportunityItem {
  id: string;
  title: string;
  customerName: string;
  amount: string;
  currency: string;
  currentStage: string;
  previousStage: string;
  assignedOwner: string;
  expectedCloseDate: string;
  status: "open" | "won" | "lost";
}

const mockOpps: OpportunityItem[] = [
  { id: "opp-201", title: "توريد وتطوير النظام الطبي المتكامل", customerName: "شركة الأمل للتوريدات الطبية", amount: "450,000.00", currency: "SAR", currentStage: "المفاوضات النهائية", previousStage: "تقديم العرض الفني", assignedOwner: "أحمد محمود", expectedCloseDate: "2026-08-15", status: "open" },
  { id: "opp-202", title: "ترخيص وتخصيص البوابة السحابية", customerName: "مجموعة الأفق التقنية", amount: "820,000.00", currency: "SAR", currentStage: "صفقة ناجحة (Won)", previousStage: "المفاوضات النهائية", assignedOwner: "منى علي", expectedCloseDate: "2026-07-20", status: "won" },
  { id: "opp-203", title: "عقد صيانة الخوادم السنوية", customerName: "مؤسسة الرواد اللوجستية", amount: "120,000.00", currency: "SAR", currentStage: "تم التواصل والتأهيل", previousStage: "عميل محتمل جديد", assignedOwner: "أحمد محمود", expectedCloseDate: "2026-09-01", status: "open" },
];

export function useOpportunitiesStageHistory() {
  const { t } = useI18n();
  const [items, setItems] = useState<OpportunityItem[]>(mockOpps);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<OpportunityItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.currentStage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<OpportunityItem, "id" | "previousStage" | "status">) => {
    const created: OpportunityItem = {
      ...newItem,
      id: `opp-${Date.now().toString().slice(-4)}`,
      previousStage: "-",
      status: "open",
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
