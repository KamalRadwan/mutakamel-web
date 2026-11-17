"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  DASHBOARDS_DEFAULT_PATH,
  DASHBOARDS_NAVIGATION_PATH,
  parseDashboardDetailResponse,
  parseNavigationResponse,
} from "../../dashboards/dashboard-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;

export function useDefaultDashboard(enabled: boolean) {
  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const loadDefaultDashboard = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setIsLoading(true);
    setIsEmpty(false);
    setError(null);
    try {
      const navigationResponse = await axiosClient.get<unknown>(DASHBOARDS_NAVIGATION_PATH, {
        ...READ_CONFIG,
        signal,
      });
      if (signal?.aborted) return;
      const navigation = parseNavigationResponse(navigationResponse.data);
      if (navigation.activeDashboardId) {
        setDashboardId(navigation.activeDashboardId);
        return;
      }

      const response = await axiosClient.get<unknown>(DASHBOARDS_DEFAULT_PATH, {
        ...READ_CONFIG,
        signal,
      }).catch((caught: unknown) => {
        const failure = normalizeApiError(caught);
        // A new workspace has no default until an explicit dashboard setup action.
        if (failure.status === 404 && failure.code === "CRM_DASHBOARD_NOT_FOUND") return null;
        throw caught;
      });
      if (signal?.aborted) return;
      if (response === null) {
        setDashboardId(null);
        setIsEmpty(true);
        return;
      }
      const detail = parseDashboardDetailResponse(response.data);
      setDashboardId(detail.id);
    } catch (caught) {
      if (signal?.aborted) return;
      setError(normalizeApiError(caught));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadDefaultDashboard(controller.signal);
    });
    return () => controller.abort();
  }, [enabled, loadDefaultDashboard]);

  return { dashboardId, setDashboardId, isLoading, isEmpty, error, loadDefaultDashboard };
}
