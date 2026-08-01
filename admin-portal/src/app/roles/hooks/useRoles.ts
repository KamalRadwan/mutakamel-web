"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { useToast } from "@/components/ui/ToastContext";

export interface AdminRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
}

export function useRoles() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [isSystemFilter, setIsSystemFilter] = useState("ALL");

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeModalRoleId, setActiveModalRoleId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100"); // Standard pagination
      if (isSystemFilter !== "ALL") params.set("isSystem", isSystemFilter === "TRUE" ? "true" : "false");
      // Note: simple search might be handled locally if API doesn't support generic text search,
      // but if the API supports it, we'd add it here. For now, we will filter by search locally if needed,
      // or assume the API handles `search` param. We'll pass it to API just in case.
      if (search) params.set("search", search);

      const res = await axiosClient.get(`/api/admin/core/v1/roles?${params.toString()}`);
      
      const payloadData = res.data?.data;
      const payloadMeta = res.data?.meta;

      let fetchedRoles: AdminRole[] = [];
      let total = 0;

      if (Array.isArray(payloadData)) {
        fetchedRoles = payloadData;
        total = payloadMeta?.total ?? fetchedRoles.length;
      } else if (payloadData?.items) {
        fetchedRoles = payloadData.items;
        total = payloadData.total ?? fetchedRoles.length;
      }

      // Fallback local search if API doesn't support 'search' param natively
      if (search) {
        fetchedRoles = fetchedRoles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
      }
      
      setRoles(fetchedRoles);
      setTotalItems(total);
    } catch (error) {
      toast.error(
        lang === "ar" ? "فشل جلب الأدوار" : "Failed to fetch roles",
        lang === "ar" ? "تعذر تحميل قائمة الأدوار من الخادم." : "Could not load the roles list from the server."
      );
    } finally {
      setIsLoading(false);
    }
  }, [isSystemFilter, search, lang, toast]);

  useEffect(() => {
    // Debounce for search
    const timer = setTimeout(() => {
      fetchRoles();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  const activeModalRole = roles.find((r) => r.id === activeModalRoleId);

  const openDeleteModal = (id: string) => {
    setActiveModalRoleId(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setActiveModalRoleId(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!activeModalRoleId) return;
    try {
      await axiosClient.delete(`/api/admin/core/v1/roles/${activeModalRoleId}`);
      toast.success(
        lang === "ar" ? "تم الحذف" : "Deleted",
        lang === "ar" ? "تم حذف الدور بنجاح." : "Role deleted successfully."
      );
      closeDeleteModal();
      fetchRoles(); // Refresh the list
    } catch (error: any) {
      toast.error(
        lang === "ar" ? "فشل الحذف" : "Delete failed",
        error?.response?.data?.message || (lang === "ar" ? "حدث خطأ أثناء حذف الدور." : "An error occurred while deleting the role.")
      );
    }
  };

  return {
    t,
    lang,
    search,
    setSearch,
    isSystemFilter,
    setIsSystemFilter,
    roles,
    totalItems,
    isLoading,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isDeleteModalOpen,
    openDeleteModal,
    closeDeleteModal,
    activeModalRole,
    confirmDelete,
    refreshRoles: fetchRoles, // Exposing this in case the Create Modal needs to refresh the list
  };
}
