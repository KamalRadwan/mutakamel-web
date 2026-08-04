import { useCallback, useEffect, useState } from "react";
import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import type {
  AdminDashboardQuery,
  DashboardGroupKey,
  DashboardResponse,
} from "@/types/dashboard";
import type { AutoRefreshInterval } from "../components/DashboardHeader";

export type DashboardTabKey = "overview" | DashboardGroupKey;
export type DateRangePreset = "thisMonth" | "lastMonth" | "custom";

export interface DashboardHttpError extends Error {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errorCode?: string;
      code?: string;
      correlationId?: string;
      detail?: string;
      title?: string;
      details?: unknown;
    };
  };
}

export function useDashboardData() {
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("overview");
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("thisMonth");
  const [autoRefreshInterval, setAutoRefreshInterval] =
    useState<AutoRefreshInterval>("off");
  const [customRange, setCustomRange] = useState<{
    from?: string;
    to?: string;
  }>({});
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<DashboardHttpError | null>(null);

  const fetchDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query = buildDashboardQuery(
          rangePreset,
          customRange,
          new Date(),
        );
        const searchParams = new URLSearchParams();
        if (query.date) searchParams.set("date", query.date);
        if (query.from) searchParams.set("from", query.from);
        if (query.to) searchParams.set("to", query.to);
        const search = searchParams.toString();
        const endpoint = `/api/admin/core/v1/dashboard${
          search ? `?${search}` : ""
        }`;
        const response = await axiosClient.get<unknown>(endpoint);
        const nextData = unwrapCoreData<DashboardResponse>(response.data);
        setData(nextData);
        setActiveTab((currentTab) =>
          currentTab === "overview" ||
          nextData.authorizedGroups.includes(currentTab)
            ? currentTab
            : "overview",
        );
      } catch (errorValue: unknown) {
        setError(toDashboardHttpError(errorValue));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [customRange, rangePreset],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  useEffect(() => {
    if (autoRefreshInterval === "off") return;

    const delay =
      autoRefreshInterval === "30s"
        ? 30_000
        : autoRefreshInterval === "60s"
          ? 60_000
          : 300_000;
    const timer = window.setInterval(() => void fetchDashboard(true), delay);
    return () => window.clearInterval(timer);
  }, [autoRefreshInterval, fetchDashboard]);

  return {
    activeTab,
    setActiveTab,
    rangePreset,
    setRangePreset,
    customRange,
    setCustomRange,
    autoRefreshInterval,
    setAutoRefreshInterval,
    data,
    isLoading,
    isRefreshing,
    error,
    isForbidden: error?.response?.status === 403,
    isRateLimited: error?.response?.status === 429,
    handleRefresh: () => void fetchDashboard(true),
  };
}

export function buildDashboardQuery(
  preset: DateRangePreset,
  customRange: { from?: string; to?: string },
  now: Date,
): AdminDashboardQuery {
  if (preset === "custom") {
    return {
      ...(customRange.from ? { from: customRange.from } : {}),
      ...(customRange.to ? { to: customRange.to } : {}),
    };
  }
  if (preset !== "lastMonth") return {};

  const firstDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  );
  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

function toDashboardHttpError(errorValue: unknown): DashboardHttpError {
  if (errorValue instanceof Error) return errorValue as DashboardHttpError;
  return new Error(
    "An unexpected dashboard error occurred.",
  ) as DashboardHttpError;
}
