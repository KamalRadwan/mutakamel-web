"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  branchName: string;
  headName: string;
  budgetAllocated: string;
  teamsCount: number;
  membersCount: number;
  status: "active" | "inactive";
}

const initialDepartments: DepartmentItem[] = [
  {
    id: "dept-1",
    name: "إدارة تقنية المعلومات والحلول السحابية",
    code: "DEPT_IT_CLOUD",
    branchName: "فرع الرياض الرئيسي - العليا",
    headName: "د. إبراهيم الفالح",
    budgetAllocated: "1,200,000 SAR",
    teamsCount: 5,
    membersCount: 48,
    status: "active",
  },
  {
    id: "dept-2",
    name: "إدارة المبيعات والتوسع التجاري",
    code: "DEPT_SALES_BIZ",
    branchName: "فرع الرياض الرئيسي - العليا",
    headName: "أ. منيرة السبيعي",
    budgetAllocated: "850,000 SAR",
    teamsCount: 4,
    membersCount: 36,
    status: "active",
  },
  {
    id: "dept-3",
    name: "إدارة الموارد البشرية والعمليات",
    code: "DEPT_HR_OPS",
    branchName: "فرع الرياض الرئيسي - العليا",
    headName: "أ. فهد الشمري",
    budgetAllocated: "450,000 SAR",
    teamsCount: 3,
    membersCount: 22,
    status: "active",
  },
  {
    id: "dept-4",
    name: "إدارة الموائمة المالية والمخاطر",
    code: "DEPT_FINANCE_RISK",
    branchName: "فرع جدة الإقليمي - الشاطئ",
    headName: "أ. وليد الماجد",
    budgetAllocated: "600,000 SAR",
    teamsCount: 2,
    membersCount: 18,
    status: "active",
  },
  {
    id: "dept-5",
    name: "إدارة التسويق والتواصل المؤسسي",
    code: "DEPT_MARKETING",
    branchName: "فرع الخبر والمنطقة الشرقية",
    headName: "أ. ريم المطيري",
    budgetAllocated: "500,000 SAR",
    teamsCount: 2,
    membersCount: 15,
    status: "active",
  },
];

export function useDepartments() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<DepartmentItem[]>(initialDepartments);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = useCallback((newDept: Omit<DepartmentItem, "id" | "teamsCount" | "membersCount">) => {
    const created: DepartmentItem = {
      ...newDept,
      id: `dept-${Date.now()}`,
      teamsCount: 0,
      membersCount: 0,
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
      item.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.branchName.toLowerCase().includes(searchQuery.toLowerCase());

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
