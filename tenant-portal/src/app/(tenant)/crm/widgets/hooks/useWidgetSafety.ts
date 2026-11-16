"use client";
import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useAccessMode } from "@/hooks/useAccessMode";

interface Entry { version: number; epoch: number; pending: symbol | null; unresolved: Map<string, string | null>; checked: Map<string, string>; listeners: Set<() => void>; }
const entries = new Map<string, Entry>();
export interface WidgetWriteTicket { token: symbol; scope: string; }
function notify(entry: Entry) { entry.version++; entry.listeners.forEach((listener) => listener()); }
function acquire(store: Entry) { const token = Symbol("widget-write"); store.pending = token; store.epoch++; notify(store); return token; }
function fenceStore(store: Entry, token: symbol, resource: string, subjectId?: string) { if (store.pending === token) { store.unresolved.set(resource, subjectId ?? null); store.checked.delete(resource); store.epoch++; notify(store); } }
function release(store: Entry, token: symbol) { if (store.pending === token) { store.pending = null; notify(store); } }
function checking(store: Entry, resource: string) { if (store.checked.delete(resource)) notify(store); }
export function useWidgetSafety(resource: string) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const grants = useAuthScopeKey(user);
  const { canMutate } = useAccessMode();
  const origin = typeof window === "undefined" ? "server" : window.location.origin;
  const key = JSON.stringify([origin, realtimeAuthGeneration ?? null, user?.id ?? null]);
  const scope = JSON.stringify([key, grants, resource, canMutate]);
  let entry = entries.get(key);
  if (!entry) { entry = { version: 0, epoch: 0, pending: null, unresolved: new Map(), checked: new Map(), listeners: new Set() }; entries.set(key, entry); }
  const store = entry;
  const subscribe = useCallback((listener: () => void) => { store.listeners.add(listener); return () => { store.listeners.delete(listener); }; }, [store]);
  const version = useSyncExternalStore(subscribe, () => store.version, () => 0);
  const current = useRef({ scope, active: false, sequence: 0 });
  useLayoutEffect(() => {
    current.current = { scope, active: true, sequence: current.current.sequence + 1 };
    return () => { current.current.active = false; current.current.sequence++; };
  }, [scope]);
  const isCurrent = useCallback(() => current.current.active && current.current.scope === scope, [scope]);
  const startRead = useCallback((write?: WidgetWriteTicket) => {
    if (!isCurrent() || (store.pending && store.pending !== write?.token)) return null;
    checking(store, resource);
    return { scope, sequence: ++current.current.sequence, epoch: store.epoch };
  }, [scope, store, resource, isCurrent]);
  const currentRead = useCallback((ticket: NonNullable<ReturnType<typeof startRead>>) => isCurrent() && ticket.scope === scope && ticket.sequence === current.current.sequence && ticket.epoch === store.epoch, [scope, store, isCurrent]);
  const reconciled = useCallback((ticket: NonNullable<ReturnType<typeof startRead>>) => {
    if (currentRead(ticket) && store.unresolved.has(resource)) { store.checked.set(resource, scope); notify(store); }
  }, [store, resource, scope, currentRead]);
  const beginWrite = useCallback((allowed: boolean): WidgetWriteTicket | null => {
    if (!allowed || !canMutate || !isCurrent() || store.pending || store.unresolved.size) return null;
    const token = acquire(store);
    return { token, scope };
  }, [canMutate, isCurrent, store, scope]);
  const currentWrite = useCallback((ticket: WidgetWriteTicket) => isCurrent() && ticket.scope === scope && store.pending === ticket.token, [isCurrent, scope, store]);
  const fence = useCallback((ticket: WidgetWriteTicket, subjectId?: string) => {
    fenceStore(store, ticket.token, resource, subjectId);
  }, [resource, store]);
  const finish = useCallback((ticket: WidgetWriteTicket) => release(store, ticket.token), [store]);
  const review = useCallback(() => {
    if (!isCurrent() || store.pending || store.checked.get(resource) !== scope) return;
    store.unresolved.delete(resource); store.checked.delete(resource); notify(store);
  }, [isCurrent, resource, store, scope]);
  return { scope, version, canMutate, isCurrent, startRead, currentRead, beginWrite, currentWrite, fence, finish, reconciled, review,
    isPending: () => store.pending !== null,
    busy: store.pending !== null, blocked: store.unresolved.size > 0, unresolved: store.unresolved.has(resource),
    unresolvedSubject: store.unresolved.get(resource) ?? null, reviewedRead: store.checked.get(resource) === scope };
}
