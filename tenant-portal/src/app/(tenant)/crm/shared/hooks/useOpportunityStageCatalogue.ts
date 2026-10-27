"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  OPPORTUNITY_STAGES_PATH,
  parseOpportunityStageDefinitionsResponse,
  type OpportunityStageDefinition,
} from "../../pipelines/pipeline-contract";

const CATALOGUE_RESPONSE_LIMIT_BYTES = 512 * 1024;

/**
 * The opportunity-stage catalogue shared by pipeline pickers and stage management.
 *
 * `GET /opportunity-stages` requires `crm.pipelines.manage` — the same
 * permission as creating a pipeline — so a user who can open the create modal
 * can read this. It still degrades rather than failing: a pipeline created with
 * no `stageIds` gets the canonical six, which is exactly what every pipeline
 * got before the picker existed, so an unreadable catalogue costs the choice
 * and not the pipeline.
 *
 * The route returns INACTIVE definitions too; selecting one is
 * `422 PIPELINE_STAGE_SELECTION_INVALID`. The filtering belongs to the picker,
 * which is the thing that knows it is offering a choice.
 */
export function useOpportunityStageCatalogue(enabled: boolean) {
  const [items, setItems] = useState<OpportunityStageDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const reload = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    if (signal?.aborted) return false;
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(OPPORTUNITY_STAGES_PATH, {
        signal,
        cache: "no-store",
        maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES,
      });
      if (signal?.aborted) return false;
      setItems(parseOpportunityStageDefinitionsResponse(response.data));
      setHasLoaded(true);
      return true;
    } catch (error) {
      if (signal?.aborted) return false;
      setQueryError(normalizeApiError(error));
      return false;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // Deferred to a microtask so no state is written synchronously in the
    // effect body — the same pattern every other loader in this module uses,
    // and what `react-hooks/set-state-in-effect` is guarding against.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void reload(controller.signal);
    });
    return () => controller.abort();
  }, [enabled, reload]);

  return {
    items,
    setItems,
    isLoading,
    hasLoaded,
    queryError,
    degraded: queryError !== null,
    reload,
  };
}
