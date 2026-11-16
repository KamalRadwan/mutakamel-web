"use client";

import { useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";

// DELETE /opportunities/:id — soft delete, 204 No Content. See
// docs/api/crm-opportunities.md's routes table.
export function useDeleteOpportunity() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  async function deleteOpportunity(opportunityId: string): Promise<boolean> {
    setIsDeleting(true);
    setError(null);
    try {
      await axiosClient.delete(`/api/tenant/crm/v1/opportunities/${encodeURIComponent(opportunityId)}`, {
        nonReplayable: true,
        skipAutoIdempotency: true,
        cache: "no-store",
        maxResponseBytes: 64 * 1024,
      });
      return true;
    } catch (caught) {
      setError(normalizeApiError(caught));
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  return { deleteOpportunity, isDeleting, error, clearError: () => setError(null) };
}
