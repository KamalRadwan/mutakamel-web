"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { parseLeadStageCatalogueResponse } from "../../../lead-stages/lead-stage-contract";
import type { LeadStageItem } from "../../../lead-stages/lead-stage-contract";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../../lead-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 512 * 1024;
const STAGES_RESPONSE_LIMIT_BYTES = 256 * 1024;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * One lead plus the stage catalogue that names its stage.
 *
 * `GET /leads/:id` carries `stageId` and `stageFlag` but **no stage name** —
 * `selectPartySummary` joins the acquisition source and not the stage — so the
 * label comes from `/lead-stages`, which is a tenant catalogue and never
 * hardcoded.
 *
 * The two sources settle independently. A stage catalogue that fails to load
 * must not blank a lead that loaded perfectly well; it degrades to the raw
 * stage flag, which `StatusBadge` can render on its own.
 */
export function useLeadDetail(leadId: string) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [stages, setStages] = useState<LeadStageItem[]>([]);
  const [stagesDegraded, setStagesDegraded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(leadId)) {
        // A malformed id in the address bar is a dead link, not a server
        // failure: 404 is the honest classification and NotFoundState offers
        // no retry, because a retry can never resolve it.
        setLead(null);
        setError({ status: 404 });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const [leadSettled, stagesSettled] = await Promise.allSettled([
          axiosClient.get<unknown>(leadPath(leadId), {
            signal,
            cache: "no-store",
            maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
          }),
          axiosClient.get<unknown>("/api/tenant/crm/v1/lead-stages", {
            signal,
            cache: "no-store",
            maxResponseBytes: STAGES_RESPONSE_LIMIT_BYTES,
          }),
        ]);
        if (
          [leadSettled, stagesSettled].some(
            (settled) =>
              settled.status === "rejected" && isAbortError(settled.reason),
          )
        ) {
          return;
        }
        if (leadSettled.status === "rejected") throw leadSettled.reason;

        const nextStages = readStages(stagesSettled);
        setLead(parseLeadDetailResponse(leadSettled.value.data));
        setStages(nextStages ?? []);
        setStagesDegraded(nextStages === null);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setLead(null);
        setStages([]);
        setStagesDegraded(false);
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  return {
    lead,
    stages: stages.filter(({ isActive }) => isActive),
    stageCatalogue: stages,
    stagesDegraded,
    isLoading,
    error,
    isNotFound: error?.status === 404,
    isForbidden: error?.status === 403,
    reload,
    setLead,
  };
}

function readStages(
  settled: PromiseSettledResult<AxiosResponse<unknown>>,
): LeadStageItem[] | null {
  if (settled.status === "rejected") return null;
  try {
    return parseLeadStageCatalogueResponse(settled.value.data);
  } catch {
    return null;
  }
}
