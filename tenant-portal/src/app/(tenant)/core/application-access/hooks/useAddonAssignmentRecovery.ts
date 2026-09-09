"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { listAddonAssignmentIntents } from "../application-addon-assignment-intent";

export function useAddonAssignmentRecovery(userId: string, readSnapshotKey: string | null = null) {
  const { user, isAuthenticated, authState, realtimeAuthGeneration } = useTenantAuth();
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{ key: string; items: ReturnType<typeof listAddonAssignmentIntents>; error: boolean } | null>(null);
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes("applications.addon_seats.manage"));
  const ready = allowed && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null;
  const key = JSON.stringify([user?.id, user?.permissions, user?.isTenantOwner, userId, realtimeAuthGeneration, allowed, refresh]);
  if (state !== null && state.key !== key) setState(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || !ready || !user) return;
      try { setState({ key, items: listAddonAssignmentIntents(user.id, userId), error: false }); }
      catch { setState({ key, items: [], error: true }); }
    });
    return () => { active = false; };
  }, [key, ready, user, userId, readSnapshotKey]);
  // Keep command ownership during same-session refresh; each command suspends its own UI/action.
  const current = allowed && state?.key === key ? state : null;
  return { ready, items: current?.items ?? [], error: current?.error ?? false, denied: !allowed,
    loading: allowed && !current, reload: () => setRefresh((value) => value + 1) };
}
