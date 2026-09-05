"use client";

import { useCallback } from "react";
import {
  useCrmCreateForm,
  type CrmFormErrors,
} from "../../shared/hooks/useCrmCreateForm";
import {
  emptyCreateLeadForm,
  emptyLeadContact,
  LEAD_CREATE_LIMITS,
  type CreateLeadForm,
  type LeadAddressForm,
  type LeadContactForm,
  type CrmProfileType,
} from "../lead-create-contract";
import {
  validateCreateLead,
  type LeadCreateMessages,
} from "../lead-create-validation";

let contactKeySeed = 0;
function nextContactKey(): string {
  contactKeySeed += 1;
  return `contact-${contactKeySeed}`;
}

/**
 * The comparison the dirty guard runs on.
 *
 * Row keys are flattened out: they are React identity, not user data, and a
 * contact added then removed would otherwise leave the form permanently
 * "dirty" and make every close ask a question with no answer behind it.
 */
function fingerprint(form: CreateLeadForm): string {
  return JSON.stringify({
    ...form,
    contacts: form.contacts.map((contact) => ({ ...contact, key: "" })),
  });
}

interface CreateLeadFormState {
  form: CreateLeadForm;
  errors: CrmFormErrors;
  /** Every error, including the ones still silent. What submit is gated on. */
  allErrors: CrmFormErrors;
  isDirty: boolean;
  setField: <K extends keyof CreateLeadForm>(key: K, value: CreateLeadForm[K]) => void;
  setProfileType: (profileType: CrmProfileType) => void;
  setAddressField: (key: keyof LeadAddressForm, value: string) => void;
  setCustomField: (fieldKey: string, value: unknown) => void;
  setPhone: (list: "phones" | "companyPhones", index: number, value: string) => void;
  addPhone: (list: "phones" | "companyPhones") => void;
  removePhone: (list: "phones" | "companyPhones", index: number) => void;
  selectCompany: (companyPartyId: string, displayName: string) => void;
  updateContact: (index: number, patch: Partial<Omit<LeadContactForm, "key">>) => void;
  setContactPrimary: (index: number) => void;
  addContact: () => void;
  removeContact: (index: number) => void;
  setContactPhone: (index: number, phoneIndex: number, value: string) => void;
  addContactPhone: (index: number) => void;
  removeContactPhone: (index: number, phoneIndex: number) => void;
  touch: (path: string) => void;
  /** Reveals every error. Called from submit so a never-blurred field still speaks. */
  revealAll: () => void;
  reset: () => void;
}

/**
 * State for the create-lead modal.
 *
 * Errors are silent until the field they belong to has been blurred, then live
 * until it is valid again — docs/design/primitives.md#validate-on-blur-not-on-keystroke.
 * A shared touched-set rather than one `useBlurValidation` per field, because
 * the contacts and phone rows are dynamic and a hook cannot be called per row.
 */
