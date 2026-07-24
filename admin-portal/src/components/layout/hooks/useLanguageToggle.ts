"use client";

import { useI18n } from "@/i18n/I18nContext";

export function useLanguageToggle() {
  const { lang, toggleLang } = useI18n();

  return {
    lang,
    toggleLanguage: toggleLang,
    title: lang === "ar" ? "Switch to English" : "التحويل للغة العربية",
    buttonLabel: lang === "ar" ? "English" : "العربية",
  };
}
