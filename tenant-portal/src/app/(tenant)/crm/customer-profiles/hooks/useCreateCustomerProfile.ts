"use client";

import { useCallback, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CrmProfileType } from "../../leads/lead-contract";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmAppliedUnreadable,
  type CrmWriteAttempt,
} from "../../shared/crm-write";
import { useCrmCreateForm } from "../../shared/hooks/useCrmCreateForm";
import { parseCustomerProfileDetailResponse } from "../customer-profile-contract";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  buildCreateCustomerProfileFullRequest,
  emptyCreateCustomerProfileForm,
  emptyCustomerContactRow,
  type CreateCustomerProfileForm,
  type CustomerContactRowForm,
} from "../customer-profile-create-contract";
import {
  validateCreateCustomerProfile,
  type CustomerProfileCreateMessages,
} from "../customer-profile-create-validation";
import { CUSTOMER_PROFILES_PATH } from "./useCustomerProfiles";

export interface CreateCustomerProfileAmbiguity {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

let contactKeySeed = 0;
function nextContactKey(): string {
  contactKeySeed += 1;
  return `customer-contact-${contactKeySeed}`;
}

/** Row keys are React identity, not user data — see `useCrmCreateForm`. */
function fingerprint(form: CreateCustomerProfileForm): string {
  return JSON.stringify({
    ...form,
    contacts: form.contacts.map((contact) => ({ ...contact, key: "" })),
  });
}

/**
 * `POST /customer-profiles` — MASTER-PLAN 8.9, across the whole DTO.
 *
 * `@RequireBranchAccess('body')` reads the branch off the payload, so the
 * request cannot go out without one — the modal stays closed until a branch is
 * selected rather than sending a request that is a 422 by construction.
 *
 * The write half is unchanged from the drawer this replaces: one idempotency
 * key per attempt, replayed on retry, and an outcome that distinguishes "did
 * not happen" from "happened and I cannot read the receipt". What is new is
 * that the form carries the fields the DTO actually accepts — the contacts, the
 * company phone list and the tenant's own custom fields, none of which the
 * eleven-field drawer could send.
 */
export function useCreateCustomerProfile(
  branchId: string | null,
  messages: CustomerProfileCreateMessages,
  requiredCustomFieldKeys: readonly string[],
  onCreated: (profileId: string) => void,
  /**
   * Re-read what the screen shows — defect D2. Called when a write applied but
   * its response body could not be parsed, and offered again as the panel's own
   * action, because refreshing is the only safe thing left to do.
   */
  onReconcile: () => void,
) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<CreateCustomerProfileAmbiguity | null>(null);
  // D2. `POST /customer-profiles` is not idempotent across attempts, so a 2xx
  // whose body this client cannot read is the most dangerous thing to report as
  // a plain failure: the profile exists, and a second Save makes two.
  const [appliedUnreadable, setAppliedUnreadable] = useState<CrmAppliedUnreadable | null>(
    null,
  );

  const validate = useCallback(
    (candidate: CreateCustomerProfileForm) =>
      validateCreateCustomerProfile(candidate, messages, requiredCustomFieldKeys),
    [messages, requiredCustomFieldKeys],
  );
  const createInitial = useCallback(
    () => emptyCreateCustomerProfileForm(nextContactKey()),
    [],
  );
  const state = useCrmCreateForm({ createInitial, validate, fingerprint });
  const { form, setForm, allErrors, revealAll, reset } = state;

  // Switching to INDIVIDUAL is not cosmetic: `assertCorporateOnlyFields` answers
  // any of the nine company keys there with a 422, so they are cleared on the
  // way across rather than left to be sent and rejected.
  const setProfileType = useCallback(
    (profileType: CrmProfileType) => {
      setForm((current) => {
        if (profileType === "CORPORATE") return { ...current, profileType };
        return {
          ...current,
          profileType,
          companyName: "",
          taxNumber: "",
          commercialRegistrationNumber: "",
          companyEmail: "",
          companyWebsite: "",
          companyPhones: [""],
          contacts: [emptyCustomerContactRow(nextContactKey())],
        };
      });
    },
    [setForm],
  );

  const setCustomField = useCallback(
    (fieldKey: string, value: unknown) => {
      setForm((current) => ({
        ...current,
        customFields: { ...current.customFields, [fieldKey]: value },
      }));
    },
    [setForm],
  );

  const setPhone = useCallback(
    (list: "phones" | "companyPhones", index: number, value: string) => {
      setForm((current) => ({
        ...current,
        [list]: current[list].map((phone, position) => (position === index ? value : phone)),
      }));
    },
    [setForm],
  );

