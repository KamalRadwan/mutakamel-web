"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { safeStorage } from "@/lib/safeStorage";
import { ar, Dictionary } from "./dictionaries/ar";
import { en } from "./dictionaries/en";

export type Language = "ar" | "en";

interface I18nContextType {
  lang: Language;
  dir: "rtl" | "ltr";
  t: Dictionary;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ar");

  useEffect(() => {
    const savedLang = (safeStorage.getItem("tenant_lang") as Language) || "ar";
    document.documentElement.setAttribute("dir", savedLang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", savedLang);
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLangState(savedLang);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    safeStorage.setItem("tenant_lang", newLang);
    document.documentElement.setAttribute("dir", newLang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", newLang);
  };

  const toggleLang = () => {
    setLang(lang === "ar" ? "en" : "ar");
  };

  const dictionary = lang === "ar" ? ar : en;
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ lang, dir, t: dictionary, setLang, toggleLang }}>
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
