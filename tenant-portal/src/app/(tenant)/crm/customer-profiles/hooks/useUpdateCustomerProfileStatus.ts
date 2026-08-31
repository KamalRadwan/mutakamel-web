"use client";

import { useCallback, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { customerProfilePath, type CustomerProfileStatus } from "./useCustomerProfiles";

// S8: a replay is a SUCCESS, not a duplicate. The Gateway served the stored
// response instead of running the mutation twice, so the move applied — once.
// Reporting it as a failure would push the user into a second attempt at
// something that already happened.
export type StatusUpdateResult =
  | { ok: true; replayed: boolean }
  | { ok: false; error: NormalizedApiError };

// PATCH /customer-profiles/:id — also the board view's drag target. There is
// no dedicated stage endpoint here because customer status is a fixed enum,
// not a tenant catalogue. See docs/api/crm-customer-profiles.md#patch-customer-profilesid.
export function useUpdateCustomerProfileStatus() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = useCallback(async (id: string, status: CustomerProfileStatus): Promise<StatusUpdateResult> => {
    setIsUpdating(true);
    try {
      const response = await axiosClient.patch(
        customerProfilePath(id),
        { status },
        { nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 250_000 },
      );
      return { ok: true, replayed: isIdempotentReplay(response.headers) };
    } catch (caught) {
      // The error is returned rather than swallowed: 429 and the idempotency
      // conflicts each need their own surface, and `false` cannot carry that.
      return { ok: false, error: normalizeApiError(caught) };
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { updateStatus, isUpdating };
}
