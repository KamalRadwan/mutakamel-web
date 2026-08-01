"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CompanyItem {
  id: string;
  name: string;
  code: string;
  crNumber: string; // Commercial Registration
  taxId: string;
  currency: string;
  country: string;
  branchesCount: number;
  departmentsCount: number;
  employeesCount: number;
  status: "active" | "inactive";
  createdAt: string;
}

const initialCompanies: CompanyItem[] = [
  {
    id: "comp-1",
    name: "شركة متكامل القابضة للتكنولوجيا",
    code: "MUTAKAMEL_HOLDING",
    crNumber: "1010892341",
    taxId: "310492810200003",
    currency: "SAR",
    country: "المملكة العربية السعودية",
    branchesCount: 5,
    departmentsCount: 14,
    employeesCount: 230,
    status: "active",
    createdAt: "2025-01-10",
  },
  {
    id: "comp-2",
    name: "مجموعة الحلول الائتمانية الرقمية",
    code: "DIGITAL_CREDIT_GP",
    crNumber: "2050192842",
    taxId: "311284910200003",
    currency: "SAR",
    country: "المملكة العربية السعودية",
    branchesCount: 3,
    departmentsCount: 8,
    employeesCount: 95,
    status: "active",
    createdAt: "2025-03-15",
  },
  {
    id: "comp-3",
    name: "شركة متكامل إنترناشيونال دبي",
    code: "MUTAKAMEL_UAE",
    crNumber: "UAE-992104",
    taxId: "100492810300003",
    currency: "AED",
    country: "الإمارات العربية المتحدة",
    branchesCount: 2,
    departmentsCount: 5,
    employeesCount: 42,
    status: "active",
    createdAt: "2025-06-01",
  },
];

export function useCompanies() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<CompanyItem[]>(initialCompanies);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CompanyItem | null>(null);

  const handleCreate = useCallback((newCompany: Omit<CompanyItem, "id" | "branchesCount" | "departmentsCount" | "employeesCount" | "createdAt">) => {
    const created: CompanyItem = {
      ...newCompany,
      id: `comp-${Date.now()}`,
      branchesCount: 0,
      departmentsCount: 0,
      employeesCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setItems((prev) => [created, ...prev]);
    setIsCreateOpen(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedForDelete(null);
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.crNumber.includes(searchQuery);

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
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  };
}
