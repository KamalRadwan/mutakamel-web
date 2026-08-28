"use client";

import { useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// DELETE /opportunities/:id — soft delete, 204 No Content. See
// docs/api/crm-opportunities.md's routes table.
export function useDeleteOpportunity() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(errorMessage(caught, "Unable to delete the opportunity."));
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  return { deleteOpportunity, isDeleting, error, clearError: () => setError(null) };
}
