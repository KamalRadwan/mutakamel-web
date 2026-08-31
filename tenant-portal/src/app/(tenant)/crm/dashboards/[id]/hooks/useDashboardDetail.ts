"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  buildUpdateDashboardRequest,
  dashboardPath,
  dashboardRunPath,
  parseDashboardDetailResponse,
  type DashboardDetail,
} from "../../dashboard-contract";
import {
  buildRunRequest,
  currenciesInRun,
  parseRunResponse,
  type DashboardFilterSelection,
  type DashboardRunResult,
} from "../../dashboard-run-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 4 * 1024 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 1024 * 1024,
  nonReplayable: true,
} as const;

/** `CRM_DASHBOARD_REVISION_CONFLICT` / `CRM_DASHBOARD_LAYOUT_STALE` — 409. */
const REVISION_CONFLICT_CODES = [
  "CRM_DASHBOARD_REVISION_CONFLICT",
  "CRM_DASHBOARD_LAYOUT_STALE",
];

const EMPTY_SELECTION: DashboardFilterSelection = {
  datePreset: null,
  compare: null,
  branchId: null,
  currencyCode: null,
};

export interface DashboardMutationResult {
  ok: boolean;
  conflict: boolean;
  error: NormalizedApiError | null;
}

export function useDashboardDetail(dashboardId: string) {
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [run, setRun] = useState<DashboardRunResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detailError, setDetailError] = useState<NormalizedApiError | null>(null);
  const [runError, setRunError] = useState<NormalizedApiError | null>(null);
  const [selection, setSelection] = useState<DashboardFilterSelection>(EMPTY_SELECTION);

  const load = useCallback(
    async (filters: DashboardFilterSelection, signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setIsRunning(true);
      setDetailError(null);
      setRunError(null);
      // The definition and the execution are two requests and two failures.
      // `allSettled` keeps a dashboard whose widgets could not run readable —
      // its layout, its shares and its placements all still work.
      const [definition, execution] = await Promise.allSettled([
        axiosClient.get<unknown>(dashboardPath(dashboardId), { ...READ_CONFIG, signal }),
        axiosClient.post<unknown>(dashboardRunPath(dashboardId), buildRunRequest(filters), {
          ...READ_CONFIG,
          signal,
          // `POST /:id/run` is READ_HEAVY, not WRITE_SENSITIVE, so the Gateway
          // reserves no idempotency key for it and re-running is free.
          skipAutoIdempotency: true,
        }),
      ]);
      if (signal?.aborted) return;

      if (definition.status === "fulfilled") {
        try {
          setDetail(parseDashboardDetailResponse(definition.value.data));
        } catch (error) {
          setDetailError(normalizeApiError(error));
        }
      } else {
        setDetailError(normalizeApiError(definition.reason));
      }

      if (execution.status === "fulfilled") {
        try {
          setRun(parseRunResponse(execution.value.data));
        } catch (error) {
          setRunError(normalizeApiError(error));
        }
      } else {
        setRunError(normalizeApiError(execution.reason));
      }
      setIsLoading(false);
      setIsRunning(false);
    },
    [dashboardId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(EMPTY_SELECTION, controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  /** Re-executes without refetching the definition — the filter-change path. */
  const rerun = useCallback(
    async (filters: DashboardFilterSelection): Promise<void> => {
      setSelection(filters);
      setIsRunning(true);
      setRunError(null);
      try {
        const response = await axiosClient.post<unknown>(
          dashboardRunPath(dashboardId),
          buildRunRequest(filters),
          { ...READ_CONFIG, skipAutoIdempotency: true },
        );
        setRun(parseRunResponse(response.data));
      } catch (error) {
        setRunError(normalizeApiError(error));
      } finally {
        setIsRunning(false);
      }
    },
    [dashboardId],
  );

  const rename = async (name: string, description: string): Promise<DashboardMutationResult> => {
    if (!detail) return { ok: false, conflict: false, error: null };
    setIsSaving(true);
    try {
      const response = await axiosClient.patch<unknown>(
        dashboardPath(dashboardId),
        buildUpdateDashboardRequest({ revision: detail.revision, name, description }),
        WRITE_CONFIG,
      );
      setDetail(parseDashboardDetailResponse(response.data));
      return { ok: true, conflict: false, error: null };
    } catch (error) {
      const normalized = normalizeApiError(error);
      return {
        ok: false,
        conflict: isRevisionConflict(normalized),
        error: normalized,
      };
    } finally {
      setIsSaving(false);
    }
  };

  const availableCurrencies = useMemo(() => currenciesInRun(run), [run]);

  return {
    detail,
    run,
    selection,
    availableCurrencies,
    isLoading,
    isRunning,
    isSaving,
    detailError,
    runError,
    rename,
    rerun,
    /** Refetches definition and run together — also the 409 recovery path. */
    reload: () => load(selection),
  };
}

export function isRevisionConflict(error: NormalizedApiError | null): boolean {
  return (
    error !== null &&
    error.status === 409 &&
    REVISION_CONFLICT_CODES.includes(error.code ?? "")
  );
}
