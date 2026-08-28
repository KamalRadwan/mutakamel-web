"use client";

import React, { createContext, useContext } from "react";
import { ar, Dictionary } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import { type Language, setLanguage, useLanguage } from "./useLanguage";

export type { Language };

interface I18nContextType {
  lang: Language;
  dir: "rtl" | "ltr";
  t: Dictionary;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useLanguage();
  // dir/lang-value computation, not UI copy — docs/design/i18n.md's
  // zero-ternary rule explicitly allows this.
  // eslint-disable-next-line no-restricted-syntax
  const dir = lang === "ar" ? "rtl" : "ltr";
  const dictionary = lang === "ar" ? ar : en;

  const toggleLang = () => {
    // eslint-disable-next-line no-restricted-syntax -- toggling the lang value, not picking display text
    setLanguage(lang === "ar" ? "en" : "ar");
  };

  return (
    <I18nContext.Provider
      value={{ lang, dir, t: dictionary, setLang: setLanguage, toggleLang }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
