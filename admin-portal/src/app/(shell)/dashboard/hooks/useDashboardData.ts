import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import { useOperatorRefreshGuard } from "@/shared/hooks/useOperatorRefreshGuard";
import { usePollWhile } from "@/shared/hooks/usePollWhile";
import type {
  AdminDashboardQuery,
  DashboardGroupKey,
  DashboardResponse,
} from "@/types/dashboard";
import type { AutoRefreshInterval } from "../components/DashboardHeader";

export type DashboardTabKey = "overview" | DashboardGroupKey;

/**
 * Which groups a tab needs loaded.
 *
 * A group tab needs its own group and nothing else — that is where the
 * saving is, since tab switches and auto-refresh polls are the frequent
 * requests. The overview is a summary of everything: its report-group grid
 * shows availability and open alerts for every authorized group, so scoping
 * it would leave most of that grid blank. It asks for the full set, which an
 * empty list expresses.
 */
export function requestedGroupsForTab(tab: DashboardTabKey): DashboardGroupKey[] {
  return tab === "overview" ? [] : [tab];
}

/**
 * Groups already loaded for a different window would show numbers from that
 * window under this one's label, so a carried-over group is only safe while
 * the range signature is unchanged.
 */
export function rangeSignature(query: AdminDashboardQuery): string {
  return [query.date ?? "", query.from ?? "", query.to ?? ""].join("|");
}

/**
 * Keeps groups the new response did not carry, so switching tabs does not
 * blank the ones already fetched for the same window.
 */
export function mergeDashboardGroups(
  previous: DashboardResponse | null,
  next: DashboardResponse,
  sameRange: boolean,
): DashboardResponse {
  if (!previous || !sameRange) return next;
  // A server that predates `?groups=` sends no `loadedGroups` and always
  // returns the full set, so there is nothing to carry over.
  const loaded = next.loadedGroups;
  if (!Array.isArray(loaded)) return next;
  const carried: Partial<Record<DashboardGroupKey, unknown>> = {};
  for (const key of previous.authorizedGroups) {
    if (loaded.includes(key)) continue;
    const group = previous[key];
    if (group) carried[key] = group;
  }
  return { ...carried, ...next } as DashboardResponse;
}

/**
 * Core rejects unknown query properties outright (`forbidNonWhitelisted` in
 * its global pipe), so a portal that sends `?groups=` to a deployment that
 * predates the parameter gets a 400 on every dashboard request rather than
 * an ignored parameter. During a rolling deploy the portal can lead Core by
 * minutes, so scoping degrades instead of breaking: one 400 disables it for
 * the session and the request is retried unscoped.
 */
export function isUnsupportedQueryError(error: unknown): boolean {
  return (
    (error as DashboardHttpError | undefined)?.response?.status === 400
  );
}
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

export interface UseDashboardDataOptions {
  ownedRefreshRegionRefs?: readonly RefObject<HTMLElement | null>[];
  modalOrMenuOpen?: boolean;
  activeCall?: boolean;
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("overview");
  const [rangePreset, setRangePresetState] =
    useState<DateRangePreset>("thisMonth");
  const [autoRefreshInterval, setAutoRefreshInterval] =
    useState<AutoRefreshInterval>("off");
  const [customRange, setCustomRangeState] = useState<{
    from?: string;
    to?: string;
  }>({});
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<DashboardHttpError | null>(null);
  const [operatorRefreshPaused, setOperatorRefreshPaused] = useState(false);
  const requestGenerationRef = useRef(0);
  const loadedRangeRef = useRef<string | null>(null);
  const scopingSupportedRef = useRef(true);
  const activeTabRef = useRef<DashboardTabKey>("overview");
  const rangePresetRef = useRef<DateRangePreset>("thisMonth");
  const customRangeRef = useRef<{ from?: string; to?: string }>({});
  const setRangePreset = useCallback((nextPreset: DateRangePreset) => {
    if (nextPreset === rangePresetRef.current) return;
    rangePresetRef.current = nextPreset;
    requestGenerationRef.current += 1;
    setRangePresetState(nextPreset);
  }, []);
  const setCustomRange = useCallback(
    (nextRange: { from?: string; to?: string }) => {
      if (
        nextRange.from === customRangeRef.current.from &&
        nextRange.to === customRangeRef.current.to
      ) {
        return;
      }
      customRangeRef.current = { ...nextRange };
      requestGenerationRef.current += 1;
      setCustomRangeState(nextRange);
    },
    [],
  );
  const refreshGuard = useOperatorRefreshGuard({
    ownedRegionRefs: options.ownedRefreshRegionRefs,
    modalOrMenuOpen: options.modalOrMenuOpen,
    operatorPaused: operatorRefreshPaused,
    activeCall: options.activeCall,
  });

