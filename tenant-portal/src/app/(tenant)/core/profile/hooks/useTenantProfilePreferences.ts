"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme, type Theme } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { setLanguage, type Language } from "@/i18n/useLanguage";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchMyProfile,
  updateMyProfile,
  type TenantProfile,
} from "../../contracts/user-subresource-contract";

/**
 * `UpdateTenantProfileDto.language` is validated against `SUPPORTED_LANGUAGES`
 * (`shared-libs/packages/i18n/src/enums/language.enum.ts`) — `en` and `ar`, the
 * same two the portal ships. Anything else is a 400.
 */
const PROFILE_LANGUAGES: readonly Language[] = ["ar", "en"];

/**
 * `themeKey` is a free `varchar(64)` server-side, so the portal's own three
 * values are what it writes; a value it does not recognise is kept, shown
 * verbatim and never silently rewritten.
 */
const PORTAL_THEMES: readonly Theme[] = ["system", "light", "dark"];

function readTheme(value: string | null): Theme | null {
  return PORTAL_THEMES.find((theme) => theme === value) ?? null;
}

function readLanguage(value: string | null): Language | null {
  return PROFILE_LANGUAGES.find((language) => language === value) ?? null;
}

export function useTenantProfilePreferences() {
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setLoadError(null);
      fetchMyProfile(controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setProfile(result);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setProfile(null);
          setLoadError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * The local store is applied first and the server call mirrors it.
   *
   * DECISIONS.md D-4.17: the pre-hydration bootstrap in `app/layout.tsx` reads
   * `localStorage` before React exists, so a server round-trip cannot drive the
   * first painted frame without a flash. The device store therefore wins for
   * rendering, and the profile row is the durable copy that follows the user to
   * another device. A failed write leaves the local choice standing and says so.
   */
  const persist = useCallback(
    async (patch: { themeKey?: Theme; language?: Language }) => {
      if (patch.themeKey) setTheme(patch.themeKey);
      if (patch.language) setLanguage(patch.language);
      setIsSubmitting(true);
      setWriteError(null);
      try {
        setProfile(await updateMyProfile(patch));
        setSavedAt(new Date().toISOString());
      } catch (error) {
        setWriteError(normalizeApiError(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [setTheme],
  );

  return {
    t,
    lang,
    theme,
    profile,
    isLoading,
    loadError,
    writeError,
    isSubmitting,
    savedAt,
    reload,
    languages: PROFILE_LANGUAGES,
    themes: PORTAL_THEMES,
    /** null when the server holds a theme this portal has no control for. */
    serverTheme: readTheme(profile?.themeKey ?? null),
    serverLanguage: readLanguage(profile?.language ?? null),
    setThemePreference: (next: Theme) => void persist({ themeKey: next }),
    setLanguagePreference: (next: Language) => void persist({ language: next }),
  };
}
