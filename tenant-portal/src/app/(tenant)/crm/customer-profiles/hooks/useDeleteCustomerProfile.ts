"use client";

import { useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useDeleteCustomerProfile() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(errorMessage(caught, "Unable to delete the customer profile."));
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  return { deleteProfile, isDeleting, error, clearError: () => setError(null) };
}
