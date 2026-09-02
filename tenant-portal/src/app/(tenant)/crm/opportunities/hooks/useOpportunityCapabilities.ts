"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import type { OpportunityCapabilities } from "./pipeline-types";
import { parseOpportunityCapabilitiesResponse } from "./usePipelineWorkspace";

const OPPORTUNITIES_CAPABILITIES_PATH =
  "/api/tenant/crm/v1/opportunities/capabilities";

const NO_CAPABILITIES: OpportunityCapabilities = {
  create: null,
  update: null,
  delete: null,
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Opportunity action boundaries for one branch — D11 / MASTER-PLAN 8.5.
 *
 * `crm.opportunities.capabilities.get` is `BRANCH_REQUIRED` in the Gateway
 * route contract, so the two scope headers are mandatory alongside the
 * `branchId` query parameter. Omitting them is `400 GW.REQUEST.INVALID` from
 * the Gateway, never a permission answer.
 *
 * This endpoint reports **only** `opportunities.{create,update,delete}` —
 * `OpportunitiesService.getCapabilities` resolves nothing else. Notes and
 * attachments capabilities come from `useCrmRecordCapabilities`, which is the
 * one endpoint that carries them.
 */
export function useOpportunityCapabilities(branchId: string | null) {
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [capabilities, setCapabilities] =
    useState<OpportunityCapabilities>(NO_CAPABILITIES);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(branchId) || !scope.ready) {
        setCapabilities(NO_CAPABILITIES);
        // D4: an unresolved organization scope is a gap on THIS side, so the
        // request is not sent at all. It used to go out with no headers and
        // come back 400 from the Gateway, which reads as a server refusal.
        setError(isUUIDv7(branchId) && !scope.ready ? SCOPE_UNRESOLVED_ERROR : null);
        return;
      }
      setError(null);
      try {
        const query = new URLSearchParams({ branchId }).toString();
        const response = await axiosClient.get<unknown>(
          `${OPPORTUNITIES_CAPABILITIES_PATH}?${query}`,
          {
            signal,
            cache: "no-store",
            maxResponseBytes: 64 * 1024,
            headers: scope.headers,
          },
        );
        setCapabilities(
          parseOpportunityCapabilitiesResponse(response.data, branchId),
        );
      } catch (caught) {
        if (isAbortError(caught)) return;
        setCapabilities(NO_CAPABILITIES);
        const normalized = normalizeApiError(caught);
        setError(normalized.status === 403 ? null : normalized);
      }
    },
    [branchId, scope],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return { capabilities, error };
}
