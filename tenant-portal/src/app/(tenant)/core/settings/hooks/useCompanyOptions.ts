"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  loadCompanyOptions,
  type CompanyOption,
} from "../company-options";

function isAbortError(error: unknown): boolean {
  return (error instanceof Error || error instanceof DOMException) && error.name === "AbortError";
}

/**
 * The company picker shared by the taxes and numbering screens.
 *
 * A failed company read grants no fallback scope. Write options reflect the
 * action's own permission projection, independently of organization visibility.
 */
export function useCompanyOptions(permissionKey: string) {
  const { user } = useTenantAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<void> => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const result = await loadCompanyOptions(controller.signal);
      if (controller.signal.aborted || activeRequest.current !== controller) return;
      setCompanies(result.companies);
      setIsTruncated(result.isTruncated);
      setLoadError(null);
    } catch (error) {
      if (
        controller.signal.aborted ||
        activeRequest.current !== controller ||
        isAbortError(error)
      ) {
        return;
      }
      setLoadError(normalizeApiError(error));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed && activeRequest.current === null) void load();
    });
    return () => {
      disposed = true;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [load]);

  const canManageScope = useCallback(
    (companyId: string | null) => can(user, permissionKey, { companyId }),
    [permissionKey, user],
  );
  const manageableCompanies = useMemo(
    () => companies.filter((company) => canManageScope(company.id)),
    [companies, canManageScope],
  );
  const tenantWideAllowed = canManageScope(null);
  return {
    loadError,
    isTruncated,
    retry: load,
    companies,
    manageableCompanies,
    tenantWideAllowed,
    canManageScope,
    canCreate: tenantWideAllowed || manageableCompanies.length > 0,
  };
}
