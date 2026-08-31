"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { safeStorage } from "@/lib/safeStorage";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "tenant_theme";

// localStorage.setItem does not fire a "storage" event in the tab that wrote
// it, only in other tabs. This event is what lets a same-tab toggle update
// every subscriber without a reload.
const LOCAL_CHANGE_EVENT = "tenant-theme-change";

function readTheme(): Theme {
  const stored = safeStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "system";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && prefersDark());
}

function subscribe(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_CHANGE_EVENT, callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_CHANGE_EVENT, callback);
    media.removeEventListener("change", callback);
  };
}

// Matches src/app/layout.tsx's bootstrap script default when no explicit
// choice is stored — see docs/design/theming.md#no-flash--the-mechanism.
function getServerSnapshot(): Theme {
  return "system";
}

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);
  const isDark = useSyncExternalStore(
    subscribe,
    () => resolveIsDark(theme),
    () => false,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const setTheme = (next: Theme) => {
    if (next === "system") {
      safeStorage.removeItem(STORAGE_KEY);
    } else {
      safeStorage.setItem(STORAGE_KEY, next);
    }
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
