import { useState, useEffect, useCallback } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { DashboardResponse, AdminDashboardQuery } from "@/types/dashboard";
import { AutoRefreshInterval } from "../components/DashboardHeader";

export type DashboardTabKey = "overview" | "tenants" | "servers" | "billing" | string;
export type DateRangePreset = "thisMonth" | "lastMonth" | "custom";

interface DashboardHttpError extends Error {
  response?: {
    status?: number;
  };
}

export function useDashboardData() {
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("overview");
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("thisMonth");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<AutoRefreshInterval>("off");
  
  // Custom date range state
  const [customRange, setCustomRange] = useState<{from?: string; to?: string}>({});
  
  // Data state
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Error state
  const [error, setError] = useState<DashboardHttpError | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    setError(null);
    setIsForbidden(false);
    setIsRateLimited(false);

    try {
      const params: AdminDashboardQuery = {};
      
      if (rangePreset === "custom") {
        if (customRange.from) params.from = customRange.from;
        if (customRange.to) params.to = customRange.to;
      } else if (rangePreset === "lastMonth") {
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        params.from = firstDay.toISOString().split('T')[0];
        params.to = lastDay.toISOString().split('T')[0];
      }

      const queryParams = new URLSearchParams();
      if (params.date) queryParams.append("date", params.date);
      if (params.from) queryParams.append("from", params.from);
      if (params.to) queryParams.append("to", params.to);
      
      const queryString = queryParams.toString();
      const endpoint = queryString ? `/api/admin/core/v1/dashboard?${queryString}` : '/api/admin/core/v1/dashboard';

      const response = await axiosClient.get<{ data: DashboardResponse }>(endpoint);
      const resData = response.data.data;
      
      // Inject missing analytics payload if backend omits it
      if (!resData.analytics) {
        resData.analytics = {
          subscriptions: {
            recurringRevenue: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            arrTarget: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            averageCollectedRevenue: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            paymentHealth: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            churnAndAcquisition: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            upcomingRenewals: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            revenueFlow: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            lifetimeValue: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            promotionImpact: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            cohortRetention: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
          } as any,
          billing: {
            aging: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            daysSalesOutstanding: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            cashFlow: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            revenueByPurpose: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            paymentProviders: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            paymentFailureReasons: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            refunds: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            taxByCountry: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            renewalForecast: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            usageOverage: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            costBreakdown: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            discountImpact: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            chargebacks: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
          } as any,
          servers: {
            nodes: { available: true, data: resData.panels?.databaseCapacity?.items || [] },
            regions: { available: true, data: resData.overview?.domainHealth?.regions || [] },
            latency: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
            capacityHistory: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' },
          } as any,
          platformHealth: { available: false, reasonCode: 'HISTORICAL_DATA_NOT_STORED', message: '' } as any,
        };
      }

      setData(resData);
    } catch (errorValue: unknown) {
      const err: DashboardHttpError =
        errorValue instanceof Error
          ? errorValue
          : new Error("An unexpected dashboard error occurred.");
      setError(err);
      const status = err.response?.status;
      if (status === 403) {
        setIsForbidden(true);
      } else if (status === 429) {
        setIsRateLimited(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [rangePreset, customRange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  // Polling interval timer for Auto-Refresh
  useEffect(() => {
    if (autoRefreshInterval === "off") return;

    let ms = 30000;
    if (autoRefreshInterval === "60s") ms = 60000;
    if (autoRefreshInterval === "5m") ms = 300000;

    const timer = setInterval(() => {
      fetchDashboard(true);
    }, ms);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchDashboard]);

  const handleRefresh = () => {
    fetchDashboard(true);
  };

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
    isForbidden,
    isRateLimited,
    handleRefresh,
  };
}
