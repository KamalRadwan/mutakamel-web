"use client";

import { useCallback, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../shared/crm-write";
import { parseCustomerProfileDetailResponse } from "../customer-profile-contract";
import {
  EMPTY_CUSTOMER_PROFILE_FORM,
  buildCreateCustomerProfileRequest,
  type CustomerProfileForm,
} from "../customer-profile-write-contract";
import { CUSTOMER_PROFILES_PATH } from "./useCustomerProfiles";

export interface CreateCustomerProfileAmbiguity {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * `POST /customer-profiles` — MASTER-PLAN 8.9.
 *
 * `@RequireBranchAccess('body')` reads the branch off the payload, so the
 * request cannot go out without one — the drawer stays closed until a branch
 * is selected rather than sending a request that is a 422 by construction.
 */
export function useCreateCustomerProfile(
  branchId: string | null,
  onCreated: (profileId: string) => void,
) {
  const [form, setForm] = useState<CustomerProfileForm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] =
    useState<CreateCustomerProfileAmbiguity | null>(null);

  const submit = useCallback(async () => {
    if (!form || !branchId || isSubmitting) return;
    if (form.displayName.trim().length === 0) return;
    const attempt = createCrmWriteAttempt();
    const body = buildCreateCustomerProfileRequest(form, branchId);

    const send = async (): Promise<void> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const outcome = await runCrmWrite({
          attempt,
          method: "post",
          path: CUSTOMER_PROFILES_PATH,
          body,
          parse: parseCustomerProfileDetailResponse,
          config: { maxResponseBytes: 512 * 1024 },
        });
        if (outcome.kind === "success") {
          setAmbiguity(null);
          setForm(null);
          onCreated(outcome.value.id);
          return;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({ attempt, error: outcome.error, replay: send });
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
  }, [branchId, form, isSubmitting, onCreated]);

  return {
    open: form !== null,
    form,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    openDrawer: () => {
      setForm({ ...EMPTY_CUSTOMER_PROFILE_FORM });
      setError(null);
      setAmbiguity(null);
    },
    closeDrawer: () => {
      setForm(null);
      setError(null);
    },
    setField: <K extends keyof CustomerProfileForm>(
      key: K,
      value: CustomerProfileForm[K],
    ) => setForm((current) => (current ? { ...current, [key]: value } : current)),
    submit,
  };
}