  const fetchDashboard = useCallback(
    async (isRefresh = false, scope: "tab" | "all" = "tab") => {
      const requestGeneration = ++requestGenerationRef.current;
      const ownsLatestRequest = () =>
        requestGeneration === requestGenerationRef.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const query = buildDashboardQuery(rangePreset, customRange, new Date());
      const requestOnce = async (withGroups: boolean) => {
        const searchParams = new URLSearchParams();
        if (query.date) searchParams.set("date", query.date);
        if (query.from) searchParams.set("from", query.from);
        if (query.to) searchParams.set("to", query.to);
        // One tab is on screen at a time; the export is the only reader that
        // legitimately needs all fourteen groups at once.
        const scoped = withGroups
          ? requestedGroupsForTab(activeTabRef.current)
          : [];
        if (scoped.length > 0) searchParams.set("groups", scoped.join(","));
        const search = searchParams.toString();
        const endpoint = `/api/admin/core/v1/dashboard${
          search ? `?${search}` : ""
        }`;
        const response = await axiosClient.get<unknown>(endpoint);
        return unwrapCoreData<DashboardResponse>(response.data);
      };

      try {
        const wantsScope = scope === "tab" && scopingSupportedRef.current;
        let nextData: DashboardResponse;
        try {
          nextData = await requestOnce(wantsScope);
        } catch (scopedError: unknown) {
          if (!wantsScope || !isUnsupportedQueryError(scopedError)) throw scopedError;
          // This Core does not know the parameter. Stop sending it and load
          // the full payload instead, for this session.
          scopingSupportedRef.current = false;
          nextData = await requestOnce(false);
        }
        if (!ownsLatestRequest()) return;
        const signature = rangeSignature(query);
        const sameRange = loadedRangeRef.current === signature;
        loadedRangeRef.current = signature;
        setData((previous) =>
          mergeDashboardGroups(previous, nextData, sameRange),
        );
        setActiveTab((currentTab) =>
          currentTab === "overview" ||
          nextData.authorizedGroups.includes(currentTab)
            ? currentTab
            : "overview",
        );
      } catch (errorValue: unknown) {
        if (!ownsLatestRequest()) return;
        setError(toDashboardHttpError(errorValue));
      } finally {
        if (ownsLatestRequest()) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [customRange, rangePreset],
  );

  useEffect(() => {
    activeTabRef.current = activeTab;
    const timer = window.setTimeout(() => void fetchDashboard(), 0);
    return () => {
      window.clearTimeout(timer);
      requestGenerationRef.current += 1;
    };
  }, [activeTab, fetchDashboard]);

  const autoRefreshDelay = getAutoRefreshDelay(autoRefreshInterval);
  usePollWhile(
    autoRefreshDelay !== null && !refreshGuard.isPaused,
    () => fetchDashboard(true),
    {
      intervalMs: autoRefreshDelay ?? 30_000,
      deps: [fetchDashboard],
    },
  );

  return {
    activeTab,
    setActiveTab,
    rangePreset,
    setRangePreset,
    customRange,
    setCustomRange,
    autoRefreshInterval,
    setAutoRefreshInterval,
    operatorRefreshPaused,
    setOperatorRefreshPaused,
    isAutoRefreshPaused:
      autoRefreshDelay !== null && refreshGuard.isPaused,
    isAutoRefreshAutomaticallyPaused:
      autoRefreshDelay !== null && refreshGuard.isAutomaticallyPaused,
    autoRefreshPauseReasons: refreshGuard.pauseReasons,
    data,
    isLoading,
    isRefreshing,
    error,
    isForbidden: error?.response?.status === 403,
    isRateLimited: error?.response?.status === 429,
    handleRefresh: () => void fetchDashboard(true),
    /** Loads every authorized group; the PDF export needs the whole set. */
    loadAllGroups: () => fetchDashboard(true, "all"),
  };
}

function getAutoRefreshDelay(interval: AutoRefreshInterval): number | null {
  if (interval === "off") return null;
  if (interval === "30s") return 30_000;
  if (interval === "60s") return 60_000;
  return 300_000;
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
