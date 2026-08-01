"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TeamItem {
  id: string;
  name: string;
  code: string;
  departmentName: string;
  leaderName: string;
  membersCount: number;
  specialty: string;
  status: "active" | "inactive";
}

const initialTeams: TeamItem[] = [
  {
    id: "team-1",
    name: "فريق تطوير البنية التحتية والـ DevOps",
    code: "TEAM_DEVOPS_INFRA",
    departmentName: "إدارة تقنية المعلومات والحلول السحابية",
    leaderName: "م. حسام قاسم",
    membersCount: 12,
    specialty: "السحابة والأمان الرقمي",
    status: "active",
  },
  {
    id: "team-2",
    name: "فريق الواجهات الأمامية والـ UX",
    code: "TEAM_FRONTEND_UI",
    departmentName: "إدارة تقنية المعلومات والحلول السحابية",
    leaderName: "م. كمال رضوان",
    membersCount: 14,
    specialty: "تطوير المنصات وتجربة المستخدم",
    status: "active",
  },
  {
    id: "team-3",
    name: "فريق المبيعات الحكومية والشركات الكبرى",
    code: "TEAM_GOV_ENTERPRISE",
    departmentName: "إدارة المبيعات والتوسع التجاري",
    leaderName: "أ. سلطان العتيبي",
    membersCount: 18,
    specialty: "إغلاق صفقات القطاع العام",
    status: "active",
  },
  {
    id: "team-4",
    name: "فريق الاستقطاب والمواهب",
    code: "TEAM_TALENT_ACQ",
    departmentName: "إدارة الموارد البشرية والعمليات",
    leaderName: "أ. نورة الغامدي",
    membersCount: 8,
    specialty: "التوظيف والتعيينات التخصصية",
    status: "active",
  },
  {
    id: "team-5",
    name: "فريق التحليل المالي والموازنات",
    code: "TEAM_FINANCIAL_ANALYSIS",
    departmentName: "إدارة الموائمة المالية والمخاطر",
    leaderName: "أ. زياد الرويلي",
    membersCount: 9,
    specialty: "إعداد الميزانيات والتقارير",
    status: "active",
  },
];

export function useTeams() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<TeamItem[]>(initialTeams);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = useCallback((newTeam: Omit<TeamItem, "id">) => {
    const created: TeamItem = {
      ...newTeam,
      id: `team-${Date.now()}`,
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
      item.leaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.departmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.specialty.toLowerCase().includes(searchQuery.toLowerCase());

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
