"use client";

import { useI18n } from "@/i18n/I18nContext";

export function useLanguageToggle() {
  const { lang, toggleLang, t } = useI18n();

  return {
    lang,
    toggleLanguage: toggleLang,
    title: t.common.langSwitchTitle,
    buttonLabel: t.common.langSwitch,
  };
}
