"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { safeStorage } from "@/lib/safeStorage";

export type Density = "compact" | "standard" | "comfortable";

const STORAGE_KEY = "tenant_density";

// Same reason as ThemeProvider's: localStorage.setItem fires "storage" only in
// OTHER tabs, so a same-tab change needs its own event to reach subscribers.
const LOCAL_CHANGE_EVENT = "tenant-density-change";

// The shipped default is STANDARD, and globals.css already carries 1 on
// :root — see docs/build/DECISIONS.md#d2--ui-scale. So standard is expressed by
// REMOVING the inline property, never by writing "1" a second time. One
// number, one home; a second copy is a number that can drift.
//
// The default used to be compact (0.9). That one multiplier is why the tenant
// portal rendered about 10% smaller than the admin portal at every control,
// row and chrome edge; adopting admin's geometry means adopting its scale,
// which is 1. Compact is still here, one click away in the user menu, for the
// operator who wants more rows on a 1366x768 laptop.
export const DENSITY_SCALE: Record<Exclude<Density, "standard">, string> = {
  compact: "0.9",
  comfortable: "1.1",
};

export const DENSITY_OPTIONS: readonly Density[] = ["compact", "standard", "comfortable"];

function isDensity(value: string | null): value is Density {
  return value === "compact" || value === "standard" || value === "comfortable";
}

function readDensity(): Density {
  const stored = safeStorage.getItem(STORAGE_KEY);
  return isDensity(stored) ? stored : "standard";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_CHANGE_EVENT, callback);
  };
}

// Matches both the stylesheet default and the bootstrap script's no-op path,
// so the first client render agrees with the server's.
function getServerSnapshot(): Density {
  return "standard";
}

/**
 * Writes the density to the document. Exported because the pre-hydration
 * bootstrap in `src/app/layout.tsx` performs the identical write inline, and
 * the two must not drift — the test asserts they agree.
 */
export function applyDensity(density: Density): void {
  const root = document.documentElement;
  if (density === "standard") {
    root.style.removeProperty("--ui-scale");
    return;
  }
  root.style.setProperty("--ui-scale", DENSITY_SCALE[density]);
}

interface DensityContextValue {
  density: Density;
  setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextValue | undefined>(undefined);

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const density = useSyncExternalStore(subscribe, readDensity, getServerSnapshot);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const setDensity = (next: Density) => {
    if (next === "standard") {
      safeStorage.removeItem(STORAGE_KEY);
    } else {
      safeStorage.setItem(STORAGE_KEY, next);
    }
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  };

  return <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);
  if (!context) {
    throw new Error("useDensity must be used within a DensityProvider");
  }
  return context;
}
