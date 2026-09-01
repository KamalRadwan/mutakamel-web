"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { appForPath, writeStoredApp } from "./nav-app";
import type { NavAppId } from "./nav-config";

export interface ActiveApp {
  /** The app the sidebar is scoped to right now. */
  app: NavAppId;
  /** Record a deliberate choice, and persist it for the next visit. */
  selectApp: (app: NavAppId) => void;
}

/**
 * Route first, stored preference second.
 *
 * The route wins on every render where it can answer, so this holds no
 * "current app" state that could go stale: `preferred` is consulted only where
 * `appForPath` returns null. That ordering is the whole point — a stored
 * preference that outranked the route would frame `/crm/leads` in whatever
 * sidebar this browser last chose.
 *
 * Because the route outranks it, `selectApp` alone cannot move the user off an
 * app-owned route; `AppSwitcher` navigates into the chosen app as well. What
 * this does persist is the answer for the app-less routes — `/`, `/search`,
 * `/getting-started` — which is where the preference is the only input.
 *
 * `initialApp` comes from the `tenant_app` cookie, read server-side in
 * `app/(tenant)/layout.tsx`, so the first painted frame is already right.
 */
export function useActiveApp(initialApp: NavAppId): ActiveApp {
  const pathname = usePathname();
  const [preferred, setPreferred] = useState<NavAppId>(initialApp);

  const selectApp = useCallback((next: NavAppId) => {
    setPreferred(next);
    writeStoredApp(next);
  }, []);

  return { app: appForPath(pathname) ?? preferred, selectApp };
}
