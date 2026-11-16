"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { safeStorage } from "@/lib/safeStorage";
import { isUUIDv7 } from "@/lib/uuid";
import { resolveTradeScope, type TradeOperatingContext, type TradeScopeGap, type TradeScopeTarget } from "./trade-scope";
import type { Channel } from "./channels/channel-contract";
import { useTradeChannelChoices } from "./hooks/useTradeChannelChoices";
import { useTradeBranchChoices } from "./hooks/useTradeBranchChoices";

const COMPANY_KEY = "tenant_trade_company";
const BRANCH_KEY = "tenant_trade_branch";
const CHANNEL_KEY = "tenant_trade_channel";
const ITEM_MASTER_SCOPE = "__tenant__";
export type TradeScopeChange = { kind: "company" | "branch" | "channel"; value: string | null }
  | { kind: "context"; value: TradeOperatingContext; label: string };
type ContextGuard = (change: TradeScopeChange) => boolean;

export interface TradeScopeValue {
  context: TradeOperatingContext;
  companyIds: readonly string[];
  branchIds: readonly string[];
  isLoadingBranches: boolean;
  branchesError: NormalizedApiError | null;
  refreshBranches: () => void;
  channels: readonly Channel[];
  unavailableChannels?: readonly Channel[];
  isLoadingChannels: boolean;
  channelsError: NormalizedApiError | null;
  refreshChannels: () => void;
  selectCompany: (id: string | null) => void;
  selectBranch: (id: string | null) => void;
  selectChannel: (id: string | null) => void;
  selectContext: (context: TradeOperatingContext, label: string) => void;
  headersFor: (target: TradeScopeTarget) => Record<string, string>;
  gapFor: (target: TradeScopeTarget) => TradeScopeGap | null;
  contextLocked: boolean;
  registerContextGuard: (guard: ContextGuard, locked: boolean) => () => void;
  applyContextChange: (change: TradeScopeChange) => void;
}
const TradeScopeContext = createContext<TradeScopeValue | null>(null);
function storedId(key: string, allowed: readonly string[]): string | null {
  const value = safeStorage.getItem(key);
  return value && isUUIDv7(value) && allowed.includes(value) ? value : null;
}

