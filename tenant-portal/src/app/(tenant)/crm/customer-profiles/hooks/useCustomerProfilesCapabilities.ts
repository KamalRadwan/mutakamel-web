"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { CUSTOMER_PROFILES_PATH } from "./useCustomerProfiles";

interface ActionCapability {
  scope: "own" | "team" | "all";
  ownerUserIds: string[] | null;
}

export interface CustomerProfilesCapabilities {
  create: ActionCapability | null;
  update: ActionCapability | null;
  delete: ActionCapability | null;
}

// GET /customer-profiles/capabilities — no permission required beyond
// branch membership, so it is safe to call before the list resolves. Drives
// every action control on the screen (D11) instead of guessing from
// /auth/me permission strings. Exact response shape verified against
// crm-app/src/crm/customer-profiles/customer-profiles.service.ts — this
// endpoint has no dedicated docs/api/*.md example.
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseActionCapability(value: unknown): ActionCapability | null {
  if (value === null) return null;
  const source = record(value);
  const scope = source?.scope;
  if (scope !== "own" && scope !== "team" && scope !== "all") return null;
  const ownerUserIds = source?.ownerUserIds;
  if (ownerUserIds !== null && !(Array.isArray(ownerUserIds) && ownerUserIds.every((id) => typeof id === "string"))) {
    return null;
  }
  return { scope, ownerUserIds: ownerUserIds as string[] | null };
}

function parseCapabilitiesResponse(payload: unknown): CustomerProfilesCapabilities | null {
  const source = record(payload);
  const customerProfiles = source ? record(source.customerProfiles) : null;
  if (!customerProfiles) return null;
  return {
    create: parseActionCapability(customerProfiles.create),
    update: parseActionCapability(customerProfiles.update),
    delete: parseActionCapability(customerProfiles.delete),
  };
}

const EMPTY_CAPABILITIES: CustomerProfilesCapabilities = { create: null, update: null, delete: null };

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
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [capabilities, setCapabilities] = useState<CustomerProfilesCapabilities>(EMPTY_CAPABILITIES);
  const [isLoading, setIsLoading] = useState(false);
  // Set only when the question could not be ASKED. A 403 is an answer, and
  // it leaves this null — see the catch below.
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!branchId || !isUUIDv7(branchId)) {
      setCapabilities(EMPTY_CAPABILITIES);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ branchId }).toString();
      const response = await axiosClient.get<unknown>(`${CUSTOMER_PROFILES_PATH}/capabilities?${query}`, {
        signal,
        cache: "no-store",
        maxResponseBytes: 50_000,
        headers: scopeHeaders,
      });
      setCapabilities(parseCapabilitiesResponse(response.data) ?? EMPTY_CAPABILITIES);
    } catch (caught) {
      // A cancelled request is not an outcome — a newer one is in flight.
      if (isAbortError(caught)) return;
      setCapabilities(EMPTY_CAPABILITIES);
      // 403 is a definitive answer: this actor holds no capability in this
      // branch, and hiding the controls is correct. Anything else — network
      // blip, 5xx, a payload that failed validation — means the question
      // never got answered, and reporting that as "no permission" is a lie
      // the user cannot tell from the real thing. The screen surfaces the
      // difference; the backend still re-checks every write either way.
      const normalized = normalizeApiError(caught);
      setError(normalized.status === 403 ? null : normalized);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [branchId, scopeHeaders]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return { capabilities, isLoading, error };
}
