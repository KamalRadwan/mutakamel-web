"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { reportsApi } from "../api/reports-api";
import {
  buildProvisioningQuery,
  buildTenantQuery,
  buildWindowQuery,
  copyDefaultReportFilters,
  DEFAULT_REPORT_FILTERS,
  validateReportFilters,
} from "../lib/report-filters";
import type {
  ReportData,
  ReportFilterDraft,
  ReportFilterErrors,
  ReportKind,
  ReportsRequestState,
} from "../types/reports";

export function useReports() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.reports.read");
  const [activeReport, setActiveReportState] = useState<ReportKind>("OVERVIEW");
  const [drafts, setDrafts] = useState(copyDefaultReportFilters);
  const [appliedDrafts, setAppliedDrafts] = useState(copyDefaultReportFilters);
  const [validationErrors, setValidationErrors] = useState<ReportFilterErrors>(
    {},
  );
  const [tenantPage, setTenantPage] = useState(1);
  const [requestState, setRequestState] =
    useState<ReportsRequestState>("LOADING");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const visibleDataKind = useRef<ReportKind | null>(null);

  const draft = drafts[activeReport];
  const appliedDraft = appliedDrafts[activeReport];

  useEffect(() => {
    if (isAuthLoading || !canRead) return;
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    let disposed = false;

    const load = async () => {
      const hasCurrentData = visibleDataKind.current === activeReport;
      if (hasCurrentData) setIsRefreshing(true);
      else {
        visibleDataKind.current = null;
        setData(null);
        setRequestState("LOADING");
      }
      setError(null);
      try {
        const result = await loadReport(
          activeReport,
          appliedDraft,
          tenantPage,
          controller.signal,
        );
        if (
          disposed ||
          controller.signal.aborted ||
          generation !== requestGeneration.current
        ) {
          return;
        }

        if (
          result.kind === "TENANTS" &&
          result.snapshot.data.totalPages > 0 &&
          tenantPage > result.snapshot.data.totalPages
        ) {
          setTenantPage(result.snapshot.data.totalPages);
          return;
        }
        visibleDataKind.current = result.kind;
        setData(result);
        setRequestState(isReportEmpty(result) ? "EMPTY" : "READY");
      } catch (caught) {
        if (
          disposed ||
          controller.signal.aborted ||
          generation !== requestGeneration.current ||
          isAbortError(caught)
        ) {
          return;
        }
        const normalized = normalizeApiError(caught);
        visibleDataKind.current = null;
        setData(null);
        setError(normalized);
        setRequestState(classifyError(caught, normalized));
      } finally {
        if (!disposed && generation === requestGeneration.current) {
          setIsRefreshing(false);
        }
      }
    };

    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    activeReport,
    appliedDraft,
    canRead,
    isAuthLoading,
    refreshRevision,
    tenantPage,
  ]);

  const setActiveReport = useCallback(
    (kind: ReportKind) => {
      if (kind === activeReport) return;
      requestGeneration.current++;
      activeRequest.current?.abort();
      visibleDataKind.current = null;
      setActiveReportState(kind);
      setValidationErrors({});
      setData(null);
      setError(null);
      setIsRefreshing(false);
      setRequestState("LOADING");
    },
    [activeReport],
  );

  const updateFilter = useCallback(
    <K extends keyof ReportFilterDraft>(
      field: K,
      value: ReportFilterDraft[K],
    ) => {
      setDrafts((current) => ({
        ...current,
        [activeReport]: { ...current[activeReport], [field]: value },
      }));
      setValidationErrors((current) => {
        if (!current[field] && !current.dateRange) return current;
        const next = { ...current };
        delete next[field];
        if (field === "from" || field === "to") delete next.dateRange;
        return next;
      });
    },
    [activeReport],
  );

  const applyFilters = useCallback(() => {
    const nextErrors = validateReportFilters(activeReport, draft);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length) return false;
    setAppliedDrafts((current) => ({
      ...current,
      [activeReport]: { ...draft },
    }));
    if (activeReport === "TENANTS") setTenantPage(1);
    setRefreshRevision((current) => current + 1);
    return true;
  }, [activeReport, draft]);

  const submitFilters = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      applyFilters();
    },
    [applyFilters],
  );

  const clearFilters = useCallback(() => {
    const reset = { ...DEFAULT_REPORT_FILTERS[activeReport] };
    setDrafts((current) => ({ ...current, [activeReport]: { ...reset } }));
    setAppliedDrafts((current) => ({
      ...current,
      [activeReport]: { ...reset },
    }));
    setValidationErrors({});
    if (activeReport === "TENANTS") setTenantPage(1);
    setRefreshRevision((current) => current + 1);
  }, [activeReport]);

  const refresh = useCallback(() => {
    setRefreshRevision((current) => current + 1);
  }, []);

  const previousTenantPage = useCallback(() => {
    setTenantPage((current) => Math.max(1, current - 1));
  }, []);

  const nextTenantPage = useCallback(() => {
    if (data?.kind !== "TENANTS" || !data.snapshot.data.hasNext) return;
    setTenantPage((current) => current + 1);
  }, [data]);

  const visibleState: ReportsRequestState = isAuthLoading
    ? "LOADING"
    : !canRead
      ? "FORBIDDEN"
      : requestState;
  const visibleData =
    visibleState === "READY" || visibleState === "EMPTY" ? data : null;

  return useMemo(
    () => ({
      activeReport,
      draft,
      validationErrors,
      requestState: visibleState,
      data: visibleData,
      error,
      isRefreshing,
      canRead,
      tenantPage,
      setActiveReport,
      updateFilter,
      submitFilters,
      clearFilters,
      refresh,
      previousTenantPage,
      nextTenantPage,
    }),
    [
      activeReport,
      canRead,
      clearFilters,
      draft,
      error,
      isRefreshing,
      nextTenantPage,
      previousTenantPage,
      refresh,
      setActiveReport,
      submitFilters,
      tenantPage,
      updateFilter,
      validationErrors,
      visibleData,
      visibleState,
    ],
  );
}

async function loadReport(
  kind: ReportKind,
  draft: ReportFilterDraft,
  tenantPage: number,
  signal: AbortSignal,
): Promise<ReportData> {
  switch (kind) {
    case "OVERVIEW":
      return {
        kind,
        snapshot: await reportsApi.overview(buildWindowQuery(draft), signal),
      };
    case "TENANTS":
      return {
        kind,
        snapshot: await reportsApi.tenants(
          buildTenantQuery(draft, tenantPage),
          signal,
        ),
      };
    case "SERVERS":
      return { kind, snapshot: await reportsApi.servers(signal) };
    case "BILLING":
      return {
        kind,
        snapshot: await reportsApi.billing(buildWindowQuery(draft), signal),
      };
    case "PROVISIONING":
      return {
        kind,
        snapshot: await reportsApi.provisioning(
          buildProvisioningQuery(draft),
          signal,
        ),
      };
  }
}

function isReportEmpty(data: ReportData): boolean {
  switch (data.kind) {
    case "OVERVIEW":
      return false;
    case "TENANTS":
      return data.snapshot.data.items.length === 0;
    case "SERVERS":
      return data.snapshot.data.items.length === 0;
    case "BILLING":
      return data.snapshot.data.buckets.length === 0;
    case "PROVISIONING":
      return data.snapshot.data.items.length === 0;
  }
}

function classifyError(
  caught: unknown,
  error: NormalizedApiError,
): ReportsRequestState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (
    caught instanceof Error &&
    caught.message === "INVALID_ADMIN_REPORT_RESPONSE"
  ) {
    return "ERROR";
  }
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "AbortError")
  );
}
