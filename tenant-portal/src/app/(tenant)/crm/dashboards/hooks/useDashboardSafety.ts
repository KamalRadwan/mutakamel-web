"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useAccessMode } from "@/hooks/useAccessMode";
import { acquireDashboardWrite, confirmDashboardRead, dashboardSafetyEntry, fenceDashboardWrite, finishDashboardWrite, reviewDashboardRead } from "./dashboard-safety-store";
import type { NormalizedApiError } from "@/lib/api/errors";

interface ReadTicket { scope: object; sequence: number; epoch: number; }
export interface DashboardWriteTicket { scope: object; token: symbol; }

export function useDashboardSafety(resource: string) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const grants = useAuthScopeKey(user);
  const { canMutate } = useAccessMode();
  const origin = typeof window === "undefined" ? "server" : window.location.origin;
  const key = JSON.stringify([origin, user?.id ?? null, realtimeAuthGeneration ?? null]);
  const actorId = user?.id;
  const scope = useMemo(() => ({ origin, actorId, grants, resource, realtimeAuthGeneration, canMutate }), [origin, actorId, grants, resource, realtimeAuthGeneration, canMutate]);
  const entry = dashboardSafetyEntry(key);
  const subscribe = useCallback((listener: () => void) => { entry.listeners.add(listener); return () => { entry.listeners.delete(listener); }; }, [entry]);
  const version = useSyncExternalStore(subscribe, () => entry.version, () => 0);
  const current = useRef({ scope, active: false, sequence: 0 });
  useLayoutEffect(() => {
    const state = { scope, active: true, sequence: current.current.sequence + 1 };
    current.current = state;
    return () => { state.active = false; state.sequence++; };
  }, [scope]);
  const isCurrent = useCallback(() => current.current.active && current.current.scope === scope, [scope]);
  const startRead = useCallback((): ReadTicket | null => {
    if (!isCurrent() || entry.pending) return null;
    return { scope, sequence: ++current.current.sequence, epoch: entry.epoch };
  }, [scope, entry, isCurrent]);
  const readSettled = useCallback((ticket: ReadTicket) => isCurrent() && ticket.scope === scope
    && ticket.sequence === current.current.sequence, [scope, isCurrent]);
  const currentRead = useCallback((ticket: ReadTicket) => readSettled(ticket) && ticket.epoch === entry.epoch, [entry, readSettled]);
  const beginWrite = useCallback((allowed: boolean): DashboardWriteTicket | null => {
    if (!allowed || !canMutate || !isCurrent()) return null;
    const token = acquireDashboardWrite(entry);
    return token ? { scope, token } : null;
  }, [entry, scope, canMutate, isCurrent]);
  const currentWrite = useCallback((ticket: DashboardWriteTicket) => isCurrent() && ticket.scope === scope && entry.pending === ticket.token, [entry, scope, isCurrent]);
  const fence = useCallback((ticket: DashboardWriteTicket) => fenceDashboardWrite(entry, ticket.token, resource), [entry, resource]);
  const finish = useCallback((ticket: DashboardWriteTicket) => finishDashboardWrite(entry, ticket.token), [entry]);
  const readSucceeded = useCallback(() => confirmDashboardRead(entry, resource), [entry, resource]);
  const acknowledge = useCallback(() => reviewDashboardRead(entry), [entry]);
  return { scope, version, canMutate, isScopeCurrent: isCurrent, startRead, currentRead, readSettled, beginWrite, currentWrite, fence, finish, readSucceeded, acknowledge,
    busy: entry.pending !== null, blocked: entry.unresolved.size > 0,
    needsResourceReconciliation: entry.unresolved.has(resource),
    reviewReady: entry.unresolved.size > 0 && [...entry.unresolved.values()].every(Boolean) };
}

export function uncertainDashboardWrite(error: NormalizedApiError) {
  return error.status === 0 || error.status >= 500 || error.code === "GW.IDEM.IN_FLIGHT"
    || error.code === "IDEMPOTENCY_REQUEST_PROCESSING";
}
export function dashboardWriteDenied(): NormalizedApiError { return { status: 403, code: "CRM_PERMISSION_DENIED" }; }
export function invalidDashboardReceipt(): never { throw new Error("CRM_DASHBOARD_RECEIPT_INVALID"); }
