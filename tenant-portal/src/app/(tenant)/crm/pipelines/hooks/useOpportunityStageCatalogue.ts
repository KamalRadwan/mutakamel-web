"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  OPPORTUNITY_STAGES_PATH,
  parseOpportunityStageDefinitionsResponse,
  type OpportunityStageDefinition,
} from "../pipeline-contract";

const CATALOGUE_RESPONSE_LIMIT_BYTES = 256 * 1024;

/**
 * The reusable opportunity-stage catalogue, for the create-pipeline picker.
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
  const [isLoading, setIsLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // Deferred to a microtask so no state is written synchronously in the
    // effect body — the same pattern every other loader in this module uses,
    // and what `react-hooks/set-state-in-effect` is guarding against.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      void (async () => {
        try {
          const response = await axiosClient.get<unknown>(OPPORTUNITY_STAGES_PATH, {
            signal: controller.signal,
            cache: "no-store",
            maxResponseBytes: CATALOGUE_RESPONSE_LIMIT_BYTES,
          });
          setItems(parseOpportunityStageDefinitionsResponse(response.data));
          setDegraded(false);
        } catch {
          if (controller.signal.aborted) return;
          setItems([]);
          setDegraded(true);
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      })();
    });
    return () => controller.abort();
  }, [enabled]);

  return { items, isLoading, degraded };
}
