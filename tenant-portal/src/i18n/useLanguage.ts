"use client";

import { useSyncExternalStore } from "react";
import { safeStorage } from "@/lib/safeStorage";

export type Language = "ar" | "en";

const STORAGE_KEY = "tenant_lang";

// localStorage.setItem does not fire a "storage" event in the tab that wrote
// it, only in other tabs. This event is what lets a same-tab toggle update
// every useLanguage() subscriber without a reload.
const LOCAL_CHANGE_EVENT = "tenant-lang-change";

function readLanguage(): Language {
  return safeStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
}

export function setLanguage(lang: Language): void {
  safeStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_CHANGE_EVENT, callback);
  };
}

// Matches the server-rendered <html lang="ar">, so the first client render
// already agrees with what src/app/layout.tsx's bootstrap script wrote.
function getServerSnapshot(): Language {
  return "ar";
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, readLanguage, getServerSnapshot);
}

export function useDirection(): "rtl" | "ltr" {
  return useLanguage() === "ar" ? "rtl" : "ltr";
}
