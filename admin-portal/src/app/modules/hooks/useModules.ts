"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { ModuleView } from "@/types/module";
import { useToast } from "@/components/ui/ToastContext";

export interface ModuleRecord {
  id: string;
  moduleKey: string;
  moduleName: string;
  description: string;
  status: "ACTIVE" | "BETA" | "DEPRECATED";
  rank: number;
  createdAt: string;
}

export function useModules() {
  const { t, lang } = useI18n();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State for Create Module
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [activeCurrenciesCount, setActiveCurrenciesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchModules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch modules list
      const response = await axiosClient.get(`/api/admin/core/v1/modules?page=1&limit=100`);
      const items: ModuleView[] = response.data?.items || response.data?.data || (Array.isArray(response.data) ? response.data : []);

      const mapped: ModuleRecord[] = items.map((m) => ({
        id: m.id,
        moduleKey: m.key,
        moduleName: m.name,
        description: m.description || "",
        status: m.isActive ? "ACTIVE" : "DEPRECATED",
        rank: m.rank,
        createdAt: m.createdAt,
      }));

      // Set modules and ensure they are sorted by rank
      setModules(mapped.sort((a, b) => a.rank - b.rank));
    } catch (err: any) {
      console.warn("Failed to fetch modules", err.message);
      setError(err.response?.data?.message || "Failed to fetch modules.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCurrencies = useCallback(async () => {
    try {
      const response = await axiosClient.get(`/api/admin/core/v1/billing/currency-rates`);
      const data = response.data?.items || response.data?.data || (Array.isArray(response.data) ? response.data : []);
      setActiveCurrenciesCount(data.length);
    } catch (err) {
      // Non-fatal
      console.warn("Failed to load currency rates");
    }
  }, []);

  useEffect(() => {
    fetchModules();
    fetchCurrencies();
  }, [fetchModules, fetchCurrencies]);

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
    activeCurrencies: activeCurrenciesCount,
  };

  const reorderModules = async (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) return;
    if (sourceIndex >= filteredModules.length || targetIndex >= filteredModules.length) return;

    const source = filteredModules[sourceIndex];
    const target = filteredModules[targetIndex];

    setModules((prev) => {
      const next = [...prev];
      const sourceRealIdx = next.findIndex((m) => m.id === source.id);
      const targetRealIdx = next.findIndex((m) => m.id === target.id);

      if (sourceRealIdx === -1 || targetRealIdx === -1) return prev;

      const [moved] = next.splice(sourceRealIdx, 1);
      next.splice(targetRealIdx, 0, moved);
      return next.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });

    try {
      await axiosClient.patch(`/api/admin/core/v1/modules/${source.id}/rank`, {
        targetId: target.id,
      });
      toast.success(
        lang === "ar" ? "تم تعديل الترتيب" : "Rank Updated",
        lang === "ar" ? `تم نقل الموديول (${source.moduleName}) بنجاح` : `Moved (${source.moduleName}) successfully`
      );
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل إعادة الترتيب" : "Reorder Failed", err.response?.data?.message || err.message);
      await fetchModules();
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newName) return;

    setIsSubmitting(true);
    try {
      await axiosClient.post(`/api/admin/core/v1/modules`, {
        key: newKey.toLowerCase().trim(),
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        isActive: true,
      });
      await fetchModules();
      toast.success(
        lang === "ar" ? "تم تسجيل الموديول" : "Module Registered",
        lang === "ar" ? `تم تسجيل الموديول (${newName}) بنجاح` : `Module (${newName}) registered successfully`
      );
      setNewKey("");
      setNewName("");
      setNewDesc("");
      setIsCreateOpen(false);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل تسجيل الموديول" : "Create Failed", err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
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
    isLoading,
    error,
    isSubmitting,
    reorderModules,
    handleCreateSubmit,
  };
}
