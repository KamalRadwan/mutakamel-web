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

export interface RemoteOptions {
  options: ComboboxOption[];
  isLoading: boolean;
  search: (query: string) => void;
  /** Labels the screen already resolved, so a selected row is never a bare id. */
  labelFor: (id: string | null | undefined) => string | undefined;
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
      load(query, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setOptions(next);
          setLabels((current) => ({
            ...current,
            ...Object.fromEntries(next.map((option) => [option.value, option.label])),
          }));
        })
        .catch(() => {
          // A picker that cannot load is an empty picker with its own empty
          // label, not a screen-level failure — the form still reports the
          // server's answer when the user submits.
          if (!controller.signal.aborted) setOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, load, query, resetKey]);

  return useMemo(
    () => ({
      options,
      isLoading,
      search: setQuery,
      labelFor: (id) => (id ? labels[id] : undefined),
    }),
    [isLoading, labels, options],
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

export function useRoleOptions(enabled = true): RemoteOptions {
  const lang = useLanguage();
  const load = useCallback(
    async (query: string, signal: AbortSignal): Promise<ComboboxOption[]> => {
      const page = await fetchTenantRoles({ page: 1, search: query, signal });
      return page.items.map((role) => ({
        value: role.id,
        label: localizedValue(role.nameAr, role.nameEn, lang),
      }));
    },
    [lang],
  );

  return useRemoteOptions({ load, enabled, resetKey: `roles:${lang}` });
}
