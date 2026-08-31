"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  crmRecord,
  parseCrmActionCapability,
  type CrmActionCapability,
} from "../../shared/crm-capabilities";

const LEADS_CAPABILITIES_PATH = "/api/tenant/crm/v1/leads/capabilities";

export interface LeadDetailCapabilities {
  update: CrmActionCapability | null;
  delete: CrmActionCapability | null;
  convert: CrmActionCapability | null;
  notesCreate: CrmActionCapability | null;
  notesDelete: CrmActionCapability | null;
  attachmentsCreate: CrmActionCapability | null;
  attachmentsDelete: CrmActionCapability | null;
}

const NO_LEAD_DETAIL_CAPABILITIES: LeadDetailCapabilities = {
  update: null,
  delete: null,
  convert: null,
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
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [capabilities, setCapabilities] = useState<LeadDetailCapabilities>(
    NO_LEAD_DETAIL_CAPABILITIES,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(branchId)) {
        setCapabilities(NO_LEAD_DETAIL_CAPABILITIES);
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
            maxResponseBytes: 64 * 1024,
            headers: scopeHeaders,
          },
        );
        setCapabilities(parseLeadDetailCapabilities(response.data, branchId));
      } catch (caught) {
        if (isAbortError(caught)) return;
        setCapabilities(NO_LEAD_DETAIL_CAPABILITIES);
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

  return { capabilities, isLoading, error };
}
