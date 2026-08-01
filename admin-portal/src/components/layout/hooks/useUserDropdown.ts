"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";

export function useUserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();
  const { user, logout } = useAuth();

  const currentAdmin = {
    firstName: user?.firstName || t.common.adminUser.split(" ")[0] || "Mona",
    lastName: user?.lastName || t.common.adminUser.split(" ")[1] || "Ali",
    email: user?.email || "mona.ali@mutakamel.ai",
    tier: user?.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
    roleName: user?.role?.name || t.common.superAdminRole,
  };

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  const handleLogout = async () => {
    close();
    await logout();
  };

  return {
    t,
    isOpen,
    currentAdmin,
    toggleOpen,
    close,
    handleLogout,
  };
}
