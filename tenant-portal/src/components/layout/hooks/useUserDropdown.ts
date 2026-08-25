"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";

export function useUserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { t, lang } = useI18n();
  const { user, logout } = useTenantAuth();
  const toast = useToast();

  const currentUser = {
    firstName: user?.firstName ?? "—",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    tier: user?.isTenantOwner ? "TENANT_OWNER" : "TENANT_USER",
    roleName: user?.isTenantOwner
      ? lang === "ar" ? "مالك المستأجر" : "Tenant Owner"
      : lang === "ar" ? "مستخدم" : "User",
  };

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  const handleLogout = async () => {
    close();
    try {
      await logout();
    } catch {
      toast.error(
        lang === "ar" ? "تعذر تسجيل الخروج" : "Sign-out failed",
        lang === "ar"
          ? "لم تُنهَ الجلسة على الخادم. ما زلت مسجلاً للدخول ويمكنك المحاولة مرة أخرى."
          : "The server session was not ended. You remain signed in and can try again.",
      );
    }
  };

  return {
    t,
    lang,
    isOpen,
    currentUser,
    toggleOpen,
    close,
    handleLogout,
  };
}
