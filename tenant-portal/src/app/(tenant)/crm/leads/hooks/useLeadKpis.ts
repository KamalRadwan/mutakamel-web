"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import {
  BODY_READ_OPTIONS,
  LEADS_KPIS_PATH,
  parseLeadKpisResponse,
  type LeadKpis,
} from "../lead-bulk-contract";
import { buildLeadBoardRequest } from "../lead-board-contract";
import type { LeadSearchState } from "../lead-search-contract";

/** The request body as a string, or "" when there is nothing that may be asked. */
function kpiBodyKey(search: LeadSearchState, branchId: string, actorId: string | undefined): string {
  if (search.mode === "basic" && search.basic.myLeads && !isUUIDv7(actorId)) return "";
  try {
    return JSON.stringify(
      buildLeadBoardRequest(search, { branchId, page: 1, limit: 50, sortBy: "createdAt", sortDir: "DESC" }, actorId),
    );
  } catch {
    // The list refuses the same search and reports it; the strip stays empty.
    return "";
  }
}

/**
 * The KPI strip's figures over EVERY lead the current search selects, from
 * `POST /api/tenant/crm/v1/leads/kpis` — not a count of the 50 rows a page or
 * a board lane happened to load. The body is the board's search body (the
 * backend ignores its paging), so the strip and the list always describe the
 * same selection. `null` until the first answer and after a failed read: the
 * strip then shows no figures rather than counting the loaded rows.
 */
export function useLeadKpis({
  branchId,
  search,
  revision,
  enabled,
}: {
  branchId: string | null;
  search: LeadSearchState;
  revision: number;
  enabled: boolean;
}): LeadKpis | null {
  const { user } = useTenantAuth();
  const [kpis, setKpis] = useState<LeadKpis | null>(null);
  // Keyed on the serialized body rather than the search object, so a render
  // that rebuilds an equal search does not read the figures again.
  const bodyKey = enabled && branchId ? kpiBodyKey(search, branchId, user?.id) : "";

  useEffect(() => {
    const controller = new AbortController();
    if (!bodyKey) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setKpis(null);
      });
      return () => controller.abort();
    }
    void axiosClient
      .post<unknown>(LEADS_KPIS_PATH, JSON.parse(bodyKey) as unknown, {
        ...BODY_READ_OPTIONS,
        signal: controller.signal,
      })
      .then((response) => {
        if (!controller.signal.aborted) setKpis(parseLeadKpisResponse(response.data));
      })
      .catch(() => {
        if (!controller.signal.aborted) setKpis(null);
      });
    return () => controller.abort();
  }, [bodyKey, revision]);

  return kpis;
}
