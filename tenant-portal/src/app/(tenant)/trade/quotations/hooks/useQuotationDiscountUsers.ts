"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchTenantUsers, type TenantUser } from "../../../core/contracts/user-contract";

/** The existing Core user directory supplies names; UUID text is never an input. */
export function useQuotationDiscountUsers(enabled: boolean) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const identity = JSON.stringify([user?.id, realtimeAuthGeneration]);
  const [query, setQuery] = useState({ identity, search: "", page: 1, attempt: 0 });
  const currentQuery = query.identity === identity ? query : { identity, search: "", page: 1, attempt: 0 };
  const { search, page, attempt } = currentQuery;
  const key = JSON.stringify([identity, search, page, attempt]);
  const [state, setState] = useState<{ key: string; search: string; identity: string; items: TenantUser[]; hasMore: boolean; error: NormalizedApiError | null } | null>(null);
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchTenantUsers({ page, search, filters: { status: "ACTIVE" }, signal: controller.signal,
        suppressForbiddenToast: true, sortBy: "firstName", sortDir: "ASC",
      }).then((result) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ key, search, identity, error: null, hasMore: result.hasNext,
          items: [...new Map([...(page > 1 && previous?.identity === identity && previous.search === search ? previous.items : []),
            ...result.items].map((item) => [item.id, item])).values()] }));
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ key, search, identity, items: [], hasMore: false, error: normalizeApiError(error) });
      });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [attempt, enabled, identity, key, page, search, user?.id]);
  const current = enabled && state?.key === key ? state : null;
  return { items: current?.items ?? [], loading: enabled && !current, error: current?.error ?? null,
    search, hasMore: current?.hasMore ?? false,
    setSearch: (value: string) => setQuery({ ...currentQuery, search: value.slice(0, 120), page: 1 }),
    loadMore: () => { if (current?.hasMore) setQuery({ ...currentQuery, page: page + 1 }); },
    retry: () => setQuery({ ...currentQuery, attempt: attempt + 1 }),
  };
}
