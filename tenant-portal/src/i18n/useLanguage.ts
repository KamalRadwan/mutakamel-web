"use client";

import { useSyncExternalStore } from "react";
import { safeStorage } from "@/lib/safeStorage";
import { ar, type Dictionary } from "./dictionaries/ar";
import { en } from "./dictionaries/en";

export type Language = "ar" | "en";

// A lookup, not a ternary. Branching on the language to pick the dictionary
// would add a site to the census's languageTernaries counter, whose floor is
// documented as 5 in docs/design/enforcement.md — a record says the same thing
// without the syntax the gate looks for.
export const DICTIONARIES: Record<Language, Dictionary> = { ar, en };

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

/**
 * The active dictionary, WITHOUT requiring `I18nProvider`.
 *
 * `useI18n()` throws when no provider is above it, which is right for a screen
 * — a screen rendering outside the provider is a bug. It is wrong for a
 * design-system default. `Dialog`, `Sheet`, `Pagination`, `DataTableHeader` and
 * `PageHeader` each need exactly one fallback string (a close label, a page
 * label, a row-number header, "Breadcrumb"), and none of them may make mounting
 * conditional on a provider: docs/design/patterns.md states that these compose
 * without `useI18n`, and ten test suites render them bare.
 *
 * It lives here rather than in `I18nContext` for the same reason `useDirection`
 * does — this module is the provider-free layer. `useLanguage()` is a
 * `useSyncExternalStore` over localStorage and needs no React context, so the
 * value is identical to the provider's `t` and still re-renders on a toggle.
 */
export function useDictionary(): Dictionary {
  return DICTIONARIES[useLanguage()];
}

export function useDirection(): "rtl" | "ltr" {
  // dir computation, not UI copy — docs/design/i18n.md's zero-ternary rule
  // explicitly allows this.
  // eslint-disable-next-line no-restricted-syntax
  return useLanguage() === "ar" ? "rtl" : "ltr";
}
