"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import type { ComboboxOption } from "@/design-system";
import { CORE_MAX_PAGE_LIMIT } from "../contracts/core-page";
import {
  fetchOrgNodes,
  type OrgLevel,
} from "../contracts/organization-contract";
import { fetchTenantUsers, userDisplayName } from "../contracts/user-contract";
import { fetchTenantRoles } from "../contracts/role-contract";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";

const EMPTY_OPTIONS: ComboboxOption[] = [];

export interface RemoteOptions {
  options: ComboboxOption[];
  isLoading: boolean;
  search: (query: string) => void;
  /** Labels the screen already resolved, so a selected row is never a bare id. */
  labelFor: (id: string | null | undefined) => string | undefined;
  error?: NormalizedApiError | null;
  retry?: () => void;
  isReady?: boolean;
  /** Server-reported total for the settled request, when exact. */
  total?: number;
  /** True when additional server pages exist beyond the loaded first page. */
  hasNext?: boolean;
  /** True only after an unsearched (`search === ""`) request settles without error. */
  isUnsearchedReady?: boolean;
}

interface LoadedOptionPage {
  options: ComboboxOption[];
  total?: number;
  hasNext: boolean;
}

interface OptionSource {
  load: (query: string, signal: AbortSignal) => Promise<LoadedOptionPage>;
  enabled: boolean;
  /** Re-runs the load when it changes — a parent filter, an enabling flag. */
  resetKey: string;
}

interface SnapshotState extends LoadedOptionPage {
  requestKey: string;
  query: string;
}

interface ErrorState {
  requestKey: string;
  error: NormalizedApiError;
}

interface LabelCacheState {
  resetKey: string;
  labels: Record<string, string>;
}

/**
 * One remote-picker loader for every Core identity picker.
 *
 * Every Core list route is `PaginationQueryDto`-shaped, so a picker is always
 * "first page, max limit, server-side `search`". `Combobox` debounces the query
 * and calls `onSearch`; this owns the request, the abort/sequence fence, exact
 * first-page metadata, and the label cache the trigger reads when the selected
 * row is not on the current page.
 */
function useRemoteOptions(source: OptionSource): RemoteOptions {
  const { load, enabled, resetKey } = source;
  const [queryState, setQueryState] = useState<{ resetKey: string; value: string }>({
    resetKey,
    value: "",
  });
  // Deriving query against `resetKey` resets search immediately on parent/locale
  // change without firing an intermediate request for the previous query.
  const query = queryState.resetKey === resetKey ? queryState.value : "";
  const [reloadToken, setReloadToken] = useState(0);
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [inFlightKey, setInFlightKey] = useState<string | null>(null);
  const [labelCache, setLabelCache] = useState<LabelCacheState>({
    resetKey,
    labels: {},
  });
  const requestSeqRef = useRef(0);
  const requestKey = `${resetKey}\u0000${query}\u0000${reloadToken}`;

  // Every write is deferred past the effect body: React's compiler lint bans a
  // synchronous setState there, and the monotonic sequence + AbortSignal fence
  // keeps out-of-order or torn-down requests from landing stale options.
  useEffect(() => {
    const seq = ++requestSeqRef.current;

    if (!enabled) {
      queueMicrotask(() => {
        if (requestSeqRef.current !== seq) return;
        setSnapshot(null);
        setErrorState(null);
        setInFlightKey(null);
      });
      return;
    }

    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted || requestSeqRef.current !== seq) return;
      setQueryState((current) =>
        current.resetKey === resetKey ? current : { resetKey, value: "" },
      );
      setInFlightKey(requestKey);
      setErrorState(null);

      load(query, controller.signal)
        .then((next) => {
          if (controller.signal.aborted || requestSeqRef.current !== seq) return;
          setSnapshot({
            requestKey,
            query,
            options: next.options,
            total: next.total,
            hasNext: next.hasNext,
          });
          setErrorState(null);
          setInFlightKey((current) => (current === requestKey ? null : current));
          setLabelCache((current) => ({
            resetKey,
            labels: {
              ...(current.resetKey === resetKey ? current.labels : {}),
              ...Object.fromEntries(next.options.map((option) => [option.value, option.label])),
            },
          }));
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted || requestSeqRef.current !== seq) return;
          setSnapshot((current) => (current?.requestKey === requestKey ? null : current));
          setErrorState({ requestKey, error: normalizeApiError(cause) });
          setInFlightKey((current) => (current === requestKey ? null : current));
        });
    });

    return () => controller.abort();
  }, [enabled, load, query, requestKey, resetKey]);

  const search = useCallback(
    (nextQuery: string) => {
      const normalized = nextQuery.trim();
      setQueryState((current) => {
        const currentNormalized = current.resetKey === resetKey ? current.value : "";
        if (current.resetKey === resetKey && currentNormalized === normalized) {
          return current;
        }
        return { resetKey, value: normalized };
      });
    },
    [resetKey],
  );

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const labelFor = useCallback(
    (id: string | null | undefined) =>
      enabled && labelCache.resetKey === resetKey && id ? labelCache.labels[id] : undefined,
    [enabled, labelCache, resetKey],
  );

  return useMemo(() => {
    const currentSnapshot =
      enabled && snapshot?.requestKey === requestKey ? snapshot : null;
    const currentError =
      enabled && errorState?.requestKey === requestKey ? errorState.error : null;
    const isLoading =
      enabled &&
      (inFlightKey === requestKey || (currentSnapshot === null && currentError === null));
    const isReady =
      currentSnapshot !== null && inFlightKey !== requestKey && currentError === null;

    return {
      options: currentSnapshot ? currentSnapshot.options : EMPTY_OPTIONS,
      isLoading,
      error: currentError,
      retry,
      isReady,
      total: isReady ? currentSnapshot.total : undefined,
      hasNext: isReady ? currentSnapshot.hasNext : undefined,
      isUnsearchedReady: isReady && currentSnapshot.query === "",
      search,
      labelFor,
    };
  }, [enabled, errorState, inFlightKey, labelFor, requestKey, retry, search, snapshot]);
}

