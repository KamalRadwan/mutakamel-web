"use client";

import { useCallback, useEffect, useState } from "react";
import { coreGet } from "../../core-api";
import {
  COMPANY_OPTIONS_PATH,
  parseCompanyOptionsResponse,
  type CompanyOption,
} from "../company-options";

const COMPANY_OPTIONS_RESPONSE_LIMIT_BYTES = 400_000;

/**
 * The company picker shared by the taxes and numbering screens.
 *
 * Advisory only: a caller without `org.company.read` gets an empty list and
 * both screens fall back to tenant-wide scope, which is the scope the server
 * grants them anyway.
 */
export function useCompanyOptions() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const result = await coreGet(COMPANY_OPTIONS_PATH, {
        signal,
        maxResponseBytes: COMPANY_OPTIONS_RESPONSE_LIMIT_BYTES,
      });
      setCompanies(parseCompanyOptionsResponse(result.data));
    } catch {
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return companies;
}
