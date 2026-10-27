"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import type { LeadStageItem } from "../../../lead-stages/lead-stage-contract";
import { readLeadStageCatalogue } from "../../../shared/lead-stage-catalogue";
import type { LeadDetail } from "../../lead-contract";
import { fetchLeadDetail } from "../../lead-requests";
import type { LeadDetailCard } from "../lead-detail-card-contract";

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
  const [card, setCard] = useState<LeadDetailCard | null>(null);
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
          fetchLeadDetail(leadId, signal),
          readLeadStageCatalogue(signal),
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

        const nextStages = stagesSettled.status === "fulfilled" ? stagesSettled.value : null;
        setLead(leadSettled.value.lead);
        setCard(leadSettled.value.card);
        setStages(nextStages ?? []);
        setStagesDegraded(nextStages === null);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setLead(null);
        setCard(null);
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

  const activeStages = useMemo(() => stages.filter(({ isActive }) => isActive), [stages]);

  return {
    lead,
    card,
    stages: activeStages,
    stageCatalogue: stages,
    stagesDegraded,
    isLoading,
    error,
    isNotFound: error?.status === 404,
    isForbidden: error?.status === 403,
    reload,
    setLead,
    setCard,
  };
}
