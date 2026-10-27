"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export interface RemoteOptions {
  options: ComboboxOption[];
  isLoading: boolean;
  search: (query: string) => void;
  /** Labels the screen already resolved, so a selected row is never a bare id. */
  labelFor: (id: string | null | undefined) => string | undefined;
  error?: NormalizedApiError | null;
  retry?: () => void;
  isReady?: boolean;
}

interface OptionSource {
  load: (query: string, signal: AbortSignal) => Promise<ComboboxOption[]>;
  enabled: boolean;
  /** Re-runs the load when it changes — a parent filter, an enabling flag. */
  resetKey: string;
}

/**
 * One remote-picker loader for every Core identity picker.
 *
 * Every Core list route is `PaginationQueryDto`-shaped, so a picker is always
 * "first page, max limit, server-side `search`". `Combobox` debounces the query
 * and calls `onSearch`; this owns the request, the abort and the label cache the
 * trigger reads when the selected row is not on the current page.
 */
function useRemoteOptions(source: OptionSource): RemoteOptions {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const { load, enabled, resetKey } = source;

  // Every write is deferred past the effect body: React's compiler lint bans a
  // synchronous setState there because it cascades an extra render, and the
  // abort check keeps a torn-down picker from writing at all.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setOptions([]);
      setQuery("");
    });
    return () => controller.abort();
  }, [resetKey]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled) {
        setOptions([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      load(query, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setOptions(next);
          setLoadedKey(resetKey);
          setLabels((current) => ({
            ...current,
            ...Object.fromEntries(next.map((option) => [option.value, option.label])),
          }));
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setOptions([]);
            setError(normalizeApiError(cause));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, load, query, reloadToken, resetKey]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  return useMemo(
    () => ({
      options,
      isLoading,
      error,
      retry,
      isReady: enabled && loadedKey === resetKey && !isLoading && !error,
      search: setQuery,
      labelFor: (id) => (id ? labels[id] : undefined),
    }),
    [enabled, error, isLoading, labels, loadedKey, options, resetKey, retry],
  );
}

export function useOrgNodeOptions(
  level: OrgLevel,
  options: { parentId?: string; enabled?: boolean } = {},
): RemoteOptions {
  const { parentId, enabled = true } = options;
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<ComboboxOption[]> => {
      const page = await fetchOrgNodes(level, {
        page: 1,
        search: query,
        // A picker offers only nodes a child may actually be created under —
        // OrganizationService rejects an inactive parent with ORG_PARENT_INACTIVE.
        status: "ACTIVE",
        parentId,
        limit: CORE_MAX_PAGE_LIMIT,
        signal,
        suppressForbiddenToast: true,
      });
      return page.items.map((node) => ({
        value: node.id,
        label: node.name,
        description: node.code,
      }));
    },
    [level, parentId],
  );

  return useRemoteOptions({ load, enabled, resetKey: `${level}:${parentId ?? ""}` });
}

export function useTenantUserOptions(enabled = true): RemoteOptions {
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<ComboboxOption[]> => {
      const page = await fetchTenantUsers({
        page: 1,
        search: query,
        filters: { status: "ACTIVE" },
        signal,
        suppressForbiddenToast: true,
      });
      return page.items.map((user) => ({
        value: user.id,
        label: userDisplayName(user),
        description: user.email,
      }));
    },
    [],
  );

  return useRemoteOptions({ load, enabled, resetKey: "users" });
}

export function useRoleOptions(enabled = true, excludeOwnerRole = false): RemoteOptions {
  const lang = useLanguage();
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<ComboboxOption[]> => {
      const page = await fetchTenantRoles({ page: 1, search: query, signal, suppressForbiddenToast: true });
      return page.items.filter((role) => !excludeOwnerRole || role.name !== "Tenant Super Admin").map((role) => ({
        value: role.id,
        label: localizedValue(role.nameAr, role.nameEn, lang),
      }));
    },
    [excludeOwnerRole, lang],
  );

  return useRemoteOptions({ load, enabled, resetKey: `roles:${lang}` });
}
