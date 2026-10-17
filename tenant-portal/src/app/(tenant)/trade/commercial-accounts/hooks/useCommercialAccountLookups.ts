"use client";

import { useCallback, useEffect, useState } from "react";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import { ACCOUNTS_PATH } from "../commercial-account-contract";

export interface PaymentTermLookupOption {
  id: string;
  source: string;
}

export interface CreditPolicyLookupOption {
  id: string;
  code: string;
  versionNumber: number;
  scopeTarget: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CommercialAccountLookupsData {
  paymentTerms: PaymentTermLookupOption[];
  creditPolicies: CreditPolicyLookupOption[];
}

export function parseCommercialAccountLookups(raw: unknown): CommercialAccountLookupsData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { paymentTerms: [], creditPolicies: [] };
  }
  const obj = raw as Record<string, unknown>;
  const paymentTerms: PaymentTermLookupOption[] = Array.isArray(obj.paymentTerms)
    ? obj.paymentTerms
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .filter((item) => typeof item.id === "string")
        .map((item) => ({
          id: String(item.id),
          source: typeof item.source === "string" ? item.source : "existing_commercial_accounts",
        }))
    : [];

  const creditPolicies: CreditPolicyLookupOption[] = Array.isArray(obj.creditPolicies)
    ? obj.creditPolicies
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .filter((item) => typeof item.id === "string" && typeof item.code === "string")
        .map((item) => ({
          id: String(item.id),
          code: String(item.code),
          versionNumber: typeof item.versionNumber === "number" ? item.versionNumber : 1,
          scopeTarget: typeof item.scopeTarget === "string" ? item.scopeTarget : "COMPANY",
          status: typeof item.status === "string" ? item.status : "PUBLISHED",
          effectiveFrom: typeof item.effectiveFrom === "string" ? item.effectiveFrom : "",
          effectiveTo: typeof item.effectiveTo === "string" ? item.effectiveTo : null,
        }))
    : [];

  return { paymentTerms, creditPolicies };
}

export function useCommercialAccountLookups(enabled = true) {
  const read = useTradeScopeRequest("COMPANY_OR_BRANCH");
  const [lookups, setLookups] = useState<CommercialAccountLookupsData>({
    paymentTerms: [],
    creditPolicies: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadLookups = useCallback(
    async (search?: string, signal?: AbortSignal) => {
      if (!enabled || read.gap) return;
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (search && search.trim()) {
          params.set("search", search.trim().slice(0, 80));
        }
        const res = await tradeGet(`${ACCOUNTS_PATH}/lookups?${params.toString()}`, {
          signal,
          headers: read.headers,
        });
        setLookups(parseCommercialAccountLookups(res.data));
      } catch {
        // Non-blocking lookup enhancement: manual UUID input remains available if lookups fail
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [enabled, read.gap, read.headers],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadLookups(undefined, controller.signal);
      }
    });
    return () => controller.abort();
  }, [enabled, loadLookups]);

  return {
    lookups,
    isLoadingLookups: isLoading,
    reloadLookups: loadLookups,
  };
}
