"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";

const DETAIL_RESPONSE_LIMIT_BYTES = 512 * 1024;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * One customer profile, on the richer detail projection.
 *
 * Distinct from `useCustomerProfile` in the list hook, which parses the subset
 * the list and card views need. This one keeps the registration identifiers,
 * the company contact block and the description — and returns a
 * `NormalizedApiError` rather than a prose string, so 403, 404 and a transport
 * failure can be told apart and rendered as three different states.
 */
export function useCustomerProfileDetail(profileId: string) {
  const [profile, setProfile] = useState<CustomerProfileDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(profileId)) {
        setProfile(null);
        setError({ status: 404 });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await axiosClient.get<unknown>(
          customerProfilePath(profileId),
          {
            signal,
            cache: "no-store",
            maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
          },
        );
        setProfile(parseCustomerProfileDetailResponse(response.data));
      } catch (caught) {
        if (isAbortError(caught)) return;
        setProfile(null);
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [profileId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  return {
    profile,
    isLoading,
    error,
    isNotFound: error?.status === 404,
    isForbidden: error?.status === 403,
    reload: useCallback(() => setReloadToken((current) => current + 1), []),
    setProfile,
  };
}
