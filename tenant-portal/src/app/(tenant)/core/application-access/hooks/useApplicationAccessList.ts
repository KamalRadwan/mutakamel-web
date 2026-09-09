"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { readApplicationAccessList, type ApplicationAccessListPage, type ApplicationAccessListRequest } from "../application-access-list";

type ScopeTarget = Pick<ApplicationAccessListRequest, "scope" | "scopeId">;
interface State { key: string; data: ApplicationAccessListPage | null; error: NormalizedApiError | null }

export function useApplicationAccessList({ scope, scopeId }: ScopeTarget) {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const scopeKey = `${scope}:${scopeId}`;
  const [paging, setPaging] = useState({ scopeKey, page: 1 });
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const page = paging.scopeKey === scopeKey ? paging.page : 1;
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.some((permission) =>
    permission === "applications.activation.read" || permission === "applications.activation.manage"));
  const key = JSON.stringify([scopeKey, page, refresh, user?.id, user?.permissions, user?.isTenantOwner, realtimeAuthGeneration, allowed]);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    readApplicationAccessList({ scope, scopeId, page, limit: 20 }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, key, page, scope, scopeId]);
  const current = state?.key === key ? state : null;
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  const changePage = useCallback((value: number) => {
    if (Number.isInteger(value) && value >= 1 && value <= 1_000_000) setPaging({ scopeKey, page: value });
  }, [scopeKey]);
  return { t, reload, changePage, data: current?.data ?? null, error: current?.error ?? null,
    loading: allowed && !current, denied: !allowed || current?.error?.status === 403,
    labels: { retry: t.common.retry, errorTitle: t.applicationAccess.loadFailed, emptyTitle: t.applicationAccess.directoryEmpty,
      selectAll: t.common.actions, selectRow: t.common.actions, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
      pagination: { previous: t.common.previousPage, next: t.common.nextPage,
        summary: (from: number, to: number, total: number) => formatTemplate(t.common.showingOf, { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) }) } },
  };
}
