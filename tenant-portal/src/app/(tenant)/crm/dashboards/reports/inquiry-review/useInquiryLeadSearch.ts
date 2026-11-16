"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { parseLeadsResponse } from "../../../leads/lead-list-contract";
import type { InquirySelection } from "./contract";

const PAGE_SIZE = 20;
const MAX_PAGE = 10_000;
type Result = { key: string; items: InquirySelection[]; hasNext: boolean; error?: never } |
  { key: string; items?: never; hasNext?: never; error: NormalizedApiError };

export function useInquiryLeadSearch(branchId: string) {
  const [query, setQuery] = useState<{ term: string; page: number }>();
  const [outcome, setOutcome] = useState<Result>();
  const [attempt, setAttempt] = useState(0);
  const key = query && branchId ? JSON.stringify([branchId, query.term, query.page, attempt]) : null;

  useEffect(() => {
    if (!query || !key) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ branchId, page: String(query.page), limit: String(PAGE_SIZE) });
    if (query.term) {
      params.set("search", query.term);
      params.set("searchField", "lead");
    }
    void axiosClient.get<unknown>(`/api/tenant/crm/v1/leads?${params}`, {
      cache: "no-store", signal: controller.signal, maxResponseBytes: 1_048_576, suppressForbiddenToast: true,
    }).then(response => {
      if (controller.signal.aborted) return;
      const result = parseLeadsResponse(response.data, branchId);
      if (response.status !== 200 || result.page !== query.page || result.limit !== PAGE_SIZE) {
        throw new Error("Unexpected inquiry search page.");
      }
      const items = result.items.map(({ id, leadName, createdAt }) => ({ id, branchId, name: leadName, createdAt }));
      setOutcome({ key, items, hasNext: result.hasNext && query.page < MAX_PAGE });
    }).catch(error => {
      if (!controller.signal.aborted) setOutcome({ key, error: normalizeApiError(error) });
    });
    return () => controller.abort();
  }, [branchId, query, key]);

  const current = outcome?.key === key ? outcome : undefined;
  return {
    items: current?.items ?? [],
    error: current?.error,
    loading: Boolean(key && !current),
    hasNext: current?.hasNext,
    hasPrevious: Boolean(query && query.page > 1),
    search: (input: string) => {
      const term = input.trim().slice(0, 120);
      setQuery(prior => prior?.term === term && prior.page === 1 ? prior : { term, page: 1 });
    },
    move: (offset: -1 | 1) => setQuery(prior => prior ? { ...prior, page: Math.max(1, Math.min(MAX_PAGE, prior.page + offset)) } : prior),
    retry: () => setAttempt(value => value + 1),
  };
}
