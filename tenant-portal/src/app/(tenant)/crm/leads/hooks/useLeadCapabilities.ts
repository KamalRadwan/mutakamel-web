"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { axiosClient, subscribePermissionDenials } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { resolveCompanyForBranch, resolveOrganizationScope } from "@/lib/api/organization-scope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES,
  crmRecord,
  parseCrmActionCapability,
  type CrmActionCapability,
} from "../../shared/crm-capabilities";

const LEADS_CAPABILITIES_PATH = "/api/tenant/crm/v1/leads/capabilities";

/** Capability reads must not invalidate themselves when permission is denied. */
export function useLeadCapabilityRefresh(
  load: (signal: AbortSignal) => void | Promise<void>,
  initialLoad = true,
) {
  useEffect(() => {
    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      void load(controller.signal);
    };
    const initialSignal = controller.signal;
    if (initialLoad) queueMicrotask(() => { if (!initialSignal.aborted) void load(initialSignal); });
    window.addEventListener("focus", refresh);
    const unsubscribe = subscribePermissionDenials((event) => {
      if (event.code === "CRM_SCOPED_PERMISSION_DENIED"
        && event.endpoint.split("?")[0] !== LEADS_CAPABILITIES_PATH) refresh();
    });
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      unsubscribe();
    };
  }, [load, initialLoad]);
}

export function parseLeadCreateCapability(payload: unknown, branchId: string): CrmActionCapability | null {
  const response = crmRecord(payload);
  const leads = response && crmRecord(response.leads);
  if (!response || response.branchId !== branchId || !leads || !("create" in leads)) {
    throw new Error("Invalid leads capabilities response.");
  }
  return parseCrmActionCapability(leads.create, "leads");
}

/** Create admission is resolved independently for every candidate branch. */
export function useLeadCreateCapabilities(branchIds: readonly string[], enabled: boolean) {
  const { user } = useTenantAuth();
  const requests = useMemo(() => enabled ? branchIds.map((branchId) => ({
    branchId,
    scope: resolveOrganizationScope("BRANCH_REQUIRED", {
      branchId,
      companyId: resolveCompanyForBranch(user, branchId),
    }),
  })) : [], [branchIds, user, enabled]);
  const [loaded, setLoaded] = useState<{
    requests: typeof requests;
    capabilities: ReadonlyMap<string, CrmActionCapability>;
    degraded: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const invalidate = useCallback(() => {
    if (!enabled) return;
    setLoaded(null);
    setRevision((current) => current + 1);
  }, [enabled]);
  useLeadCapabilityRefresh(invalidate, false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void Promise.all(requests.map(async ({ branchId, scope }) => {
      if (!scope.ok) return { branchId, capability: null, degraded: true };
      try {
        const response = await axiosClient.get<unknown>(
          `${LEADS_CAPABILITIES_PATH}?${new URLSearchParams({ branchId })}`,
          { signal: controller.signal, cache: "no-store", maxResponseBytes: CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES, headers: scope.headers },
        );
        return { branchId, capability: parseLeadCreateCapability(response.data, branchId), degraded: false };
      } catch (error) {
        return { branchId, capability: null, degraded: normalizeApiError(error).status !== 403 };
      }
    })).then((results) => {
      if (controller.signal.aborted) return;
      const capabilities = new Map<string, CrmActionCapability>();
      for (const { branchId, capability } of results) {
        if (capability) capabilities.set(branchId, capability);
      }
      setLoaded({ requests, capabilities, degraded: results.some((result) => result.degraded) });
    });
    return () => controller.abort();
  }, [requests, enabled, revision]);

  // Neither another actor's answer nor a previous modal opening grants access.
  const current = enabled && loaded?.requests === requests ? loaded : null;
  return {
    capabilities: current?.capabilities,
    branchIds: current ? [...current.capabilities.keys()] : [],
    isLoading: enabled && current === null,
    degraded: current?.degraded ?? false,
  };
}