export function useOrgNodeOptions(
  level: OrgLevel,
  options: { parentId?: string; companyId?: string; branchId?: string; includeInactive?: boolean; enabled?: boolean } = {},
): RemoteOptions {
  const { parentId, companyId, branchId, includeInactive = false, enabled = true } = options;
  const normalizedParentId = parentId?.trim() || undefined;
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<LoadedOptionPage> => {
      const page = await fetchOrgNodes(level, {
        page: 1,
        search: query,
        // A picker offers only nodes a child may actually be created under —
        // OrganizationService rejects an inactive parent with ORG_PARENT_INACTIVE.
        status: includeInactive ? undefined : "ACTIVE",
        parentId: normalizedParentId,
        ...(companyId ? { companyId } : {}),
        ...(branchId ? { branchId } : {}),
        limit: CORE_MAX_PAGE_LIMIT,
        signal,
        suppressForbiddenToast: true,
      });
      return {
        options: page.items.map((node) => ({
          value: node.id,
          label: node.name,
          ...(level === "companies" || level === "branches" ? {} : { description: node.code }),
        })),
        total: page.total,
        hasNext: page.hasNext,
      };
    },
    [level, normalizedParentId, companyId, branchId, includeInactive],
  );

  return useRemoteOptions({
    load,
    enabled,
    resetKey: `${level}:${normalizedParentId ?? ""}:${companyId ?? ""}:${branchId ?? ""}:${includeInactive}`,
  });
}

export function useTenantUserOptions(enabled = true): RemoteOptions {
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<LoadedOptionPage> => {
      const page = await fetchTenantUsers({
        page: 1,
        search: query,
        filters: { status: "ACTIVE" },
        signal,
        suppressForbiddenToast: true,
      });
      return {
        options: page.items.map((user) => ({
          value: user.id,
          label: userDisplayName(user),
          description: user.email,
        })),
        total: page.total,
        hasNext: page.hasNext,
      };
    },
    [],
  );

  return useRemoteOptions({ load, enabled, resetKey: "users" });
}

export function useRoleOptions(enabled = true, excludeOwnerRole = false): RemoteOptions {
  const lang = useLanguage();
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<LoadedOptionPage> => {
      const page = await fetchTenantRoles({
        page: 1,
        search: query,
        signal,
        suppressForbiddenToast: true,
      });
      const filtered = excludeOwnerRole
        ? page.items.filter((role) => role.name !== "Tenant Super Admin")
        : page.items;
      const removedCount = page.items.length - filtered.length;
      return {
        options: filtered.map((role) => ({
          value: role.id,
          label: localizedValue(role.nameAr, role.nameEn, lang),
        })),
        // Client-side owner filtering cannot know whether `Tenant Super Admin`
        // sits on a later server page, so omit `total` when `hasNext` is true.
        total: excludeOwnerRole && page.hasNext ? undefined : Math.max(0, page.total - removedCount),
        hasNext: page.hasNext,
      };
    },
    [excludeOwnerRole, lang],
  );

  return useRemoteOptions({
    load,
    enabled,
    resetKey: `roles:${lang}:${excludeOwnerRole ? "non-owner" : "all"}`,
  });
}
