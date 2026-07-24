"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export interface AdminRole {
  id: string;
  name: string;
  description?: string;
  type: "SUPER_ADMIN" | "ADMIN" | "USER";
  isSystem: boolean;
  createdAt: string;
}

// Mock Data for UI development
const mockRoles: AdminRole[] = [
  { id: "role-1", name: "Super Administrator", description: "Full system access.", type: "SUPER_ADMIN", isSystem: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "role-2", name: "Billing Admin", description: "Manage subscriptions.", type: "ADMIN", isSystem: false, createdAt: "2026-02-15T10:00:00Z" },
  { id: "role-3", name: "Support Agent", description: "View-only access for support.", type: "USER", isSystem: false, createdAt: "2026-03-20T14:30:00Z" },
];

export function useRoles() {
  const router = useRouter();
  const { lang, t } = useI18n();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isSystemFilter, setIsSystemFilter] = useState("ALL");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeModalRoleId, setActiveModalRoleId] = useState<string | null>(null);

  const roles = mockRoles.filter((r) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (isSystemFilter !== "ALL") {
      const wantsSystem = isSystemFilter === "TRUE";
      if (r.isSystem !== wantsSystem) return false;
    }
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeModalRole = mockRoles.find((r) => r.id === activeModalRoleId);

  const openDeleteModal = (id: string) => {
    setActiveModalRoleId(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setActiveModalRoleId(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = () => {
    console.log("Deleting role", activeModalRoleId);
    closeDeleteModal();
  };

  return {
    t,
    lang,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    isSystemFilter,
    setIsSystemFilter,
    roles,
    totalItems: mockRoles.length,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isDeleteModalOpen,
    openDeleteModal,
    closeDeleteModal,
    activeModalRole,
    confirmDelete,
  };
}
