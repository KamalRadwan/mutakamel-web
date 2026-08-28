"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import { CUSTOMER_PROFILES_PATH } from "./useCustomerProfiles";

export interface ActionCapability {
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

export function useCustomerProfilesCapabilities(branchId: string | null) {
  const [capabilities, setCapabilities] = useState<CustomerProfilesCapabilities>(EMPTY_CAPABILITIES);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!branchId || !isUUIDv7(branchId)) {
      setCapabilities(EMPTY_CAPABILITIES);
      return;
    }
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ branchId }).toString();
      const response = await axiosClient.get<unknown>(`${CUSTOMER_PROFILES_PATH}/capabilities?${query}`, {
        signal,
        cache: "no-store",
        maxResponseBytes: 50_000,
      });
      setCapabilities(parseCapabilitiesResponse(response.data) ?? EMPTY_CAPABILITIES);
    } catch {
      // Advisory only — the backend re-checks every write. A failed
      // capabilities fetch just means action controls stay hidden.
      setCapabilities(EMPTY_CAPABILITIES);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return { capabilities, isLoading };
}
