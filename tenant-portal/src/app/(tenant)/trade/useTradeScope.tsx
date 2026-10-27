"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { safeStorage } from "@/lib/safeStorage";
import { isUUIDv7 } from "@/lib/uuid";
import { ChannelPageLimitError, loadChannels } from "./channels/load-channels";
import {
  resolveTradeScope,
  type TradeOperatingContext,
  type TradeScopeGap,
  type TradeScopeTarget,
} from "./trade-scope";
import type { Channel } from "./channels/channel-contract";

// The Trade operating context, mounted once for the whole route group.
//
// It is a different axis from CRM's branch selector: CRM sends a `branchId`
// QUERY parameter that the app validates, Trade sends up to three HEADERS that
// `TradeScopeGuard` resolves into the scope target a route's permission is then
// checked at. A tenant-scoped grant does not satisfy a branch-scoped route, so
// changing this selection changes which permissions apply, not only which rows
// come back.
//
// Channel options come from `GET /channels`, which is the only name source
// Trade offers for any part of this selection: `/auth/me` carries company and
// branch **ids** and nothing else, which is why they render as ids here — the
// same shape `TenantBranchSelect` already uses across CRM.

const COMPANY_KEY = "tenant_trade_company";
const ITEM_MASTER_SCOPE = "__tenant__";
const BRANCH_KEY = "tenant_trade_branch";
const CHANNEL_KEY = "tenant_trade_channel";
const CHANNELS_RESPONSE_LIMIT_BYTES = 200_000;

export interface TradeScopeValue {
  context: TradeOperatingContext;
  companyIds: readonly string[];
  branchIds: readonly string[];
  channels: readonly Channel[];
  isLoadingChannels: boolean;
  /** `GET /channels` failed — a 403 here is an ordinary answer, not a bug. */
  channelsError: NormalizedApiError | null;
  refreshChannels: () => void;
  selectCompany: (companyId: string | null) => void;
  selectBranch: (branchId: string | null) => void;
  selectChannel: (channelId: string | null) => void;
  /** Headers for one route's scope target, or `{}` when the target cannot be met. */
  headersFor: (target: TradeScopeTarget) => Record<string, string>;
  /** What the target still needs, so a screen can ask instead of firing a 400. */
  gapFor: (target: TradeScopeTarget) => TradeScopeGap | null;
}

const TradeScopeContext = createContext<TradeScopeValue | null>(null);

function storedId(key: string, allowed: readonly string[]): string | null {
  const value = safeStorage.getItem(key);
  return value && isUUIDv7(value) && allowed.includes(value) ? value : null;
}

