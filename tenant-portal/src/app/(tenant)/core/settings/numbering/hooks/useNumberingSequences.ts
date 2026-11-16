"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCan } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessModeLabels } from "../../../hooks/useAccessModeLabels";
import { useCompanyOptions } from "../../hooks/useCompanyOptions";
import {
  describeNumberingQueryError,
  formatNumberingCompanyOptionsFailure,
} from "../numbering-errors";
import { useNumberingSequenceList } from "./useNumberingSequenceList";
import { useNumberingSequenceWrites } from "./useNumberingSequenceWrites";

function serializePermissionScope(
  scope:
    | { tenantWide: boolean; companyIds: readonly string[]; branchIds: readonly string[] }
    | undefined,
): string {
  if (!scope) return "none";
  const companies = [...(scope.companyIds ?? [])].sort().join(",");
  const branches = [...(scope.branchIds ?? [])].sort().join(",");
  return `${scope.tenantWide}:${companies}:${branches}`;
}

export function useNumberingSequences() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const authScopeKey = useAuthScopeKey(user);
  const canRead = useCan("numbering.read");
  const hasManagePermission = useCan("numbering.manage");
  const accessMode = useAccessMode();
  const accessModeLabels = useAccessModeLabels();

  const canReadAccess = canRead && accessMode.canRead;
  const rawCanManage = hasManagePermission && accessMode.canMutate;
  const readScopeKey = serializePermissionScope(user?.permissionScopes?.["numbering.read"]);
  const manageScopeKey = serializePermissionScope(user?.permissionScopes?.["numbering.manage"]);
  const authFenceKey = `${realtimeAuthGeneration ?? "no-gen"}:${authScopeKey}:${readScopeKey}:${manageScopeKey}:${accessMode.mode ?? "unresolved"}:${canReadAccess}:${rawCanManage}`;

  const latestAuthFenceRef = useRef(authFenceKey);
  const dismissPrivateRef = useRef<() => void>(() => {});

  useEffect(() => {
    latestAuthFenceRef.current = authFenceKey;
  }, [authFenceKey]);

  const handleQueryForbidden = useCallback(() => {
    dismissPrivateRef.current();
  }, []);

  const {
    companies,
    manageableCompanies,
    tenantWideAllowed,
    canManageScope: rawCanManageScope,
    canCreate: rawCanCreate,
    loadError: companyLoadError,
    isTruncated: companiesTruncated,
    retry: retryCompanies,
  } = useCompanyOptions("numbering.manage");

  const list = useNumberingSequenceList({
    authFenceKey,
    latestAuthFenceRef,
    canRead,
    canReadAccess: accessMode.canRead,
    onQueryForbidden: handleQueryForbidden,
  });

  const isDenied = !canReadAccess || list.isQueryForbidden;
  const canManage = !isDenied && rawCanManage;
  const canCreate = !isDenied && rawCanCreate && accessMode.canMutate;
  const canManageScope = useCallback(
    (companyId: string | null) => !isDenied && accessMode.canMutate && rawCanManageScope(companyId),
    [accessMode.canMutate, isDenied, rawCanManageScope],
  );
  const isPermissionReadOnly = canRead && !hasManagePermission;
  const effectiveAccessMode = accessMode.mode ?? (isPermissionReadOnly ? "READ_ONLY" : null);
  const readOnlyLabels = useMemo(
    () =>
      accessMode.isRestricted
        ? accessModeLabels
        : { ...accessModeLabels, readOnlyNotice: t.crmSettings.readOnly },
    [accessMode.isRestricted, accessModeLabels, t],
  );

  const { dismissPrivateState, ...writes } = useNumberingSequenceWrites({
    t,
    authFenceKey,
    rawCanManage,
    isDenied,
    canManage,
    canCreate,
    canManageScope,
    companies,
    reload: list.reload,
  });

  useEffect(() => {
    dismissPrivateRef.current = dismissPrivateState;
  }, [dismissPrivateState]);

  const queryFailure =
    list.queryError && !list.isQueryForbidden
      ? describeNumberingQueryError(list.queryError, t)
      : null;
  const companyFailure = companyLoadError
    ? formatNumberingCompanyOptionsFailure(companyLoadError, t)
    : null;

  return {
    companyFailure,
    companiesTruncated,
    retryCompanies,
    sort: list.sort,
    setSort: list.setSort,
    t,
    lang,
    canManage,
    canCreate,
    canManageScope,
    effectiveAccessMode,
    readOnlyLabels,
    tenantWideAllowed,
    manageableCompanies,
    companies,
    items: list.items,
    hasRetainedRows: list.hasRetainedRows,
    pageInfo: list.pageInfo,
    companyFilter: list.companyFilter,
    codeFilter: list.codeFilter,
    search: list.search,
    hasActiveFilters: list.hasActiveFilters,
    clearAllFilters: list.clearAllFilters,
    isLoading: list.isLoading,
    isRefreshing: list.isRefreshing,
    isQueryForbidden: list.isQueryForbidden,
    isQueryNotFound: list.isQueryNotFound,
    queryFailure,
    setPage: list.setPage,
    setCompanyFilter: list.setCompanyFilter,
    setCodeFilter: list.setCodeFilter,
    setSearch: list.setSearch,
    reload: list.reload,
    ...writes,
  };
}
