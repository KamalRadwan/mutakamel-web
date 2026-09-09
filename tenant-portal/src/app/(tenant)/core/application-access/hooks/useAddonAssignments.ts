"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { readApplicationAddonAssignments, type ApplicationAddonAssignmentPage } from "../application-addon-assignments";

interface State { key: string; data: ApplicationAddonAssignmentPage | null; error: NormalizedApiError | null }
export function useAddonAssignments(userId: string) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const { t, lang } = useI18n();
  const [paging, setPaging] = useState({ userId, page: 1 });
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const page = paging.userId === userId ? paging.page : 1;
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.some((permission) =>
    permission === "applications.addon_seats.read" || permission === "applications.addon_seats.manage"));
  const key = JSON.stringify([userId, page, refresh, user?.id, user?.permissions, user?.isTenantOwner, realtimeAuthGeneration, allowed]);
  if (state !== null && state.key !== key) setState(null);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    readApplicationAddonAssignments({ userId, page, limit: 20 }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, key, page, userId]);
  const current = state?.key === key ? state : null;
  const changePage = (value: number) => {
    if (value !== page && Number.isInteger(value) && value >= 1 && value <= 1_000_000) setPaging({ userId, page: value });
  };
  return { t, requestedUserId: userId, snapshotKey: current?.key ?? null,
    data: current?.data ?? null, error: current?.error ?? null, loading: allowed && !current,
    denied: !allowed || current?.error?.status === 403, reload: () => setRefresh((value) => value + 1), changePage,
    canBrowseUsers: allowed && !!user?.permissions.includes("users.user.read"),
    labels: { retry: t.common.retry, errorTitle: t.addonAssignments.loadFailed, emptyTitle: t.addonAssignments.empty,
      selectAll: t.common.actions, selectRow: t.common.actions, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
      pagination: { previous: t.common.previousPage, next: t.common.nextPage,
        summary: (from: number, to: number, total: number) => formatTemplate(t.common.showingOf, { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) }) } },
  };
}
