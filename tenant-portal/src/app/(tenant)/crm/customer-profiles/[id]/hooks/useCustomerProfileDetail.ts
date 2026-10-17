"use client";

import { useCallback, useEffect, useState } from "react";
import type { CardColor } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  parseCustomerProfileCardColor,
  parseCustomerProfileRating,
} from "../../customer-profile-card-contract";
import {
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";

const DETAIL_RESPONSE_LIMIT_BYTES = 512 * 1024;

export interface CustomerProfileDetailCard {
  rating: number;
  cardColor: CardColor | null;
}

function parseDetailCard(payload: unknown): CustomerProfileDetailCard | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  try {
    const row = payload as Record<string, unknown>;
    return {
      rating: parseCustomerProfileRating(row.rating),
      cardColor: parseCustomerProfileCardColor(row.cardColor),
    };
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * One customer profile, on the richer detail projection, plus its card rating & color.
 */
export function useCustomerProfileDetail(profileId: string) {
  const [profile, setProfile] = useState<CustomerProfileDetail | null>(null);
  const [card, setCard] = useState<CustomerProfileDetailCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isUUIDv7(profileId)) {
        setProfile(null);
        setCard(null);
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
        setCard(parseDetailCard(response.data));
      } catch (caught) {
        if (isAbortError(caught)) return;
        setProfile(null);
        setCard(null);
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
    card,
    isLoading,
    error,
    isNotFound: error?.status === 404,
    isForbidden: error?.status === 403,
    reload: useCallback(() => setReloadToken((current) => current + 1), []),
    setProfile,
    setCard,
  };
}
