"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface LeadItem {
  id: string;
  leadName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  score: number;
  assignedTo: string;
  createdAt: string;
}

const mockLeads: LeadItem[] = [
  { id: "lead-101", leadName: "د. عبد الله المالكي", company: "مستشفى الحياة التخصصي", email: "dr.maliki@alhayat.sa", phone: "+966 50 888 9999", source: "Google Ads", stage: "تقديم العرض الفني", score: 85, assignedTo: "أحمد محمود", createdAt: "2026-07-20" },
  { id: "lead-102", leadName: "المهندس رامي سعيد", company: "شركة المقاولات الحديثة", email: "rami@modern-con.com", phone: "+966 55 111 2222", source: "معرض الصحة 2026", stage: "تم التواصل والتأهيل", score: 62, assignedTo: "منى علي", createdAt: "2026-07-22" },
  { id: "lead-103", leadName: "سارة الزهراني", company: "مجموعات التجزئة المتقدمة", email: "sara@retail-adv.com", phone: "+966 54 333 4444", source: "Referral", stage: "عميل محتمل جديد", score: 40, assignedTo: "أحمد محمود", createdAt: "2026-07-25" },
];

export function useLeads() {
  const { t } = useI18n();
  const [items, setItems] = useState<LeadItem[]>(mockLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<LeadItem, "id" | "score" | "createdAt">) => {
    const created: LeadItem = {
      ...newItem,
      id: `lead-${Date.now().toString().slice(-4)}`,
      score: 50,
      createdAt: "2026-07-25",
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
