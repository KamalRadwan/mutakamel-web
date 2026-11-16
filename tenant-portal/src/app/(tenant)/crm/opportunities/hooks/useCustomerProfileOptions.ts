"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { buildCustomerProfilesListPath, parseCustomerProfilesPageResponse, type CustomerProfileItem } from "../../customer-profiles/hooks/useCustomerProfiles";
import { customerProfileTextSearch } from "../../customer-profiles/customer-profile-search-contract";

interface CustomerOptionsState {
  key: string;
  items: CustomerProfileItem[];
  isLoading: boolean;
  error: NormalizedApiError | null;
  hasMore: boolean;
}
const EMPTY: CustomerOptionsState = { key: "", items: [], isLoading: false, error: null, hasMore: false };

/** A failed lookup stays an error; later pages remain reachable after eligibility filtering. */
export function useCustomerProfileOptions(branchId: string | null, enabled: boolean) {
  const { user } = useTenantAuth();
  const authKey = useAuthScopeKey(user);
  const [query, setQuery] = useState("");
  const [pagination, setPagination] = useState({ key: "", page: 1 });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<CustomerOptionsState>(EMPTY);
  const key = JSON.stringify([branchId, query, authKey]);
  const page = pagination.key === key ? pagination.page : 1;

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !isUUIDv7(branchId)) return () => controller.abort();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setState((current) => ({ ...(current.key === key ? current : EMPTY), key, isLoading: true, error: null }));
      void (async () => {
        try {
          const response = await axiosClient.get<unknown>(buildCustomerProfilesListPath({ branchId, page, search: customerProfileTextSearch(query) }), { signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024 });
          const result = parseCustomerProfilesPageResponse(response.data, branchId);
          if (result.page !== page) throw new Error("Invalid customer options page");
          if (controller.signal.aborted) return;
          setState((current) => ({ key, items: [...new Map([...(page > 1 && current.key === key ? current.items : []), ...result.items.filter(({ status }) => status !== "BLACKLISTED")].map((item) => [item.id, item])).values()], isLoading: false, error: null, hasMore: result.hasNext }));
        } catch (caught) {
          if (!controller.signal.aborted) setState((current) => ({ ...(current.key === key ? current : EMPTY), key, isLoading: false, error: normalizeApiError(caught) }));
        }
      })();
    });
    return () => controller.abort();
  }, [branchId, enabled, key, page, query, revision]);

  const search = useCallback((value: string) => setQuery(value), []);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const loadMore = useCallback(() => { if (state.key === key && !state.isLoading && !state.error && state.hasMore) setPagination({ key, page: page + 1 }); }, [state, key, page]);
  const current = enabled && state.key === key ? state : EMPTY;
  return { items: current.items, isLoading: enabled && isUUIDv7(branchId) && (state.key !== key || current.isLoading), error: current.error, hasMore: current.hasMore, search, reload, loadMore };
}
