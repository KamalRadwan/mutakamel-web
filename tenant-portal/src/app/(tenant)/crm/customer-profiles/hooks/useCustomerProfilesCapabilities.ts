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
  crmRecord,
  parseCrmActionCapability,
  type CrmActionCapability,
} from "../../shared/crm-capabilities";
import { CUSTOMER_PROFILES_PATH } from "./useCustomerProfiles";

export interface CustomerProfilesCapabilities {
  create: CrmActionCapability | null;
  update: CrmActionCapability | null;
  delete: CrmActionCapability | null;
}

// GET /customer-profiles/capabilities — no permission required beyond
// branch membership, so it is safe to call before the list resolves. Drives
// every action control on the screen (D11) instead of guessing from
// /auth/me permission strings. Exact response shape verified against
// crm-app/src/crm/customer-profiles/customer-profiles.service.ts — this
// endpoint has no dedicated docs/api/*.md example.
function parseCapabilitiesResponse(
  payload: unknown,
): CustomerProfilesCapabilities | null {
  const source = crmRecord(payload);
  const customerProfiles = source ? crmRecord(source.customerProfiles) : null;
  if (!customerProfiles) return null;
  return {
    create: parseCrmActionCapability(
      customerProfiles.create,
      "customer profiles",
    ),
    update: parseCrmActionCapability(
      customerProfiles.update,
      "customer profiles",
    ),
    delete: parseCrmActionCapability(
      customerProfiles.delete,
      "customer profiles",
    ),
  };
}

const EMPTY_CAPABILITIES: CustomerProfilesCapabilities = {
  create: null,
  update: null,
  delete: null,
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useCustomerProfilesCapabilities(branchId: string | null) {
  // GET /customer-profiles/capabilities is BRANCH_REQUIRED in the Gateway
  // route contract, which means it wants the scope HEADERS as well as the
  // branchId query parameter — see src/lib/api/organization-scope.ts and
  // OPEN-QUESTIONS.md Q24. Additive on purpose: when the branch's company
  // cannot be derived this resolves to {} and the request goes out exactly
  // as it did before, so a contract misreading cannot blank the screen.
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [capabilityState, setCapabilityState] = useState<{
    branchId: string | null;
    value: CustomerProfilesCapabilities;
  }>({ branchId: null, value: EMPTY_CAPABILITIES });
  const [isLoading, setIsLoading] = useState(false);
  // Set only when the question could not be ASKED. A 403 is an answer, and
  // it leaves this null — see the catch below.
  const [errorState, setErrorState] = useState<{
    branchId: string | null;
    value: NormalizedApiError | null;
  }>({ branchId: null, value: null });

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!branchId || !isUUIDv7(branchId) || !scope.ready) {
      setCapabilityState({ branchId, value: EMPTY_CAPABILITIES });
      // D4: an unresolved organization scope is a gap on THIS side, so the
      // request is not sent at all. It used to go out with no headers and come
      // back 400 from the Gateway, which reads as a server refusal.
      setErrorState({
        branchId,
        value:
          isUUIDv7(branchId) && !scope.ready
            ? SCOPE_UNRESOLVED_ERROR
            : null,
      });
      return;
    }
    setIsLoading(true);
    setErrorState({ branchId, value: null });
    try {
      const query = new URLSearchParams({ branchId }).toString();
      const response = await axiosClient.get<unknown>(
        `${CUSTOMER_PROFILES_PATH}/capabilities?${query}`,
        {
          signal,
          cache: "no-store",
          maxResponseBytes: 50_000,
          headers: scope.headers,
        },
      );
      setCapabilityState({
        branchId,
        value: parseCapabilitiesResponse(response.data) ?? EMPTY_CAPABILITIES,
      });
    } catch (caught) {
      // A cancelled request is not an outcome — a newer one is in flight.
      if (isAbortError(caught)) return;
      setCapabilityState({ branchId, value: EMPTY_CAPABILITIES });
      // 403 is a definitive answer: this actor holds no capability in this
      // branch, and hiding the controls is correct. Anything else — network
      // blip, 5xx, a payload that failed validation — means the question
      // never got answered, and reporting that as "no permission" is a lie
      // the user cannot tell from the real thing. The screen surfaces the
      // difference; the backend still re-checks every write either way.
      const normalized = normalizeApiError(caught);
      setErrorState({ branchId, value: normalized.status === 403 ? null : normalized });
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [branchId, scope]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return {
    capabilities:
      capabilityState.branchId === branchId
        ? capabilityState.value
        : EMPTY_CAPABILITIES,
    isLoading: isLoading || capabilityState.branchId !== branchId,
    error: errorState.branchId === branchId ? errorState.value : null,
  };
}
