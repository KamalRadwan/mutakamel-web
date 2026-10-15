"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import {
  parseLeadCapabilitiesResponse,
  parseLeadStagesResponse,
  type LeadCapabilities,
  type LeadStage,
} from "../lead-list-contract";

const LEAD_STAGES_PATH = "/api/tenant/crm/v1/lead-stages";
const LEAD_CAPABILITIES_PATH = "/api/tenant/crm/v1/leads/capabilities";

interface LeadsDegradation {
  stages: boolean;
  capabilities: boolean;
}

const NO_DEGRADATION: LeadsDegradation = { stages: false, capabilities: false };
const NO_STAGES: LeadStage[] = [];

interface Loaded {
  branchId: string;
  stages: LeadStage[];
  capabilities: LeadCapabilities | null;
  degraded: LeadsDegradation;
}

// A supporting source that rejected, or whose payload failed validation,
// degrades to null so the list it decorates still renders.
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

/**
 * The stage catalogue and the branch's lead action capabilities: the two
 * sources every Leads view shares. They depend on the branch only, so paging,
 * sorting and searching the list never re-read them.
 */
export function useLeadStagesAndCapabilities(branchId: string | null) {
  // `crm.leads.capabilities.get` is BRANCH_REQUIRED in the Gateway route
  // contract: without both scope headers the Gateway answers 400 before
  // crm-app sees the request, which would read as "no permission".
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const epochRef = useRef(0);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const epoch = ++epochRef.current;
      if (!branchId) {
        setLoaded(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const [stagesSettled, capabilitiesSettled] = await Promise.allSettled([
        axiosClient.get<unknown>(LEAD_STAGES_PATH, {
          signal,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        }),
        // An unresolved scope is a gap on this side: the request is not sent,
        // and the capabilities degrade instead of drawing a Gateway 400.
        scope.ready
          ? axiosClient.get<unknown>(
              `${LEAD_CAPABILITIES_PATH}?${new URLSearchParams({ branchId }).toString()}`,
              { signal, cache: "no-store", maxResponseBytes: 256 * 1024, headers: scope.headers },
            )
          : Promise.reject(new Error(SCOPE_UNRESOLVED_ERROR.code)),
      ]);
      if (signal?.aborted || epoch !== epochRef.current) return;
      const stages = degradable(stagesSettled, parseLeadStagesResponse);
      const capabilities = degradable(capabilitiesSettled, (payload) =>
        parseLeadCapabilitiesResponse(payload, branchId),
      );
      setLoaded({
        branchId,
        stages: stages ?? NO_STAGES,
        capabilities,
        degraded: { stages: stages === null, capabilities: capabilities === null },
      });
      setIsLoading(false);
    },
    [branchId, scope],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void reload(controller.signal);
    });
    return () => controller.abort();
  }, [reload]);

  // Another branch's answer never gates this branch's controls, even for the
  // moment between the switch and the new answer.
  const current = loaded?.branchId === branchId ? loaded : null;
  return {
    stages: current?.stages ?? NO_STAGES,
    capabilities: current?.capabilities ?? null,
    degraded: current?.degraded ?? NO_DEGRADATION,
    isLoading,
    reload,
  };
}
