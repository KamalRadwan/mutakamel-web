"use client";

import { useI18n } from "@/i18n/I18nContext";
import {
  createAddress,
  createContactMethod,
  createPartyRole,
  deleteAddress,
  deleteContactMethod,
  deletePartyRole,
  updateAddress,
  updateContactMethod,
} from "../../directory-children-api";
import {
  ADDRESS_LIMIT_CODE,
  CONTACT_METHOD_LIMIT_CODE,
  ROLE_EXISTS_CODE,
  type PartyAddress,
  type PartyContactMethod,
  type PartyRole,
} from "../../directory-children-contract";
import { PARTY_DUPLICATE_CONTACT_METHOD_CODE, type Party } from "../../directory-contract";
import {
  buildAddressCreate,
  buildAddressUpdate,
  buildContactMethodCreate,
  buildContactMethodUpdate,
  buildRoleCreate,
  type AddressFormValues,
  type ContactMethodFormValues,
  type RoleFormValues,
} from "../../party-child-forms";
import { usePartyChildSection } from "./usePartyChildSection";

type SetParty = (updater: (current: Party | null) => Party | null) => void;

/**
 * The three party child sections, each gated on its own permission.
 *
 * A duplicate contact method comes back as `PARTY_DUPLICATE_CONTACT_METHOD`,
 * which is a **configured** refusal: `directory/settings` decides whether email,
 * phone or WhatsApp duplicates are blocked and at what scope. The message names
 * the setting rather than saying "duplicate" and leaving the user to guess
 * which rule fired.
 */
export function usePartyChildren(
  party: Party | null,
  setParty: SetParty,
  grants: { canManageContacts: boolean; canManageAddresses: boolean; canManageRoles: boolean },
) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;

  const contactMethods = usePartyChildSection<PartyContactMethod, ContactMethodFormValues>(
    party,
    setParty,
    {
      key: "contactMethods",
      canManage: grants.canManageContacts,
      create: createContactMethod,
      update: updateContactMethod,
      remove: deleteContactMethod,
      buildCreate: buildContactMethodCreate,
      buildUpdate: buildContactMethodUpdate,
      formMessage: (reason) =>
        reason === "CONTACT_METHOD_FORM_VALUE" ? copy.contactValueRequired : undefined,
      apiMessage: (code) => {
        if (code === PARTY_DUPLICATE_CONTACT_METHOD_CODE) return copy.contactDuplicateConfigured;
        if (code === CONTACT_METHOD_LIMIT_CODE) return copy.contactLimitReached;
        return undefined;
      },
      labels: {
        createFailed: copy.contactCreateFailed,
        updateFailed: copy.contactUpdateFailed,
        deleteFailed: copy.contactDeleteFailed,
        saved: copy.savedTitle,
      },
    },
  );

  const addresses = usePartyChildSection<PartyAddress, AddressFormValues>(party, setParty, {
    key: "addresses",
    canManage: grants.canManageAddresses,
    create: createAddress,
    update: updateAddress,
    remove: deleteAddress,
    buildCreate: buildAddressCreate,
    buildUpdate: buildAddressUpdate,
    formMessage: () => undefined,
    apiMessage: (code) => (code === ADDRESS_LIMIT_CODE ? copy.addressLimitReached : undefined),
    labels: {
      createFailed: copy.addressCreateFailed,
      updateFailed: copy.addressUpdateFailed,
      deleteFailed: copy.addressDeleteFailed,
      saved: copy.savedTitle,
    },
  });

  // `party-roles` has no PATCH route: a role is assigned or removed, never
  // edited, so `update`/`buildUpdate` are deliberately absent here.
  const roles = usePartyChildSection<PartyRole, RoleFormValues>(party, setParty, {
    key: "roles",
    canManage: grants.canManageRoles,
    create: createPartyRole,
    remove: deletePartyRole,
    buildCreate: buildRoleCreate,
    formMessage: () => undefined,
    apiMessage: (code) => (code === ROLE_EXISTS_CODE ? copy.roleAlreadyAssigned : undefined),
    labels: {
      createFailed: copy.roleCreateFailed,
      updateFailed: copy.roleCreateFailed,
      deleteFailed: copy.roleDeleteFailed,
      saved: copy.savedTitle,
    },
  });

  return { contactMethods, addresses, roles };
}