export function TradeScopeProvider({ children }: { children: React.ReactNode }) {
  const isPriceBookList = usePathname() === "/trade/price-books";
  const { user } = useTenantAuth();
  const companyIds = useMemo(() => [...new Set((user?.accessibleCompanies ?? []).filter(isUUIDv7))], [user]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const guard = useRef<ContextGuard | null>(null);
  const [contextLocked, setContextLocked] = useState(false);
  const branchChoices = useTradeBranchChoices(companyId);
  const { branchIds, isLoadingBranches } = branchChoices;
  const channelChoices = useTradeChannelChoices(companyId, branchId);
  const { channels, channelsError, isLoadingChannels } = channelChoices;
  useEffect(() => {
    if (!isPriceBookList) return;
    queueMicrotask(() => { setBranchId(null); setChannelId(null); });
  }, [isPriceBookList]);
  useEffect(() => {
    if (companyIds.length === 0) return;
    queueMicrotask(() => setCompanyId((current) => current && companyIds.includes(current) ? current
      : !isPriceBookList && safeStorage.getItem(COMPANY_KEY) === ITEM_MASTER_SCOPE ? null
        : storedId(COMPANY_KEY, companyIds) ?? (isPriceBookList || companyIds.length === 1 ? companyIds[0] : null)));
  }, [companyIds, isPriceBookList]);
  useEffect(() => {
    if (isPriceBookList || isLoadingBranches || contextLocked || safeStorage.getItem(COMPANY_KEY) === ITEM_MASTER_SCOPE) return;
    queueMicrotask(() => setBranchId((current) => current && branchIds.includes(current)
      ? current : storedId(BRANCH_KEY, branchIds)));
  }, [branchIds, contextLocked, isLoadingBranches, isPriceBookList]);
  useEffect(() => {
    if (!companyId || isLoadingChannels || channelsError || contextLocked) return;
    queueMicrotask(() => setChannelId((current) => {
      if (current && channels.some((channel) => channel.id === current)) return current;
      const saved = storedId(CHANNEL_KEY, channels.map((channel) => channel.id));
      if (!saved) safeStorage.removeItem(CHANNEL_KEY);
      return saved;
    }));
  }, [channels, channelsError, companyId, contextLocked, isLoadingChannels]);

  const context = useMemo<TradeOperatingContext>(() => ({ companyId, branchId, channelId }),
    [companyId, branchId, channelId]);
  const applyContextChange = useCallback((change: TradeScopeChange) => {
    if (change.kind === "context") {
      const next = change.value;
      const accessibleBranches = user?.accessibleBranches ?? [];
      if (!next.companyId || !companyIds.includes(next.companyId) || !next.branchId
        || !isUUIDv7(next.branchId) || !accessibleBranches.includes(next.branchId)
        || (next.channelId !== null && !isUUIDv7(next.channelId))) return;
      // The quotation dropdowns' sole-branch channel fallback verifies company ownership and the channel
      // mapping before submitting this complete context. Commit all three choices in one render.
      safeStorage.setItem(COMPANY_KEY, next.companyId);
      safeStorage.setItem(BRANCH_KEY, next.branchId);
      if (next.channelId) safeStorage.setItem(CHANNEL_KEY, next.channelId);
      else safeStorage.removeItem(CHANNEL_KEY);
      setCompanyId(next.companyId); setBranchId(next.branchId); setChannelId(next.channelId);
      return;
    }
    const next = change.value;
    if (change.kind === "company") {
      if (next !== null && (!isUUIDv7(next) || !companyIds.includes(next))) return;
      safeStorage.setItem(COMPANY_KEY, next ?? ITEM_MASTER_SCOPE);
      setCompanyId(next); setBranchId(null); setChannelId(null);
      safeStorage.removeItem(BRANCH_KEY); safeStorage.removeItem(CHANNEL_KEY);
    } else if (change.kind === "branch") {
      if (next !== null && (!companyId || !isUUIDv7(next) || !branchIds.includes(next))) return;
      if (next) safeStorage.setItem(BRANCH_KEY, next); else safeStorage.removeItem(BRANCH_KEY);
      setBranchId(next); setChannelId(null); safeStorage.removeItem(CHANNEL_KEY);
    } else {
      if (next !== null && (!isUUIDv7(next) || !channels.some((channel) => channel.id === next))) return;
      if (next) safeStorage.setItem(CHANNEL_KEY, next); else safeStorage.removeItem(CHANNEL_KEY);
      setChannelId(next);
    }
  }, [branchIds, channels, companyId, companyIds, user]);
  const requestChange = useCallback((change: TradeScopeChange) => {
    if (change.kind === "context") {
      if ((change.value.companyId === companyId && change.value.branchId === branchId
        && change.value.channelId === channelId) || (guard.current && !guard.current(change))) return;
      applyContextChange(change);
      return;
    }
    const current = change.kind === "company" ? companyId : change.kind === "branch" ? branchId : channelId;
    if (change.value === current || (guard.current && !guard.current(change))) return;
    applyContextChange(change);
  }, [applyContextChange, branchId, channelId, companyId]);
  const registerContextGuard = useCallback((handler: ContextGuard, locked: boolean) => {
    guard.current = handler; setContextLocked(locked);
    return () => { if (guard.current === handler) { guard.current = null; setContextLocked(false); } };
  }, []);
  const value = useMemo<TradeScopeValue>(() => ({
    context, companyIds, ...branchChoices, ...channelChoices, contextLocked, registerContextGuard, applyContextChange,
    selectCompany: (id) => requestChange({ kind: "company", value: id }),
    selectBranch: (id) => requestChange({ kind: "branch", value: id }),
    selectChannel: (id) => requestChange({ kind: "channel", value: id }),
    selectContext: (next, label) => requestChange({ kind: "context", value: next, label }),
    headersFor: (target) => { const result = resolveTradeScope(target, context); return result.ok ? result.headers : {}; },
    gapFor: (target) => { const result = resolveTradeScope(target, context); return result.ok ? null : result.gap; },
  }), [context, companyIds, branchChoices, channelChoices, contextLocked, registerContextGuard, applyContextChange, requestChange]);
  return <TradeScopeContext.Provider value={value}>{children}</TradeScopeContext.Provider>;
}

export function useOptionalTradeScope(): TradeScopeValue | null { return useContext(TradeScopeContext); }
export function useTradeScope(): TradeScopeValue {
  const scope = useOptionalTradeScope();
  if (!scope) throw new Error("useTradeScope must be used inside TradeScopeProvider.");
  return scope;
}
export interface TradeScopeRequest { headers: Record<string, string>; gap: TradeScopeGap | null }
export function useTradeScopeRequest(target: TradeScopeTarget,
  { includeChannel = true }: { includeChannel?: boolean } = {}): TradeScopeRequest {
  const { context, companyIds, branchIds } = useTradeScope();
  return useMemo(() => {
    const effective = target === "COMPANY" || target === "BRANCH" || target === "COMPANY_OR_BRANCH"
      ? { companyId: context.companyId ?? (companyIds.length === 1 ? companyIds[0] : null),
        branchId: context.branchId ?? (target === "BRANCH" && branchIds.length === 1 ? branchIds[0] : null),
        channelId: context.channelId } : context;
    const result = resolveTradeScope(target, includeChannel ? effective : { ...effective, channelId: null });
    return result.ok ? { headers: result.headers, gap: null } : { headers: {}, gap: result.gap };
  }, [target, context, companyIds, branchIds, includeChannel]);
}
