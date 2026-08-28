"use client";

import { useCallback, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { customerProfilePath, type CustomerProfileStatus } from "./useCustomerProfiles";

// PATCH /customer-profiles/:id — also the board view's drag target. There is
// no dedicated stage endpoint here because customer status is a fixed enum,
// not a tenant catalogue. See docs/api/crm-customer-profiles.md#patch-customer-profilesid.
export function useUpdateCustomerProfileStatus() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = useCallback(async (id: string, status: CustomerProfileStatus): Promise<boolean> => {
    setIsUpdating(true);
    try {
      await axiosClient.patch(
        customerProfilePath(id),
        { status },
        { nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 250_000 },
      );
      return true;
    } catch {
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { updateStatus, isUpdating };
}
