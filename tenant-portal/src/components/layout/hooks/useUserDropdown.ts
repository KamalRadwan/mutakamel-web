"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export function useUserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { t, lang } = useI18n();

  const currentUser = {
    firstName: lang === "ar" ? "كمال" : "Kamal",
    lastName: lang === "ar" ? "رضوان" : "Radwan",
    email: "kamal.radwan@mutakamel.ai",
    tier: "TENANT_ADMIN",
    roleName: lang === "ar" ? "مدير النظام" : "Tenant Admin",
  };

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  const handleLogout = async () => {
    close();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
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
