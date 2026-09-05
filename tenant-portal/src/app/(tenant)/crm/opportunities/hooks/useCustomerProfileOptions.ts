"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import {
  buildCustomerProfilesListPath,
  parseCustomerProfilesPageResponse,
  type CustomerProfileItem,
} from "../../customer-profiles/hooks/useCustomerProfiles";
import { customerProfileTextSearch } from "../../customer-profiles/customer-profile-search-contract";

/**
 * Customer profiles as picker options for the opportunity create drawer.
 *
 * `CreateOpportunityDto.customerProfileId` is required and the service refuses
 * a `BLACKLISTED` customer with `409 CUSTOMER_PROFILE_BLACKLISTED`, so those
 * are filtered out of the list rather than offered and then rejected.
 *
 * A remote list, deliberately: a tenant can hold thousands of profiles and a
 * `Select` over all of them is unusable. The `Combobox` sends the typed query
 * back through the list's free-text field — a picker matches people by name,
 * so it never uses the other three filters the list screen offers.
 */
export function useCustomerProfileOptions(
  branchId: string | null,
  enabled: boolean,
) {
  const [items, setItems] = useState<CustomerProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (search: string, signal?: AbortSignal) => {
      if (!enabled || !isUUIDv7(branchId)) {
        setItems([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await axiosClient.get<unknown>(
          buildCustomerProfilesListPath({
            branchId,
            page: 1,
            search: customerProfileTextSearch(search),
          }),
          { signal, cache: "no-store", maxResponseBytes: 512 * 1024 },
        );
        const page = parseCustomerProfilesPageResponse(response.data, branchId);
        setItems(page.items.filter(({ status }) => status !== "BLACKLISTED"));
      } catch {
        if (signal?.aborted) return;
        setItems([]);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, enabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred so the loading flag is not written synchronously in the effect
    // body — `react-hooks/set-state-in-effect`.
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(query, controller.signal);
    });
    return () => controller.abort();
  }, [load, query]);

  return { items, isLoading, search: setQuery };
}
