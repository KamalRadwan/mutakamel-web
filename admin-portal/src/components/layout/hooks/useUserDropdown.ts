"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import { adminCan } from "@/lib/auth/rbac";

export function useUserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const toast = useToast();

  const currentAdmin = {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    tier: user?.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
    roleName: user?.role?.name || t.common.superAdminRole,
  };

  const close = () => setIsOpen(false);

  const handleLogout = async () => {
    close();
    try {
      await logout();
    } catch {
      toast.error(t.common.signOutFailedTitle, t.common.signOutFailedDescription);
    }
  };
  const canViewRoles = adminCan(user, "admin.roles.read");
  const canViewSettings = adminCan(user, "admin.settings.read");

  return {
    t,
    isOpen,
    currentAdmin,
    canViewRoles,
    canViewSettings,
    setIsOpen,
    close,
    handleLogout,
  };
}
