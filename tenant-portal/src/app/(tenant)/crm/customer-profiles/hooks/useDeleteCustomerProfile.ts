"use client";

import { useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";

export function useDeleteCustomerProfile() {
  const describeError = useCrmErrorText();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  async function deleteProfile(profileId: string): Promise<boolean> {
    setIsDeleting(true);
    setError(null);
    try {
      await axiosClient.delete(
        `/api/tenant/crm/v1/customer-profiles/${encodeURIComponent(profileId)}`,
        {
          nonReplayable: true,
          skipAutoIdempotency: true,
          cache: "no-store",
          maxResponseBytes: 64 * 1024,
        },
      );
      return true;
    } catch (caught) {
      setError(normalizeApiError(caught));
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    deleteProfile,
    isDeleting,
    error: describeError(error),
    clearError: () => setError(null),
  };
}
