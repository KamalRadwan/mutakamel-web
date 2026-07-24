"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ModuleRecord {
  id: string;
  moduleKey: string;
  moduleName: string;
  description: string;
  status: "ACTIVE" | "BETA" | "DEPRECATED";
  rank: number;
  tiersCount: number;
  featuresCount: number;
  createdAt: string;
}

export function useModules() {
  const { t } = useI18n();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State for Create Module
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [modules, setModules] = useState<ModuleRecord[]>([
    {
      id: "mod-01",
      moduleKey: "core",
      moduleName: "النواة الأساسية (Core Foundation)",
      description: "المكوّن الأساسي لهوية المستأجر، الهيكل التنظيمي، وإدارة الفروع والأقسام والمستخدمين.",
      status: "ACTIVE",
      rank: 1,
      tiersCount: 4,
      featuresCount: 18,
      createdAt: "2026-06-01",
    },
    {
      id: "mod-02",
      moduleKey: "crm",
      moduleName: "إدارة علاقات العملاء (CRM Suite)",
      description: "إدارة الفرص التجارية، العملاء المحتملين، المسارات، الاتصالات المباشرة وشبكات التسويق.",
      status: "ACTIVE",
      rank: 2,
      tiersCount: 3,
      featuresCount: 24,
      createdAt: "2026-06-05",
    },
    {
      id: "mod-03",
      moduleKey: "trade",
      moduleName: "محرك التجارة والاشتراكات (Trade Engine)",
      description: "محرك التجارة الإلكترونية، نقاط البيع، كتالوج المنتجات، والفوترة المتكررة بمتعدد العملات.",
      status: "ACTIVE",
      rank: 3,
      tiersCount: 3,
      featuresCount: 32,
      createdAt: "2026-06-10",
    },
    {
      id: "mod-04",
      moduleKey: "worker",
      moduleName: "محرك المهام والتحليلات (Worker & Analytics)",
      description: "معالجة الطوابير الخلفية، الأتمتة المجدولة، وتقارير الذكاء الاصطناعي التنبؤية.",
      status: "BETA",
      rank: 4,
      tiersCount: 2,
      featuresCount: 12,
      createdAt: "2026-07-01",
    },
  ]);

  const filteredModules = modules.filter((m) => {
    const matchesSearch =
      search === "" ||
      m.moduleName.toLowerCase().includes(search.toLowerCase()) ||
      m.moduleKey.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const summaryMetrics = {
    totalModules: modules.length,
    activeTiers: modules.reduce((acc, m) => acc + m.tiersCount, 0),
    totalFeatures: modules.reduce((acc, m) => acc + m.featuresCount, 0),
    activeCurrencies: 5,
  };

  const moveRankUp = (index: number) => {
    if (index <= 0) return;
    setModules((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      // Re-assign ranks
      return next.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });
  };

  const moveRankDown = (index: number) => {
    if (index >= modules.length - 1) return;
    setModules((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      // Re-assign ranks
      return next.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newName) return;

    const newRecord: ModuleRecord = {
      id: `mod-${Date.now()}`,
      moduleKey: newKey.toLowerCase().trim(),
      moduleName: newName.trim(),
      description: newDesc.trim() || "وصف الموديول الجديد",
      status: "ACTIVE",
      rank: modules.length + 1,
      tiersCount: 1,
      featuresCount: 5,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setModules((prev) => [...prev, newRecord]);
    setNewKey("");
    setNewName("");
    setNewDesc("");
    setIsCreateOpen(false);
  };

  return {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    isCreateOpen,
    setIsCreateOpen,
    newKey,
    setNewKey,
    newName,
    setNewName,
    newDesc,
    setNewDesc,
    modules: filteredModules,
    summaryMetrics,
    moveRankUp,
    moveRankDown,
    handleCreateSubmit,
  };
}
