"use client";

import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";

export type LeadsView = "board" | "card" | "list";

export interface LeadStage {
  id: string;
  nameAr: string;
  nameEn: string;
  color: string;
}

export const LEAD_STAGES: LeadStage[] = [
  { id: "new", nameAr: "عميل جديد", nameEn: "New Lead", color: "border-slate-200" },
  { id: "contacted", nameAr: "تم التواصل", nameEn: "Contacted", color: "border-sky-200" },
  { id: "qualified", nameAr: "مؤهل", nameEn: "Qualified", color: "border-blue-200" },
  { id: "proposal", nameAr: "عرض سعر", nameEn: "Proposal", color: "border-purple-200" },
  { id: "negotiation", nameAr: "تفاوض", nameEn: "Negotiation", color: "border-amber-200" },
];

export interface LeadItem {
  id: string;
  leadName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stageId: string;
  score: number;
  assignedTo: string;
  createdAt: string;
}

const mockLeads: LeadItem[] = [
  { id: "lead-101", leadName: "محمد عبدالله", company: "شركة الحياة الطبية", email: "dr.maliki@alhayat.sa", phone: "+966 50 888 9999", source: "Google Ads", stageId: "proposal", score: 85, assignedTo: "أحمد المبيعات", createdAt: "2026-07-20" },
  { id: "lead-102", leadName: "رامي خليل", company: "مؤسسة البناء الحديث", email: "rami@modern-con.com", phone: "+966 55 111 2222", source: "مكالمة واردة", stageId: "contacted", score: 62, assignedTo: "فاطمة العملاء", createdAt: "2026-07-22" },
  { id: "lead-103", leadName: "سارة المفلح", company: "مجموعة التجزئة", email: "sara@retail-adv.com", phone: "+966 54 333 4444", source: "Referral", stageId: "new", score: 40, assignedTo: "عمر التسويق", createdAt: "2026-07-25" },
];

export function useLeads() {
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<LeadsView>("board");
  const [items, setItems] = useState<LeadItem[]>(mockLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadItem | null>(null);

  // Fetch Leads from Backend API with Mock Fallback
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosClient.get("/api/tenant/crm/v1/leads");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setItems(res.data.data);
      }
    } catch (err: any) {
      console.warn("Leads API fetch deferred, using mock fallback:", err?.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const filteredItems = items.filter(
    (item) =>
      item.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async (newItem: Omit<LeadItem, "id" | "score" | "createdAt" | "stageId">) => {
    const created: LeadItem = {
      ...newItem,
      id: `lead-${Date.now().toString().slice(-4)}`,
      score: 50,
      stageId: "new",
      createdAt: new Date().toISOString().split('T')[0],
    };

    setItems((prev) => [...prev, created]);
    setIsCreateOpen(false);

    try {
      await axiosClient.post("/api/tenant/crm/v1/leads", created);
    } catch (err: any) {
      console.warn("Lead creation API call deferred/mocked:", err?.message);
    }
  };

  const handleDelete = async () => {
    if (selectedForDelete) {
      const targetId = selectedForDelete.id;
      setItems((prev) => prev.filter((i) => i.id !== targetId));
      setSelectedForDelete(null);

      try {
        await axiosClient.delete(`/api/tenant/crm/v1/leads/${targetId}`);
      } catch (err: any) {
        console.warn("Lead deletion API call deferred/mocked:", err?.message);
      }
    }
  };

  const moveLead = async (leadId: string, destStageId: string, destIndex: number) => {
    setItems((prevItems) => {
      const itemIndex = prevItems.findIndex(item => item.id === leadId);
      if (itemIndex === -1) return prevItems;

      const newItems = [...prevItems];
      const [movedItem] = newItems.splice(itemIndex, 1);
      
      movedItem.stageId = destStageId;
      
      let insertGlobalIndex = 0;
      let stageCount = 0;
      for (let i = 0; i < newItems.length; i++) {
        if (newItems[i].stageId === destStageId) {
          if (stageCount === destIndex) {
            insertGlobalIndex = i;
            break;
          }
          stageCount++;
        }
        insertGlobalIndex = i + 1;
      }
      
      newItems.splice(insertGlobalIndex, 0, movedItem);
      return newItems;
    });

    try {
      await axiosClient.post(`/api/tenant/crm/v1/leads/${leadId}/stage`, {
        stageId: destStageId,
      });
    } catch (err: any) {
      console.warn("Lead move stage API call deferred/mocked:", err?.message);
    }
  };

  return {
    t,
    activeView,
    setActiveView,
    items: filteredItems,
    isLoading,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
    fetchLeads,
  };
}
