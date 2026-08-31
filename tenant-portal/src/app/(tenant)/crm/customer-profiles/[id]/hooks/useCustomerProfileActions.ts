"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  expectNoContent,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../../shared/crm-write";
import {
  parseAddContactResponse,
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import {
  buildAddCustomerContactRequest,
  buildUpdateCustomerProfileRequest,
  toCustomerProfileForm,
  EMPTY_CUSTOMER_CONTACT_FORM,
  type CustomerContactForm,
  type CustomerProfileForm,
} from "../../customer-profile-write-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";
import type { CustomerProfileStatus } from "../../hooks/useCustomerProfiles";

export type CustomerProfileOperation =
  | "edit"
  | "status"
  | "contact"
  | "delete";

export interface CustomerProfileAmbiguity {
  operation: CustomerProfileOperation;
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * The customer-profile action cluster — MASTER-PLAN 8.7 (Q12).
 *
 * Four writes on one record, each with its own idempotency attempt so a retry
 * of one never replays another. Delete is the only one that navigates; the
 * rest replace the record in place from the response the server returns, so
 * the screen never shows a value it merely hopes was saved.
 */
export function useCustomerProfileActions(
  profile: CustomerProfileDetail | null,
  onSaved: (profile: CustomerProfileDetail) => void,
  onDeleted: () => void,
) {
  const baseline = useMemo(
    () => (profile ? toCustomerProfileForm(profile) : null),
    [profile],
  );
  const [form, setForm] = useState<CustomerProfileForm | null>(null);
  const [contactForm, setContactForm] = useState<CustomerContactForm | null>(
    null,
  );
  const [pendingStatus, setPendingStatus] =
    useState<CustomerProfileStatus | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<CustomerProfileOperation | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<CustomerProfileAmbiguity | null>(
    null,
  );

  const isDirty = useMemo(() => {
    if (!form || !baseline) return false;
    return (Object.keys(form) as Array<keyof CustomerProfileForm>).some(
      (key) => String(form[key]).trim() !== String(baseline[key]).trim(),
    );
  }, [baseline, form]);

  // A named function expression so the ambiguous branch's `replay` calls this
  // same function rather than reaching forward to the const being initialised.
  const run = useCallback(
    async function runWrite<T>(
      operation: CustomerProfileOperation,
      attempt: CrmWriteAttempt,
      send: () => Promise<
        | { kind: "success"; value: T }
        | { kind: "failed"; error: NormalizedApiError }
        | { kind: "ambiguous"; error: NormalizedApiError }
      >,
      onSuccess: (value: T) => void,
    ): Promise<boolean> {
      setBusy(operation);
      setError(null);
      try {
        const outcome = await send();
        if (outcome.kind === "success") {
          setAmbiguity(null);
          onSuccess(outcome.value);
          return true;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({
            operation,
            attempt,
            error: outcome.error,
            replay: async () => {
              await runWrite(operation, attempt, send, onSuccess);
            },
          });
          return false;
        }
        setAmbiguity(null);
        setError(outcome.error);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const submitEdit = useCallback(async () => {
    if (!profile || !form || !baseline) return;
    const body = buildUpdateCustomerProfileRequest(form, baseline);
    if (Object.keys(body).length === 0) {
      setForm(null);
      return;
    }
    const attempt = createCrmWriteAttempt();
    const saved = await run(
      "edit",
      attempt,
      () =>
        runCrmWrite({
          attempt,
          method: "patch",
          path: customerProfilePath(profile.id),
          body,
          parse: parseCustomerProfileDetailResponse,
          config: { maxResponseBytes: 512 * 1024 },
        }),
      onSaved,
    );
    if (saved) setForm(null);
  }, [baseline, form, onSaved, profile, run]);

  /**
   * `PATCH /:id` with `{ status }` — the same route the board's drag target
   * uses, because customer status is a fixed enum rather than a tenant
   * catalogue and there is no dedicated stage endpoint here.
   *
   * The status is passed in rather than read from state: a non-terminal change
   * submits immediately from the picker's own handler, and the pending state
   * has not been committed by then.
   */
  const submitStatus = useCallback(
    async (status?: CustomerProfileStatus) => {
      const nextStatus = status ?? pendingStatus;
      if (!profile || !nextStatus) return;
      const attempt = createCrmWriteAttempt();
      const saved = await run(
        "status",
        attempt,
        () =>
          runCrmWrite({
            attempt,
            method: "patch",
            path: customerProfilePath(profile.id),
            body: { status: nextStatus },
            parse: parseCustomerProfileDetailResponse,
            config: { maxResponseBytes: 512 * 1024 },
          }),
        onSaved,
      );
      if (saved) setPendingStatus(null);
    },
    [onSaved, pendingStatus, profile, run],
  );

  const submitContact = useCallback(async () => {
    if (!profile || !contactForm) return;
    const attempt = createCrmWriteAttempt();
    const added = await run(
      "contact",
      attempt,
      () =>
        runCrmWrite({
          attempt,
          method: "post",
          path: `${customerProfilePath(profile.id)}/contacts`,
          body: buildAddCustomerContactRequest(contactForm),
          parse: parseAddContactResponse,
          // `crm.customer.profiles.contacts.post` declares
          // `organizationScopeMode: NONE`, which means the Gateway REJECTS the
          // scope headers on this route rather than ignoring them. No headers
          // are attached here on purpose.
          config: { maxResponseBytes: 64 * 1024 },
        }),
      // The response is only `{ id }` of the new relationship, so the profile
      // is refetched rather than patched from a payload that does not contain
      // it.
      () => setContactForm(null),
    );
    if (added) onSaved(profile);
  }, [contactForm, onSaved, profile, run]);

  const submitDelete = useCallback(async () => {
    if (!profile) return;
    const attempt = createCrmWriteAttempt();
    const deleted = await run(
      "delete",
      attempt,
      () =>
        runCrmWrite({
          attempt,
          method: "delete",
          path: customerProfilePath(profile.id),
          parse: expectNoContent,
          config: { maxResponseBytes: 64 * 1024 },
        }),
      () => undefined,
    );
    if (deleted) {
      setConfirmingDelete(false);
      onDeleted();
    }
  }, [onDeleted, profile, run]);

  return {
    form,
    isDirty,
    openEdit: () => {
      if (baseline) setForm({ ...baseline });
      setError(null);
    },
    closeEdit: () => setForm(null),
    setField: <K extends keyof CustomerProfileForm>(
      key: K,
      value: CustomerProfileForm[K],
    ) => setForm((current) => (current ? { ...current, [key]: value } : current)),
    revertEdit: () => {
      if (baseline) setForm({ ...baseline });
    },
    submitEdit,

    contactForm,
    openContact: () => {
      setContactForm({ ...EMPTY_CUSTOMER_CONTACT_FORM });
      setError(null);
    },
    closeContact: () => setContactForm(null),
    setContactField: <K extends keyof CustomerContactForm>(
      key: K,
      value: CustomerContactForm[K],
    ) =>
      setContactForm((current) =>
        current ? { ...current, [key]: value } : current,
      ),
    submitContact,

    pendingStatus,
    requestStatus: (status: CustomerProfileStatus) => {
      setPendingStatus(status);
      setError(null);
    },
    cancelStatus: () => setPendingStatus(null),
    submitStatus,

    confirmingDelete,
    requestDelete: () => {
      setConfirmingDelete(true);
      setError(null);
    },
    cancelDelete: () => setConfirmingDelete(false),
    submitDelete,

    busy,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
  };
}
