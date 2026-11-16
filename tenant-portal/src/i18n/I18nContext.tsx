"use client";

import React, { createContext, Suspense, use, useContext } from "react";
import type { Dictionary } from "./dictionaries/ar";
import {
  languageOrDefault,
  loadLanguageSnapshot,
  peekLanguageSnapshot,
  readLanguage,
} from "./dictionary-store";
import { LanguageSnapshotContext, type Language, setLanguage, useLanguageSnapshot } from "./useLanguage";

export type { Language };

interface I18nContextType {
  lang: Language;
  dir: "rtl" | "ltr";
  t: Dictionary;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: React.ReactNode;
  /** The server-selected language. Only the language crosses the RSC
   * boundary: dictionaries hold formatter functions, which React cannot
   * serialize into a client prop. */
  initialLanguage?: Language;
}

// Start the browser download of the server-rendered language (and a
// different stored preference) as soon as this module runs, in parallel with
// hydration, instead of when the provider first renders. A failure here is
// retried by the render below.
if (typeof document !== "undefined") {
  for (const lang of new Set([languageOrDefault(document.documentElement.lang), readLanguage()])) {
    loadLanguageSnapshot(lang).catch(() => undefined);
  }
}

export function I18nProvider(props: I18nProviderProps) {
  return <Suspense fallback={null}><LoadedI18nProvider {...props} /></Suspense>;
}

function LoadedI18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const inherited = useContext(LanguageSnapshotContext);
  const selected = initialLanguage ?? readLanguage();
  // A nested provider reuses its parent's copy; the root reads the loaded
  // copy synchronously when it can and suspends only on a cold chunk.
  const initial = inherited ?? peekLanguageSnapshot(selected) ?? use(loadLanguageSnapshot(selected));
  const resolved = useLanguageSnapshot(initial) ?? initial;
  const { lang, dictionary } = resolved;
  // dir/lang-value computation, not UI copy — docs/design/i18n.md's
  // zero-ternary rule explicitly allows this.
  // eslint-disable-next-line no-restricted-syntax
  const dir = lang === "ar" ? "rtl" : "ltr";

  const toggleLang = () => {
    // eslint-disable-next-line no-restricted-syntax -- toggling the lang value, not picking display text
    setLanguage(lang === "ar" ? "en" : "ar");
  };

  return (
    <LanguageSnapshotContext.Provider value={resolved}>
      <I18nContext.Provider
        value={{ lang, dir, t: dictionary, setLang: setLanguage, toggleLang }}
      >
        {children}
      </I18nContext.Provider>
    </LanguageSnapshotContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
