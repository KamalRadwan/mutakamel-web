"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  NO_ATTACHED_RECORD_CAPABILITIES,
  parseAttachedRecordCapabilities,
  type CrmAttachedRecordCapabilities,
} from "../crm-capabilities";

const LEADS_CAPABILITIES_PATH = "/api/tenant/crm/v1/leads/capabilities";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * The branch's notes and attachments capabilities, for any CRM detail screen.
 *
 * `/leads/capabilities` is the only endpoint that reports them. It carries no
 * `@RequirePermissions` — branch membership is the whole gate — and its
 * `notes`/`attachments` entries are resolved per **resource and branch**, never
 * per lead, so an opportunity or customer screen asking it gets the right
 * answer for itself. See `parseAttachedRecordCapabilities`.
 *
 * The route is `BRANCH_REQUIRED` in the Gateway contract, so it needs the two
 * scope headers as well as the query parameter. Without them the Gateway
 * answers `400 GW.REQUEST.INVALID` before the request reaches crm-app —
 * `route-context.middleware.ts`, `validateOrganizationScope()`.
 *
 * A `403` leaves `error` null: that is a real answer, and hiding the controls
 * is correct. Anything else means the question was never answered, which the
 * caller surfaces as degraded rather than as "not permitted".
 */
export function useCrmRecordCapabilities(branchId: string | null) {
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [capabilities, setCapabilities] = useState<CrmAttachedRecordCapabilities>(
    NO_ATTACHED_RECORD_CAPABILITIES,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(branchId) || !scope.ready) {
        setCapabilities(NO_ATTACHED_RECORD_CAPABILITIES);
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
            maxResponseBytes: 64 * 1024,
            headers: scope.headers,
          },
        );
        setCapabilities(
          parseAttachedRecordCapabilities(response.data, branchId),
        );
      } catch (caught) {
        if (isAbortError(caught)) return;
        setCapabilities(NO_ATTACHED_RECORD_CAPABILITIES);
        const normalized = normalizeApiError(caught);
        setError(normalized.status === 403 ? null : normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
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

  return { capabilities, isLoading, error };
}
