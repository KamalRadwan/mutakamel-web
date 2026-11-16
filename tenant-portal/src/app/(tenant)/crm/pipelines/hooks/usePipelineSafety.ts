"use client";

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useAccessMode } from "@/hooks/useAccessMode";
import { acquirePipelineWrite, fencePipelineWrite, pipelineSafetyEntry, reconcilePipelineRead, releasePipelineWrite } from "./pipeline-safety-store";

interface ReadTicket { scope: string; sequence: number; epoch: number; }
export interface PipelineWriteTicket { token: symbol; scope: string; }

export function usePipelineSafety(resource: string) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const grants = useAuthScopeKey(user);
  const { canMutate } = useAccessMode();
  const origin = typeof window === "undefined" ? "server" : window.location.origin;
  const key = JSON.stringify([origin, realtimeAuthGeneration ?? null, user?.id ?? null]);
  const scope = JSON.stringify([key, grants, resource, canMutate]);
  const entry = pipelineSafetyEntry(key);
  const subscribe = useCallback((listener: () => void) => { entry.listeners.add(listener); return () => { entry.listeners.delete(listener); }; }, [entry]);
  const version = useSyncExternalStore(subscribe, () => entry.version, () => 0);
  const current = useRef({ scope, active: false, sequence: 0 });
  useLayoutEffect(() => {
    current.current = { scope, active: true, sequence: current.current.sequence + 1 };
    return () => { current.current.active = false; current.current.sequence++; };
  }, [scope]);
  const isScopeCurrent = useCallback(() => current.current.active && current.current.scope === scope, [scope]);
  const startRead = useCallback((write?: PipelineWriteTicket): ReadTicket | null => {
    if (!isScopeCurrent() || (entry.pending && entry.pending !== write?.token)) return null;
    return { scope, sequence: ++current.current.sequence, epoch: entry.epoch };
  }, [entry, scope, isScopeCurrent]);
  const currentRead = useCallback((ticket: ReadTicket) => isScopeCurrent() && ticket.scope === scope
    && ticket.sequence === current.current.sequence && ticket.epoch === entry.epoch, [entry, scope, isScopeCurrent]);
  const beginWrite = useCallback((allowed: boolean): PipelineWriteTicket | null => {
    if (!allowed || !canMutate || !isScopeCurrent()) return null;
    const token = acquirePipelineWrite(entry);
    return token ? { token, scope } : null;
  }, [entry, scope, canMutate, isScopeCurrent]);
  const currentWrite = useCallback((ticket: PipelineWriteTicket) => isScopeCurrent() && ticket.scope === scope && entry.pending === ticket.token, [entry, scope, isScopeCurrent]);
  const fence = useCallback((ticket: PipelineWriteTicket) => fencePipelineWrite(entry, ticket.token, resource), [entry, resource]);
  const reconciled = useCallback((ticket: ReadTicket) => { if (currentRead(ticket)) reconcilePipelineRead(entry, resource); }, [entry, resource, currentRead]);
  const finish = useCallback((ticket: PipelineWriteTicket) => releasePipelineWrite(entry, ticket.token), [entry]);
  const isPending = useCallback(() => entry.pending !== null, [entry]);
  return {
    scope, version, canMutate,
    busy: entry.pending !== null,
    needsReconciliation: entry.unresolved.size > 0,
    requiresCatalogue: entry.unresolved.has("catalogue"),
    startRead, currentRead, beginWrite,
    currentWrite, fence, reconciled, finish, isPending,
  };
}
