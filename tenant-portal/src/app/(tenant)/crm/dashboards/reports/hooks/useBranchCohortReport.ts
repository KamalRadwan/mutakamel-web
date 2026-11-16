"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { branchCohortQuery, parseBranchCohortReport, type BranchCohortFilters, type BranchCohortReport } from "../branch-cohort-report-contract";

export function useBranchCohortReport(filters: BranchCohortFilters) {
  return useCohortReport(filters, branchCohortQuery(filters), parseBranchCohortReport);
}

type ReportOptions = Pick<BranchCohortReport, "companies" | "branches">;

export function useCohortReport<Filters, Result extends ReportOptions>(filters: Filters, path: string,
  parse: (value: unknown, filters: Filters) => Result) {
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState<{ requestKey: string; result?: Result; error?: NormalizedApiError }>();
  const [options, setOptions] = useState<ReportOptions>();
  const requestKey = `${path}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await axiosClient.get<unknown>(path, { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024, signal: controller.signal });
        if (controller.signal.aborted) return;
        const result = parse(response.data, filters);
        setOptions({ companies: result.companies, branches: result.branches });
        setSettled({ requestKey, result });
      } catch (error) {
        if (controller.signal.aborted) return;
        const normalized = normalizeApiError(error);
        if (normalized.status === 401 || normalized.status === 403) setOptions(undefined);
        setSettled({ requestKey, error: normalized });
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, parse, path, requestKey]);

  const current = settled?.requestKey === requestKey ? settled : undefined;
  return { result: current?.result, error: current?.error, options, isLoading: !current, reload: () => setRevision((value) => value + 1) };
}
