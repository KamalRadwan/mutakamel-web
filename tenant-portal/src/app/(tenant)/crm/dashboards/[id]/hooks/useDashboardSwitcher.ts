"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  DASHBOARDS_NAVIGATION_PATH,
  parseNavigationResponse,
  type DashboardNavigationItem,
} from "../../dashboard-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;

/**
 * `GET /dashboards/navigation` — the switcher's list.
 *
 * A narrower projection than `GET /dashboards`, already ordered by the
 * server's own preference rule (default first, then favourites, then
 * last-opened, then updated). It is used here rather than the list response so
 * a detail screen does not pull every dashboard's `defaultFilters` and
 * placements count just to fill a `Select`.
 *
 * A failure leaves the switcher out. It is navigation, not content, and the
 * dashboard on screen is already loaded.
 */
export function useDashboardSwitcher() {
  const [items, setItems] = useState<DashboardNavigationItem[]>([]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const response = await axiosClient.get<unknown>(DASHBOARDS_NAVIGATION_PATH, READ_CONFIG);
      setItems(parseNavigationResponse(response.data).items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { items };
}
