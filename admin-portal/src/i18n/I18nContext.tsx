"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
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
const LANGUAGE_STORAGE_KEY = "app_lang";
const LANGUAGE_CHANGE_EVENT = "mutakamel:language-change";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(
    subscribeToLanguage,
    readStoredLanguage,
    defaultLanguage,
  );

  useEffect(() => {
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const setLang = (newLang: Language) => {
    safeStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    }
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

function defaultLanguage(): Language {
  return "ar";
}

function readStoredLanguage(): Language {
  return safeStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ar";
}

function subscribeToLanguage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
