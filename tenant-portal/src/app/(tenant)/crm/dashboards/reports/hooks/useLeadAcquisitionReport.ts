"use client";

import { useEffect, useId, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { buildRunRequest, type DashboardFilterSelection, type DashboardOrganizationScope, type DashboardPopulationScope } from "../../dashboard-run-contract";
import { LEAD_ACQUISITION_REPORT_PATH, parseLeadAcquisitionReport } from "../lead-acquisition-report-contract";

const DEFAULT_SELECTION: DashboardFilterSelection = { branchId: null, datePreset: null, compare: null, currencyCode: null };

export function useLeadAcquisitionReport() {
  return useLeadCatalogueReport(LEAD_ACQUISITION_REPORT_PATH, parseLeadAcquisitionReport);
}

interface ReportOptions { organization: DashboardOrganizationScope; population: DashboardPopulationScope }

export function useLeadCatalogueReport<Result extends ReportOptions>(path: string,
  parse: (payload: unknown, selection: DashboardFilterSelection) => Result) {
  const methodId = useId();
  const [showMethod, setShowMethod] = useState(false);
  const [request, setRequest] = useState({ selection: DEFAULT_SELECTION });
  const [settled, setSettled] = useState<{
    request: typeof request;
    path: string;
    result?: Result;
    error?: NormalizedApiError;
  }>();
  const [options, setOptions] = useState<ReportOptions & { path: string }>();
  const { selection } = request;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    queueMicrotask(async () => {
      if (signal.aborted) return;
      try {
        const response = await axiosClient.post<unknown>(path, buildRunRequest(selection, true), {
          cache: "no-store", maxResponseBytes: 2 * 1024 * 1024, skipAutoIdempotency: true, signal,
        });
        if (signal.aborted) return;
        const result = parse(response.data, selection);
        setOptions({ path, organization: result.organization, population: result.population });
        setSettled({ path, request, result });
      } catch (caught) {
        if (signal.aborted) return;
        const error = normalizeApiError(caught);
        if (error.status === 401 || error.status === 403) setOptions(undefined);
        setSettled({ path, request, error });
      }
    });
    return () => controller.abort();
  }, [request, selection, path, parse]);

  const current = settled?.request === request && settled.path === path ? settled : undefined;
  return {
    methodId, showMethod, toggleMethod: () => setShowMethod(previous => !previous),
    selection, options: options?.path === path ? options : undefined, result: current?.result, error: current?.error, busy: !current,
    apply: (next: DashboardFilterSelection) => setRequest({ selection: next }),
    reload: () => setRequest(previous => ({ selection: previous.selection })),
    reset: () => setRequest({ selection: DEFAULT_SELECTION }),
  };
}
