"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  opportunityPath,
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../../opportunity-contract";
import { parsePipelinesResponse } from "../../hooks/usePipelineWorkspace";
import type { OpportunityPipeline } from "../../hooks/pipeline-types";

const DETAIL_RESPONSE_LIMIT_BYTES = 512 * 1024;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export interface OpportunityDetailDegradation {
  pipelines: boolean;
}

const NO_DEGRADATION: OpportunityDetailDegradation = {
  pipelines: false,
};

/**
 * One opportunity and the pipelines it can move between — MASTER-PLAN 8.10.
 *
 * Two sources run under `allSettled`. Only the opportunity itself may fail the
 * screen; a pipeline list that times out degrades to a named absence rather
 * than blanking a record that loaded.
 */
export function useOpportunityDetail(opportunityId: string) {
  const [item, setItem] = useState<OpportunityDetail | null>(null);
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [degraded, setDegraded] =
    useState<OpportunityDetailDegradation>(NO_DEGRADATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(opportunityId)) {
        setItem(null);
        setError({ status: 404 });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const [detailSettled, pipelinesSettled] =
          await Promise.allSettled([
            axiosClient.get<unknown>(opportunityPath(opportunityId), {
              signal,
              cache: "no-store",
              maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
            }),
            axiosClient.get<unknown>("/api/tenant/crm/v1/pipelines", {
              signal,
              cache: "no-store",
              maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
            }),
          ]);
        if (
          [detailSettled, pipelinesSettled].some(
            (settled) =>
              settled.status === "rejected" && isAbortError(settled.reason),
          )
        ) {
          return;
        }
        if (detailSettled.status === "rejected") throw detailSettled.reason;

        const nextPipelines = degradable(pipelinesSettled, parsePipelinesResponse);
        setItem(parseOpportunityDetailResponse(detailSettled.value.data));
        setPipelines(nextPipelines ?? []);
        setDegraded({
          pipelines: nextPipelines === null,
        });
      } catch (caught) {
        if (isAbortError(caught)) return;
        setItem(null);
        setPipelines([]);
        setDegraded(NO_DEGRADATION);
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [opportunityId],
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
    item,
    pipelines,
    degraded,
    isLoading,
    error,
    isNotFound: error?.status === 404,
    isForbidden: error?.status === 403,
    reload,
    setItem,
  };
}

function degradable<T>(
  settled: PromiseSettledResult<AxiosResponse<unknown>>,
  parse: (payload: unknown) => T,
): T | null {
  if (settled.status === "rejected") return null;
  try {
    return parse(settled.value.data);
  } catch {
    return null;
  }
}
