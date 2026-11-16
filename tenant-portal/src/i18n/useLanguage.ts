"use client";

import { createContext, use, useContext, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "./dictionaries/ar";
import {
  getLanguageSnapshot,
  loadLanguageSnapshot,
  readLanguage,
  seedLanguageSnapshot,
  subscribeLanguage,
  type Language,
  type LanguageSnapshot,
} from "./dictionary-store";

export { hydrateAccountLanguage, setLanguage } from "./dictionary-store";
export type { Language } from "./dictionary-store";

export const LanguageSnapshotContext = createContext<LanguageSnapshot | null>(null);

export function useLanguageSnapshot(initial?: LanguageSnapshot): LanguageSnapshot | null {
  const inherited = useContext(LanguageSnapshotContext);
  const [serverSnapshot] = useState(() => {
    const snapshot = initial ?? inherited;
    if (snapshot) seedLanguageSnapshot(snapshot);
    return snapshot;
  });
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    () => serverSnapshot,
  ) ?? serverSnapshot;
}

export function useLanguage(): Language {
  return useLanguageSnapshot()?.lang ?? readLanguage();
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
 * does — this module is the provider-free layer. Normal routes receive their
 * snapshot from the server. Standalone boundaries load their selected copy
 * on demand; no synchronous fallback imports both languages into every route.
 */
export function useDictionary(): Dictionary {
  const snapshot = useLanguageSnapshot();
  if (snapshot) return snapshot.dictionary;
  return use(loadLanguageSnapshot(readLanguage())).dictionary;
}

export function useDirection(): "rtl" | "ltr" {
  // dir computation, not UI copy — docs/design/i18n.md's zero-ternary rule
  // explicitly allows this.
  // eslint-disable-next-line no-restricted-syntax
  return useLanguage() === "ar" ? "rtl" : "ltr";
}
