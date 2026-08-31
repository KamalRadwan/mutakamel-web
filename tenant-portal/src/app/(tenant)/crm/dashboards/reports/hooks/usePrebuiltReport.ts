"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  PREBUILT_REPORTS,
  parsePrebuiltReport,
  prebuiltReportQuery,
  type PrebuiltReportKey,
  type PrebuiltReportResult,
} from "../../prebuilt-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;

/**
 * One of the seven prebuilt reports.
 *
 * They share a permission with the builder (`crm.dashboards.read`, scoped) but
 * nothing else: each is a `GET` with a fixed widget set, its own response
 * shape, and no `datePreset`/`compare` — `DashboardQueryDto` carries neither.
 */
export function usePrebuiltReport(reportKey: PrebuiltReportKey, branchId: string | null) {
  const [result, setResult] = useState<PrebuiltReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const report = PREBUILT_REPORTS.find((candidate) => candidate.key === reportKey);
      if (!report) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await axiosClient.get<unknown>(
          `${report.path}${prebuiltReportQuery(branchId)}`,
          { ...READ_CONFIG, signal },
        );
        setResult(parsePrebuiltReport(response.data, report.widgets));
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(normalizeApiError(caught));
        setResult(null);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [reportKey, branchId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return { result, isLoading, error, reload: () => load() };
}