export interface LeadDetailCapabilities {
  update: CrmActionCapability | null;
  delete: CrmActionCapability | null;
  convert: CrmActionCapability | null;
  opportunitiesCreate: CrmActionCapability | null;
  notesCreate: CrmActionCapability | null;
  notesDelete: CrmActionCapability | null;
  attachmentsCreate: CrmActionCapability | null;
  attachmentsDelete: CrmActionCapability | null;
}

const NO_LEAD_DETAIL_CAPABILITIES: LeadDetailCapabilities = {
  update: null,
  delete: null,
  convert: null,
  opportunitiesCreate: null,
  notesCreate: null,
  notesDelete: null,
  attachmentsCreate: null,
  attachmentsDelete: null,
};

export function parseLeadDetailCapabilities(
  payload: unknown,
  expectedBranchId: string,
): LeadDetailCapabilities {
  const response = crmRecord(payload);
  const leads = response && crmRecord(response.leads);
  const notes = response && crmRecord(response.notes);
  const attachments = response && crmRecord(response.attachments);
  if (
    !response ||
    response.branchId !== expectedBranchId ||
    !leads ||
    !notes ||
    !attachments
  ) {
    throw new Error("Invalid leads capabilities response.");
  }
  return {
    update: parseCrmActionCapability(leads.update, "leads"),
    delete: parseCrmActionCapability(leads.delete, "leads"),
    convert: parseCrmActionCapability(leads.convert, "leads"),
    opportunitiesCreate: parseCrmActionCapability(crmRecord(response.opportunities)?.create ?? null, "opportunities"),
    notesCreate: parseCrmActionCapability(notes.create, "leads"),
    notesDelete: parseCrmActionCapability(notes.delete, "leads"),
    attachmentsCreate: parseCrmActionCapability(attachments.create, "leads"),
    attachmentsDelete: parseCrmActionCapability(attachments.delete, "leads"),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Every action boundary the lead detail screen needs, in one call — D11 / 8.5.
 *
 * The route is `BRANCH_REQUIRED` in the Gateway contract, so the two scope
 * headers are mandatory even though the branch is also a query parameter.
 * Without them `RouteContextMiddleware.validateOrganizationScope` answers
 * `400 GW.REQUEST.INVALID` before crm-app ever sees the request, and the screen
 * degrades to "no capabilities" for a reason that has nothing to do with
 * permissions.
 *
 * A `403` is a real answer and leaves `error` null. Anything else means the
 * question was not answered, which is a different thing from "not permitted"
 * and is surfaced as degradation.
 */
export function useLeadCapabilities(branchId: string | null) {
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [loaded, setLoaded] = useState<{
    branchId: string;
    scope: typeof scope;
    capabilities: LeadDetailCapabilities;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoaded(null);
      if (!isUUIDv7(branchId) || !scope.ready) {
        setIsLoading(false);
        // D4: an unresolved organization scope is a gap on THIS side, so the
        // request is not sent at all. It used to go out with no headers and
        // come back 400 from the Gateway, which reads as a server refusal.
        setError(isUUIDv7(branchId) && !scope.ready ? SCOPE_UNRESOLVED_ERROR : null);
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
            maxResponseBytes: CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES,
            headers: scope.headers,
          },
        );
        if (signal?.aborted) return;
        setLoaded({ branchId, scope, capabilities: parseLeadDetailCapabilities(response.data, branchId) });
      } catch (caught) {
        if (signal?.aborted || isAbortError(caught)) return;
        setLoaded(null);
        const normalized = normalizeApiError(caught);
        setError(normalized.status === 403 ? null : normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, scope],
  );

  useLeadCapabilityRefresh(load);

  const current = loaded?.branchId === branchId && loaded.scope === scope ? loaded : null;
  return { capabilities: current?.capabilities ?? NO_LEAD_DETAIL_CAPABILITIES, isLoading, error };
}
