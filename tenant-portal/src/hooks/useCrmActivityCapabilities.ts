"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";

const LEADS_CAPABILITIES_PATH = "/api/tenant/crm/v1/leads/capabilities";

export interface CrmActionCapability {
  scope: "own" | "team" | "all";
  ownerUserIds: string[] | null;
}

/**
 * The branch-scoped **create** capability for the activities family.
 *
 * S6 / defect D11: action admission comes from the CRM capabilities
 * endpoints, not from `/auth/me` permission strings, because a scoped
 * permission does not say which branch or which owners it covers.
 *
 * `GET /leads/capabilities` is the only route that reports it. Verified in
 * crm-app/src/crm/leads/leads.service.ts: the response carries
 * `activities: { create }` alongside the leads block, the route requires **no**
 * leads permission — only branch membership (`@RequireBranchAccess('query')`)
 * — and it is Gateway-exposed as `crm.leads.capabilities.get`. So a tasks,
 * calendar or reminders screen may call it safely.
 *
 * **`activities.update` is not exposed anywhere.** The capabilities response
 * carries only `create` for this family, so an update control has no
 * capability to gate on and falls back to the scoped permission string, with
 * the backend as the authority. Recorded as Q53 in
 * docs/build/OPEN-QUESTIONS.md.
 */
export function useCrmActivityCapabilities(branchId: string | null) {
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [canCreate, setCanCreate] = useState<CrmActionCapability | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Set only when the question could not be ASKED. A 403 is an answer and
  // leaves this null — states.md: "a question that could not be asked is not
  // an answer".
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!branchId || !isUUIDv7(branchId)) {
        setCanCreate(null);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ branchId }).toString();
        const response = await axiosClient.get<unknown>(
          `${LEADS_CAPABILITIES_PATH}?${query}`,
          {
            signal,
            cache: "no-store",
            maxResponseBytes: 50_000,
            headers: scopeHeaders,
          },
        );
        setCanCreate(parseActivitiesCreate(response.data));
      } catch (caught) {
        if (isAbortError(caught)) return;
        setCanCreate(null);
        const normalized = normalizeApiError(caught);
        setError(normalized.status === 403 ? null : normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, scopeHeaders],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return { canCreate, isLoading, error };
}

function parseActivitiesCreate(payload: unknown): CrmActionCapability | null {
  const body = record(payload);
  const activities = body ? record(body.activities) : null;
  const create = activities ? activities.create : null;
  if (create === null || create === undefined) return null;
  const source = record(create);
  const scope = source?.scope;
  if (scope !== "own" && scope !== "team" && scope !== "all") return null;
  const ownerUserIds = source?.ownerUserIds;
  if (
    ownerUserIds !== null &&
    ownerUserIds !== undefined &&
    !(Array.isArray(ownerUserIds) && ownerUserIds.every((id) => typeof id === "string"))
  ) {
    return null;
  }
  return {
    scope,
    ownerUserIds: (ownerUserIds as string[] | null | undefined) ?? null,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
