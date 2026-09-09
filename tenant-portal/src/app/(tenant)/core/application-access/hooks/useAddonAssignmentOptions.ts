"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { readApplicationAddonAssignmentOptions, type ApplicationAddonAssignmentOptionsPage } from "../application-addon-assignment-options";

interface State { key: string; data: ApplicationAddonAssignmentOptionsPage | null; error: NormalizedApiError | null }
export function useAddonAssignmentOptions(userId: string) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
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
    readApplicationAddonAssignmentOptions({ userId, page, limit: 20 }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, key, page, userId]);
  const current = state?.key === key ? state : null;
  const changePage = (value: number) => {
    if (value !== page && Number.isInteger(value) && value >= 1 && value <= 1_000_000) setPaging({ userId, page: value });
  };
  return { requestedUserId: userId, snapshotKey: current?.key ?? null,
    data: current?.data ?? null, error: current?.error ?? null, loading: allowed && !current,
    denied: !allowed || current?.error?.status === 403, reload: () => setRefresh((value) => value + 1), changePage };
}
