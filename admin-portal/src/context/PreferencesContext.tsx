"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";

import { axiosClient } from "@/lib/api/axiosClient";
import { useAuth } from "@/context/AuthContext";
import type { SuccessResponse } from "@/types/common";

/**
 * UI-010. The profile form saved `themeKey` and `tableDensity` and nothing read
 * them back. A source-wide search found the two names only in that form, its
 * hook, the API types and a read-only summary card: an administrator could set
 * a preference, see it persist, sign in again, and find the portal unchanged.
 *
 * This is the missing consumer. It reads the saved profile once the session is
 * authenticated and applies it.
 *
 * **Precedence, which had to be decided rather than discovered.** The saved
 * profile is an account preference; the header toggle is a this-browser, now
 * override, and next-themes already persists it per browser. So the profile is
 * applied when its value *changes* - which includes the first load after
 * signing in - and the local toggle wins from then until the profile changes
 * again. Applying the profile on every render would fight the toggle; never
 * applying it is the defect.
 */
export type TableDensity = "compact" | "comfortable";

export interface Preferences {
  tableDensity: TableDensity;
  /** Re-reads the saved profile, so a save on the profile page takes effect. */
  refresh: () => Promise<void>;
}

const PreferencesContext = createContext<Preferences | null>(null);

/** Tolerates no provider, so a component can be rendered in isolation. */
export function useOptionalPreferences(): Preferences | null {
  return useContext(PreferencesContext);
}

export function useTableDensity(): TableDensity {
  return useOptionalPreferences()?.tableDensity ?? "compact";
}

interface ProfilePreferences {
  themeKey?: string | null;
  extensions?: Record<string, unknown> | null;
}

const THEMES = new Set(["dark", "light"]);
const DENSITIES = new Set<TableDensity>(["compact", "comfortable"]);

/** Only a value the portal can actually render; anything else is ignored. */
function readTheme(profile: ProfilePreferences): string | null {
  const value = profile.themeKey;
  return typeof value === "string" && THEMES.has(value) ? value : null;
}

function readDensity(profile: ProfilePreferences): TableDensity | null {
  const value = profile.extensions?.["tableDensity"];
  return typeof value === "string" && DENSITIES.has(value as TableDensity)
    ? (value as TableDensity)
    : null;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [tableDensity, setTableDensity] = useState<TableDensity>("compact");
  // The last theme this provider applied. A saved theme is applied when it
  // differs from this, never merely because it exists, so the header toggle
  // keeps whatever the reader chose afterwards.
  const appliedTheme = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await axiosClient.get<
        SuccessResponse<ProfilePreferences>
      >("/api/admin/core/v1/users/me/profile");
      const profile = response.data.data;
      const density = readDensity(profile);
      if (density) setTableDensity(density);
      const theme = readTheme(profile);
      if (theme && theme !== appliedTheme.current) {
        appliedTheme.current = theme;
        setTheme(theme);
      }
    } catch {
      // The portal is usable without a preference; the profile page reports
      // its own read failures. Falling back to the painted default is right.
    }
  }, [setTheme]);

  const identityId = user?.id ?? null;
  useEffect(() => {
    if (!identityId) {
      appliedTheme.current = null;
      return;
    }
    // Deferred out of the effect body: `react-hooks/set-state-in-effect`
    // refuses a synchronous call that can settle into setState, and the read is
    // a network round trip that has no reason to be synchronous anyway. This is
    // the shape the users summary already uses for the same rule.
    queueMicrotask(() => {
      void refresh();
    });
  }, [identityId, refresh]);

  return (
    <PreferencesContext.Provider value={{ tableDensity, refresh }}>
      {children}
    </PreferencesContext.Provider>
  );
}