export function useCreateLeadForm(messages: LeadCreateMessages, requiredCustomFieldKeys: readonly string[]) {
  const validate = useCallback(
    (candidate: CreateLeadForm) =>
      validateCreateLead(candidate, messages, requiredCustomFieldKeys),
    [messages, requiredCustomFieldKeys],
  );
  const createInitial = useCallback(() => emptyCreateLeadForm(nextContactKey()), []);
  const { form, errors, allErrors, isDirty, setForm, setField, touch, revealAll, reset } =
    useCrmCreateForm({ createInitial, validate, fingerprint });

  const patchContact = useCallback(
    (index: number, update: (contact: LeadContactForm) => LeadContactForm) => {
      setForm((current) => ({
        ...current,
        contacts: current.contacts.map((contact, position) =>
          position === index ? update(contact) : contact,
        ),
      }));
    },
    [setForm],
  );

  // Switching profile type is not a cosmetic change: `assertCorporateLeadDetails`
  // answers a corporate registration field on an individual lead with a 422, and
  // an `existingCompanyPartyId` there with another. Both are cleared on the way
  // across rather than left to be sent and rejected.
  const setProfileType = useCallback((profileType: CrmProfileType) => {
    setForm((current) => {
      if (profileType === "CORPORATE") return { ...current, leadProfileType: profileType };
      return {
        ...current,
        leadProfileType: profileType,
        existingCompanyPartyId: "",
        legalName: "",
        taxNumber: "",
        commercialRegistrationNumber: "",
      };
    });
  }, [setForm]);

  const setAddressField = useCallback((key: keyof LeadAddressForm, value: string) => {
    setForm((current) => ({ ...current, address: { ...current.address, [key]: value } }));
  }, [setForm]);

  const setCustomField = useCallback((fieldKey: string, value: unknown) => {
    setForm((current) => ({
      ...current,
      customFields: { ...current.customFields, [fieldKey]: value },
    }));
  }, [setForm]);

  const setPhone = useCallback(
    (list: "phones" | "companyPhones", index: number, value: string) => {
      setForm((current) => ({
        ...current,
        [list]: current[list].map((phone, position) => (position === index ? value : phone)),
      }));
    },
    [setForm],
  );

  const addPhone = useCallback((list: "phones" | "companyPhones") => {
    setForm((current) =>
      current[list].length >= LEAD_CREATE_LIMITS.phones
        ? current
        : { ...current, [list]: [...current[list], ""] },
    );
  }, [setForm]);

  const removePhone = useCallback((list: "phones" | "companyPhones", index: number) => {
    setForm((current) => {
      const next = current[list].filter((_phone, position) => position !== index);
      return { ...current, [list]: next.length > 0 ? next : [""] };
    });
  }, [setForm]);

  /**
   * Picking a company from the Directory.
   *
   * Any contact that was chosen from the PREVIOUS company is reset: its
   * `contactPartyId` belongs to an organization this lead no longer points at,
   * and `ensureCorporateContactsBatch` answers a contact outside the company
   * with `409 PARTY_CONTACT_INVALID`. A contact the user typed themselves is
   * left alone — it was never tied to a company.
   */
  const selectCompany = useCallback((companyPartyId: string, displayName: string) => {
    setForm((current) => ({
      ...current,
      existingCompanyPartyId: companyPartyId,
      companyName: displayName || current.companyName,
      contacts: current.contacts.map((contact) =>
        contact.contactPartyId.length > 0
          ? { ...emptyLeadContact(contact.key), isPrimary: contact.isPrimary }
          : contact,
      ),
    }));
  }, [setForm]);

  const updateContact = useCallback(
    (index: number, patch: Partial<Omit<LeadContactForm, "key">>) => {
      patchContact(index, (contact) => ({ ...contact, ...patch }));
    },
    [patchContact],
  );

  // Exactly one primary: `saveCorporateLeadContacts` throws
  // LEAD_CONTACT_PRIMARY_INVALID on two, and silently promotes row 0 on none.
  const setContactPrimary = useCallback((index: number) => {
    setForm((current) => ({
      ...current,
      contacts: current.contacts.map((contact, position) => ({
        ...contact,
        isPrimary: position === index,
      })),
    }));
  }, [setForm]);

  const addContact = useCallback(() => {
    setForm((current) =>
      current.contacts.length >= LEAD_CREATE_LIMITS.contacts
        ? current
        : {
            ...current,
            contacts: [
              ...current.contacts,
              { ...emptyLeadContact(nextContactKey()), isPrimary: false },
            ],
          },
    );
  }, [setForm]);

  const removeContact = useCallback((index: number) => {
    setForm((current) => {
      if (current.contacts.length <= 1) return current;
      const contacts = current.contacts.filter((_contact, position) => position !== index);
      if (!contacts.some((contact) => contact.isPrimary)) contacts[0].isPrimary = true;
      return { ...current, contacts };
    });
  }, [setForm]);

  const setContactPhone = useCallback(
    (index: number, phoneIndex: number, value: string) => {
      patchContact(index, (contact) => ({
        ...contact,
        phones: contact.phones.map((phone, position) => (position === phoneIndex ? value : phone)),
      }));
    },
    [patchContact],
  );

  const addContactPhone = useCallback(
    (index: number) => {
      patchContact(index, (contact) =>
        contact.phones.length >= LEAD_CREATE_LIMITS.phones
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

  return {
    form,
    errors,
    allErrors,
    isDirty,
    setField,
    setProfileType,
    setAddressField,
    setCustomField,
    setPhone,
    addPhone,
    removePhone,
    selectCompany,
    updateContact,
    setContactPrimary,
    addContact,
    removeContact,
    setContactPhone,
    addContactPhone,
    removeContactPhone,
    touch,
    revealAll,
    reset,
  } satisfies CreateLeadFormState;
}
