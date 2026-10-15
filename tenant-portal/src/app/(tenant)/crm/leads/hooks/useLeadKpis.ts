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

/**
 * The KPI strip's figures over EVERY lead the current search selects, from
 * `POST /api/tenant/crm/v1/leads/kpis` — not a count of the 50 rows a page or
 * a board lane happened to load. The body is the board's search body (the
 * backend ignores its paging), so the strip and the list always describe the
 * same selection. `null` while loading or when the read failed; the strip then
 * falls back to counting the loaded rows and says so.
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
}): { kpis: LeadKpis | null; failed: boolean } {
  const { user } = useTenantAuth();
  const [state, setState] = useState<{ kpis: LeadKpis | null; failed: boolean }>({ kpis: null, failed: false });
  const actorId = user?.id;

  useEffect(() => {
    const controller = new AbortController();
    if (
      !enabled ||
      !branchId ||
      (search.mode === "basic" && search.basic.myLeads && !isUUIDv7(actorId))
    ) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setState({ kpis: null, failed: false });
      });
      return () => controller.abort();
    }
    const body = buildLeadBoardRequest(search, { branchId, page: 1, limit: 50, sortBy: "createdAt", sortDir: "DESC" }, actorId);
    void axiosClient
      .post<unknown>(LEADS_KPIS_PATH, body, { ...BODY_READ_OPTIONS, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setState({ kpis: parseLeadKpisResponse(response.data), failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kpis: null, failed: true });
      });
    return () => controller.abort();
  }, [actorId, branchId, enabled, revision, search]);

  return state;
}