  const addPhone = useCallback(
    (list: "phones" | "companyPhones") => {
      setForm((current) =>
        current[list].length >= CUSTOMER_PROFILE_CREATE_LIMITS.phones
          ? current
          : { ...current, [list]: [...current[list], ""] },
      );
    },
    [setForm],
  );

  const removePhone = useCallback(
    (list: "phones" | "companyPhones", index: number) => {
      setForm((current) => {
        const next = current[list].filter((_phone, position) => position !== index);
        return { ...current, [list]: next.length > 0 ? next : [""] };
      });
    },
    [setForm],
  );

  const patchContact = useCallback(
    (index: number, update: (contact: CustomerContactRowForm) => CustomerContactRowForm) => {
      setForm((current) => ({
        ...current,
        contacts: current.contacts.map((contact, position) =>
          position === index ? update(contact) : contact,
        ),
      }));
    },
    [setForm],
  );

  const updateContact = useCallback(
    (index: number, patch: Partial<Omit<CustomerContactRowForm, "key">>) => {
      patchContact(index, (contact) => ({ ...contact, ...patch }));
    },
    [patchContact],
  );

  // Exactly one primary: `saveCorporateContacts` throws
  // CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID on two, and silently promotes row 0
  // on none — the form says out loud which row that is.
  const setContactPrimary = useCallback(
    (index: number) => {
      setForm((current) => ({
        ...current,
        contacts: current.contacts.map((contact, position) => ({
          ...contact,
          isPrimary: position === index,
        })),
      }));
    },
    [setForm],
  );

  const addContact = useCallback(() => {
    setForm((current) =>
      current.contacts.length >= CUSTOMER_PROFILE_CREATE_LIMITS.contacts
        ? current
        : {
            ...current,
            contacts: [
              ...current.contacts,
              { ...emptyCustomerContactRow(nextContactKey()), isPrimary: false },
            ],
          },
    );
  }, [setForm]);

  const removeContact = useCallback(
    (index: number) => {
      setForm((current) => {
        if (current.contacts.length <= 1) return current;
        const contacts = current.contacts.filter((_contact, position) => position !== index);
        if (!contacts.some((contact) => contact.isPrimary)) contacts[0].isPrimary = true;
        return { ...current, contacts };
      });
    },
    [setForm],
  );

  const setContactPhone = useCallback(
    (index: number, phoneIndex: number, value: string) => {
      patchContact(index, (contact) => ({
        ...contact,
        phones: contact.phones.map((phone, position) =>
          position === phoneIndex ? value : phone,
        ),
      }));
    },
    [patchContact],
  );

  const addContactPhone = useCallback(
    (index: number) => {
      patchContact(index, (contact) =>
        contact.phones.length >= CUSTOMER_PROFILE_CREATE_LIMITS.phones
          ? contact
          : { ...contact, phones: [...contact.phones, ""] },
      );
    },
    [patchContact],
  );

  const removeContactPhone = useCallback(
    (index: number, phoneIndex: number) => {
      patchContact(index, (contact) => {
        const phones = contact.phones.filter((_phone, position) => position !== phoneIndex);
        return { ...contact, phones: phones.length > 0 ? phones : [""] };
      });
    },
    [patchContact],
  );

  const submit = useCallback(async () => {
    // Every field speaks now, including the ones never focused. Submit is not
    // disabled while the form is invalid: a disabled button gives a keyboard
    // user no way to ask what is wrong, so the press is what reveals it.
    revealAll();
    if (!branchId || isSubmitting || Object.keys(allErrors).length > 0) return;
    const attempt = createCrmWriteAttempt();
    const body = buildCreateCustomerProfileFullRequest(form, branchId);

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
          setOpen(false);
          reset();
          onCreated(outcome.value.id);
          return;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({ attempt, error: outcome.error, replay: send });
          return;
        }
        if (outcome.kind === "applied_unreadable") {
          // The modal closes and the form is cleared, so there is nothing left
          // to press Save on, and the panel carries the key a person can use to
          // find the record.
          setAmbiguity(null);
          setError(null);
          setOpen(false);
          reset();
          setAppliedUnreadable({ attempt, error: outcome.error });
          onReconcile();
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
  }, [allErrors, branchId, form, isSubmitting, onCreated, onReconcile, reset, revealAll]);

  return {
    ...state,
    open,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onReconcile,
    openModal: () => {
      reset();
      setError(null);
      setAmbiguity(null);
      setOpen(true);
    },
    closeModal: () => {
      reset();
      setError(null);
      setOpen(false);
    },
    setProfileType,
    setCustomField,
    setPhone,
    addPhone,
    removePhone,
    updateContact,
    setContactPrimary,
    addContact,
    removeContact,
    setContactPhone,
    addContactPhone,
    removeContactPhone,
    submit,
  };
}
