"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
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
 * A failed company read grants no fallback scope. Write options reflect the
 * action's own permission projection, independently of organization visibility.
 */
export function useCompanyOptions(permissionKey: string) {
  const { user } = useTenantAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const result = await coreGet(COMPANY_OPTIONS_PATH, {
        signal,
        suppressForbiddenToast: true,
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

  const canManageScope = useCallback(
    (companyId: string | null) => can(user, permissionKey, { companyId }),
    [permissionKey, user],
  );
  const manageableCompanies = companies.filter((company) => canManageScope(company.id));
  const tenantWideAllowed = canManageScope(null);
  return {
    companies,
    manageableCompanies,
    tenantWideAllowed,
    canManageScope,
    canCreate: tenantWideAllowed || manageableCompanies.length > 0,
  };
}