export function TradeScopeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useTenantAuth();
  const { t } = useI18n();

  const companyIds = useMemo(
    () => [...new Set((user?.accessibleCompanies ?? []).filter(isUUIDv7))],
    [user],
  );
  const accessibleBranchIds = useMemo(
    () => [...new Set((user?.accessibleBranches ?? []).filter(isUUIDv7))],
    [user],
  );

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState<NormalizedApiError | null>(null);
  const [channelsRevision, setChannelsRevision] = useState(0);
  const refreshChannels = useCallback(() => setChannelsRevision((revision) => revision + 1), []);

  // Restored once the session is known, not on mount: `accessibleCompanies` is
  // empty during BOOTSTRAPPING and a stored id would be discarded as invalid.
  // Deferred to a microtask because a synchronous setState in an effect body
  // cascades a second render (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    if (companyIds.length === 0) return;
    queueMicrotask(() =>
      setCompanyId((current) =>
        current && companyIds.includes(current)
          ? current
          : safeStorage.getItem(COMPANY_KEY) === ITEM_MASTER_SCOPE
            ? null
            : (storedId(COMPANY_KEY, companyIds) ?? (companyIds.length === 1 ? companyIds[0] : null)),
      ),
    );
  }, [companyIds]);

  useEffect(() => {
    if (accessibleBranchIds.length === 0 || safeStorage.getItem(COMPANY_KEY) === ITEM_MASTER_SCOPE) return;
    queueMicrotask(() =>
      setBranchId((current) =>
        current && accessibleBranchIds.includes(current)
          ? current
          : storedId(BRANCH_KEY, accessibleBranchIds),
      ),
    );
  }, [accessibleBranchIds]);

  // The branches this company owns, from the actor's own team memberships —
  // the only place `/auth/me` states the branch-to-company pairing. An owner
  // has `accessScope.mode: "FULL"` and may hold no membership at all, so the
  // fallback is every accessible branch and `TradeScopeGuard` is left to refuse
  // a wrong pair with 422 TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH.
  const branchIds = useMemo(() => {
    if (!companyId) return accessibleBranchIds;
    const paired = (user?.teamMemberships ?? [])
      .filter((membership) => membership.companyId === companyId && membership.branchId !== null)
      .map((membership) => membership.branchId as string)
      .filter((id) => accessibleBranchIds.includes(id));
    const distinct = [...new Set(paired)];
    return distinct.length > 0 ? distinct : accessibleBranchIds;
  }, [companyId, accessibleBranchIds, user]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!companyId) {
        setChannels([]);
        setChannelsError(null);
        setIsLoadingChannels(false);
        return;
      }
      setIsLoadingChannels(true);
      setChannelsError(null);
      // Deliberately company-only: sending the selected channel back on the
      // request that lists channels would let one inactive channel 422 the very
      // call that offers a different one.
      void loadChannels({
        signal: controller.signal,
        headers: { [COMPANY_SCOPE_HEADER]: companyId },
        maxResponseBytes: CHANNELS_RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const active = result.items.filter((channel) => channel.status === "ACTIVE");
          const saved = safeStorage.getItem(CHANNEL_KEY);
          if (saved && !active.some((channel) => channel.id === saved)) {
            safeStorage.removeItem(CHANNEL_KEY);
          }
          setChannels(active);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setChannels([]);
          setChannelsError(
            normalizeApiError(
              error instanceof ChannelPageLimitError ? new Error(t.trade.channelPageLimit) : error,
            ),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingChannels(false);
        });
    });
    return () => controller.abort();
  }, [companyId, channelsRevision, t.trade.channelPageLimit]);

  // A channel belongs to exactly one company, so a company change invalidates
  // it, and a stored id is only restored once it is known to still exist.
  useEffect(() => {
    queueMicrotask(() =>
      setChannelId((current) => {
        if (current) {
          return channels.some((channel) => channel.id === current) ? current : null;
        }
        return channels.length > 0
          ? storedId(
              CHANNEL_KEY,
              channels.map((channel) => channel.id),
            )
          : null;
      }),
    );
  }, [channels]);

  const selectCompany = useCallback((next: string | null) => {
    if (next !== null && (!isUUIDv7(next) || !companyIds.includes(next))) return;
    // An explicit tenant choice must survive the single-company default on reload.
    safeStorage.setItem(COMPANY_KEY, next ?? ITEM_MASTER_SCOPE);
    setCompanyId(next);
    setBranchId(null);
    setChannelId(null);
    setChannels([]);
    safeStorage.removeItem(BRANCH_KEY);
    safeStorage.removeItem(CHANNEL_KEY);
  }, [companyIds]);

  const selectBranch = useCallback((next: string | null) => {
    if (next === null) {
      safeStorage.removeItem(BRANCH_KEY);
      setBranchId(null);
      return;
    }
    if (!companyId || !isUUIDv7(next) || !branchIds.includes(next)) return;
    safeStorage.setItem(BRANCH_KEY, next);
    setBranchId(next);
  }, [companyId, branchIds]);

  const selectChannel = useCallback((next: string | null) => {
    if (next === null) {
      safeStorage.removeItem(CHANNEL_KEY);
      setChannelId(null);
      return;
    }
    if (!isUUIDv7(next) || !channels.some((channel) => channel.id === next)) return;
    safeStorage.setItem(CHANNEL_KEY, next);
    setChannelId(next);
  }, [channels]);

  const context = useMemo<TradeOperatingContext>(
    () => ({ companyId, branchId, channelId }),
    [companyId, branchId, channelId],
  );

  const value = useMemo<TradeScopeValue>(
    () => ({
      context,
      companyIds,
      branchIds,
      channels,
      isLoadingChannels,
      channelsError,
      refreshChannels,
      selectCompany,
      selectBranch,
      selectChannel,
      headersFor: (target) => {
        const resolution = resolveTradeScope(target, context);
        return resolution.ok ? resolution.headers : {};
      },
      gapFor: (target) => {
        const resolution = resolveTradeScope(target, context);
        return resolution.ok ? null : resolution.gap;
      },
    }),
    [
      context,
      companyIds,
      branchIds,
      channels,
      isLoadingChannels,
      channelsError,
      refreshChannels,
      selectCompany,
      selectBranch,
      selectChannel,
    ],
  );

  return <TradeScopeContext.Provider value={value}>{children}</TradeScopeContext.Provider>;
}

export function useTradeScope(): TradeScopeValue {
  const value = useContext(TradeScopeContext);
  if (!value) throw new Error("useTradeScope must be used inside TradeScopeProvider.");
  return value;
}

export interface TradeScopeRequest {
  headers: Record<string, string>;
  gap: TradeScopeGap | null;
}

/**
 * One route target's headers, with a **stable identity** across renders.
 *
 * `headersFor` builds a fresh object every call, which is correct for a render
 * but poison in an effect dependency array — every screen would refetch on
 * every render. This memoizes the context, target and channel-header option.
 */
export function useTradeScopeRequest(
  target: TradeScopeTarget,
  { includeChannel = true }: { includeChannel?: boolean } = {},
): TradeScopeRequest {
  const { context, companyIds, branchIds } = useTradeScope();
  return useMemo(() => {
    const effectiveContext: TradeOperatingContext =
      target === "COMPANY" || target === "BRANCH" || target === "COMPANY_OR_BRANCH"
        ? {
            companyId: context.companyId ?? (companyIds.length === 1 ? companyIds[0] : null),
            branchId:
              context.branchId ??
              (target === "BRANCH" && branchIds.length === 1 ? branchIds[0] : null),
            channelId: context.channelId,
          }
        : context;
    // Administration addresses the channel in the URL, independently of the
    // operating channel's activation or branch mappings.
    const resolution = resolveTradeScope(
      target,
      includeChannel ? effectiveContext : { ...effectiveContext, channelId: null },
    );
    return resolution.ok
      ? { headers: resolution.headers, gap: null }
      : { headers: {}, gap: resolution.gap };
  }, [target, context, companyIds, branchIds, includeChannel]);
}
