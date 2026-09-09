"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { parsePipelinesResponse } from "../../../opportunities/hooks/usePipelineWorkspace";
import type { OpportunityPipeline } from "../../../opportunities/hooks/pipeline-types";
import type { CrmActionCapability } from "../../../shared/crm-capabilities";
import type { LeadDetailsUser } from "../lead-details-edit-contract";
import { readOwnerOptions } from "./readLeadOwnerOptions";

export function useLeadConversionOptions(branchId: string | null, enabled: boolean, capability: CrmActionCapability | null) {
  const { user: actor } = useTenantAuth();
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [users, setUsers] = useState<LeadDetailsUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pipelinesFailed, setPipelinesFailed] = useState(false);
  const [usersFailed, setUsersFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const canReadPipelines = actor?.permissions.includes("crm.pipelines.read") ?? false;
  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  useEffect(() => {
    if (!enabled || !branchId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setPipelines([]); setUsers([]);
      void Promise.allSettled([
        canReadPipelines ? axiosClient.get<unknown>("/api/tenant/crm/v1/pipelines", {
          signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024,
        }).then((response) => parsePipelinesResponse(response.data)) : Promise.reject(new Error("Permission required")),
        canReadUsers ? readOwnerOptions(branchId, controller.signal) : Promise.resolve([]),
      ]).then(([pipelineResult, userResult]) => {
        if (controller.signal.aborted) return;
        setPipelines(pipelineResult.status === "fulfilled" ? pipelineResult.value : []);
        setPipelinesFailed(pipelineResult.status === "rejected");
        setUsers(userResult.status === "fulfilled" ? userResult.value : []);
        setUsersFailed(userResult.status === "rejected");
        setLoading(false);
      });
    });
    return () => controller.abort();
  }, [branchId, enabled, canReadPipelines, canReadUsers, revision]);
  const candidates = [...users];
  if (actor?.status === "ACTIVE" && branchId && actor.accessibleBranches.includes(branchId)) candidates.push(actor);
  const ownerOptions = [...new Map(candidates.map((user) => [user.id, user])).values()]
    .filter(({ id }) => capability && (capability.ownerUserIds === null || capability.ownerUserIds.includes(id)));
  return { pipelines, ownerOptions, actorId: actor?.id ?? null, loading, pipelinesFailed, usersFailed, canReadPipelines, canReadUsers, reload: () => setRevision((n) => n + 1) };
}
