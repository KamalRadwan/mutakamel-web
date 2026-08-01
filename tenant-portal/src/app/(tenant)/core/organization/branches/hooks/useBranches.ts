"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  companyName: string;
  city: string;
  address: string;
  manager: string;
  phone: string;
  departmentsCount: number;
  status: "active" | "inactive";
}

const initialBranches: BranchItem[] = [
  {
    id: "branch-1",
    name: "فرع الرياض الرئيسي - العليا",
    code: "RUH_HQ",
    companyName: "شركة متكامل القابضة للتكنولوجيا",
    city: "الرياض",
    address: "طريق الملك فهد، حي العليا",
    manager: "م. عبدالأحد الزهراني",
    phone: "+966 11 294 8100",
    departmentsCount: 8,
    status: "active",
  },
  {
    id: "branch-2",
    name: "فرع جدة الإقليمي - الشاطئ",
    code: "JED_REGIONAL",
    companyName: "شركة متكامل القابضة للتكنولوجيا",
    city: "جدة",
    address: "طريق كورنيش جدة، حي الشاطئ",
    manager: "أ. خالد النمر",
    phone: "+966 12 691 4022",
    departmentsCount: 4,
    status: "active",
  },
  {
    id: "branch-3",
    name: "فرع الخبر والمنطقة الشرقية",
    code: "DMM_EASTERN",
    companyName: "مجموعة الحلول الائتمانية الرقمية",
    city: "الخبر",
    address: "شارع الملك سلمان، حي الحزام الذهبي",
    manager: "سارة العتيبي",
    phone: "+966 13 892 1104",
    departmentsCount: 3,
    status: "active",
  },
  {
    id: "branch-4",
    name: "فرع دبي المالي - DIFC",
    code: "DXB_DIFC",
    companyName: "شركة متكامل إنترناشيونال دبي",
    city: "دبي",
    address: "مركز دبي المالي العالمي، البرج الأول",
    manager: "طارق بن سعيد",
    phone: "+971 4 392 0192",
    departmentsCount: 2,
    status: "active",
  },
];

export function useBranches() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<BranchItem[]>(initialBranches);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = useCallback((newBranch: Omit<BranchItem, "id" | "departmentsCount">) => {
    const created: BranchItem = {
      ...newBranch,
      id: `branch-${Date.now()}`,
      departmentsCount: 0,
    };
    setItems((prev) => [created, ...prev]);
    setIsCreateOpen(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.manager.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return {
    t,
    lang,
    items: filteredItems,
    rawCount: items.length,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isCreateOpen,
    setIsCreateOpen,
    handleCreate,
    handleDelete,
  };
}
