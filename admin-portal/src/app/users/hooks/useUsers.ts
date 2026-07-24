"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export interface AdminUserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tier: "SUPER_ADMIN" | "ADMIN" | "USER";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  sipExtension?: string | null;
  rolesCount: number;
  createdAt: string;
  lastActiveAt?: string | null;
}

const mockAdminUsers: AdminUserItem[] = [
  {
    id: "usr-1",
    email: "kamal.radwan@mutakamel.ai",
    firstName: "كمال",
    lastName: "رضوان",
    tier: "SUPER_ADMIN",
    status: "ACTIVE",
    sipExtension: "1001",
    rolesCount: 3,
    createdAt: "2026-01-01T08:00:00Z",
    lastActiveAt: "2026-07-24T03:45:00Z",
  },
  {
    id: "usr-2",
    email: "sara.ahmed@mutakamel.ai",
    firstName: "سارة",
    lastName: "أحمد",
    tier: "ADMIN",
    status: "ACTIVE",
    sipExtension: "1002",
    rolesCount: 2,
    createdAt: "2026-02-10T10:30:00Z",
    lastActiveAt: "2026-07-23T18:20:00Z",
  },
  {
    id: "usr-3",
    email: "tarek.mahmoud@mutakamel.ai",
    firstName: "طارق",
    lastName: "محمود",
    tier: "USER",
    status: "INVITED",
    sipExtension: null,
    rolesCount: 1,
    createdAt: "2026-07-20T14:15:00Z",
    lastActiveAt: null,
  },
  {
    id: "usr-4",
    email: "omar.hassan@mutakamel.ai",
    firstName: "عمر",
    lastName: "حسن",
    tier: "ADMIN",
    status: "SUSPENDED",
    sipExtension: "1004",
    rolesCount: 1,
    createdAt: "2026-03-15T09:00:00Z",
    lastActiveAt: "2026-07-10T11:00:00Z",
  },
];

export function useUsers() {
  const router = useRouter();
  const { lang, t } = useI18n();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tierFilter, setTierFilter] = useState("ALL");

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeModalUserId, setActiveModalUserId] = useState<string | null>(null);
  const [modalActionType, setModalActionType] = useState<"suspend" | "activate" | "delete" | null>(null);

  const users = mockAdminUsers.filter((u) => {
    if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
    if (tierFilter !== "ALL" && u.tier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
      if (!fullName.includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const summaryMetrics = {
    total: mockAdminUsers.length,
    active: mockAdminUsers.filter((u) => u.status === "ACTIVE").length,
    invited: mockAdminUsers.filter((u) => u.status === "INVITED").length,
    suspended: mockAdminUsers.filter((u) => u.status === "SUSPENDED").length,
    superAdmins: mockAdminUsers.filter((u) => u.tier === "SUPER_ADMIN").length,
  };

  const activeModalUser = mockAdminUsers.find((u) => u.id === activeModalUserId);

  const openModal = (userId: string, action: "suspend" | "activate" | "delete") => {
    setActiveModalUserId(userId);
    setModalActionType(action);
  };

  const closeModal = () => {
    setActiveModalUserId(null);
    setModalActionType(null);
  };

  const confirmModalAction = () => {
    console.log(`Action ${modalActionType} on user ${activeModalUserId}`);
    closeModal();
  };

  return {
    lang,
    t,
    router,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    tierFilter,
    setTierFilter,
    users,
    summaryMetrics,
    isInviteModalOpen,
    setIsInviteModalOpen,
    activeModalUser,
    modalActionType,
    openModal,
    closeModal,
    confirmModalAction,
  };
}
