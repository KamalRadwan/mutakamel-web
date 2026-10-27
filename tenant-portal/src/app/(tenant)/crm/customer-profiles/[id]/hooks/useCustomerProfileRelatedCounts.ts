"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { readTradeData } from "@/lib/api/envelope";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CUSTOMER_RELATED_KINDS,
  CUSTOMER_OPPORTUNITY_SEARCH_PATH,
  canReadCustomerRelated,
  customerInvoicesCountPath,
  customerOpportunitySearch,
  customerQuotationsCountPath,
  customerSalesOrdersCountPath,
  parseCustomerRelatedTotal,
  type CustomerRelatedKind,
} from "../customer-profile-related-contract";

type CustomerRelatedCounts = Record<CustomerRelatedKind, number | null>;

export interface CustomerProfileRelatedCountsState {
  counts: CustomerRelatedCounts;
  permitted: Record<CustomerRelatedKind, boolean>;
  isLoading: boolean;
}

const EMPTY_COUNTS: CustomerRelatedCounts = {
  opportunities: null,
  quotations: null,
  salesOrders: null,
  invoices: null,
};

const RESPONSE_LIMIT_BYTES = 64 * 1024;

export function useCustomerProfileRelatedCounts(
  customerProfileId: string | null,
  partyId: string | null,
  branchId: string | null,
): CustomerProfileRelatedCountsState {
  const { user } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [counts, setCounts] = useState<CustomerRelatedCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(false);

  const permissions = user?.permissions ?? [];
  const permitted = Object.fromEntries(
    CUSTOMER_RELATED_KINDS.map((kind) => [
      kind,
      canReadCustomerRelated(permissions, kind),
    ]),
  ) as Record<CustomerRelatedKind, boolean>;

  const permittedKey = CUSTOMER_RELATED_KINDS.map((kind) =>
    permitted[kind] ? "1" : "0",
  ).join("");
  const scopeHeaders = scope.headers;

  useEffect(() => {
    if (
      !isUUIDv7(customerProfileId) ||
      !isUUIDv7(partyId) ||
      !isUUIDv7(branchId)
    ) {
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setCounts(EMPTY_COUNTS);
      setIsLoading(true);
      const config = {
        signal: controller.signal,
        cache: "no-store" as const,
        maxResponseBytes: RESPONSE_LIMIT_BYTES,
      };

      async function countOf(kind: CustomerRelatedKind): Promise<number | null> {
        if (!permitted[kind]) return null;
        try {
          if (kind === "opportunities") {
            const response = await axiosClient.post<unknown>(
              CUSTOMER_OPPORTUNITY_SEARCH_PATH,
              customerOpportunitySearch(partyId!, branchId!),
              {
                ...config,
                skipAutoIdempotency: true,
                replayAfterRefresh: true,
                headers: scopeHeaders ?? undefined,
              },
            );
            return parseCustomerRelatedTotal(response.data);
          }
          if (!scopeHeaders) return null;
          const path =
            kind === "quotations"
              ? customerQuotationsCountPath(partyId!)
              : kind === "salesOrders"
                ? customerSalesOrdersCountPath(partyId!)
                : customerInvoicesCountPath(partyId!);
          return parseCustomerRelatedTotal(
            await readTradeData(path, {
              ...config,
              headers: scopeHeaders,
            }),
          );
        } catch {
          return null;
        }
      }

      void Promise.all(CUSTOMER_RELATED_KINDS.map(countOf)).then((results) => {
        if (controller.signal.aborted) return;
        setCounts(
          Object.fromEntries(
            CUSTOMER_RELATED_KINDS.map((kind, index) => [kind, results[index]]),
          ) as CustomerRelatedCounts,
        );
        setIsLoading(false);
      });
    });
    return () => controller.abort();
    // `permitted` is rebuilt every render; `permittedKey` is what actually
    // changes when a permission does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, customerProfileId, partyId, permittedKey, scopeHeaders]);

  return { counts, permitted, isLoading };
}
