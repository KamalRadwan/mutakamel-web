// The board's in-column quick-add card reaches the full create form two ways:
// "open the full form" carries a draft, "save" carries the request the card
// built. Both land in `CreateLeadForm`, because `useLeads.handleCreate` and the
// create modal speak only that shape.

import {
  emptyCreateLeadForm,
  emptyLeadContact,
  type CreateLeadForm,
  type CreateLeadRequest,
  type QuickCreateLeadDraft,
} from "./lead-create-contract";

function phonesOrBlank(phones: readonly string[] | undefined): string[] {
  return phones && phones.length > 0 ? [...phones] : [""];
}

/** The form's pristine values with the quick-add draft laid over them. */
export function applyQuickCreateDraft(
  base: CreateLeadForm,
  draft: QuickCreateLeadDraft,
): CreateLeadForm {
  return {
    ...base,
    leadProfileType: draft.leadProfileType,
    stageId: draft.stageId || base.stageId,
    acquisitionSourceId: draft.acquisitionSourceId || base.acquisitionSourceId,
    firstName: draft.firstName,
    lastName: draft.lastName,
    phones: phonesOrBlank(draft.phones),
    existingCompanyPartyId: draft.existingCompanyPartyId,
    companyName: draft.companyName,
    companyPhones: phonesOrBlank(draft.companyPhones),
    contacts: base.contacts.map((contact, index) =>
      index === 0
        ? {
            ...contact,
            firstName: draft.contactFirstName,
            lastName: draft.contactLastName,
            phones: phonesOrBlank(draft.contactPhones),
          }
        : contact,
    ),
  };
}

/**
 * The quick-add card's request as the form `handleCreate` files. The card
 * sends at most one contact, and only the fields it offers are carried over.
 */
export function createLeadFormFromQuickRequest(
  request: CreateLeadRequest,
  contactKey: string,
): CreateLeadForm {
  const form: CreateLeadForm = {
    ...emptyCreateLeadForm(contactKey),
    branchId: request.branchId,
    stageId: request.stageId ?? "",
    leadProfileType: request.leadProfileType,
    acquisitionSourceId: request.acquisitionSourceId ?? "",
  };
  if (request.leadProfileType !== "CORPORATE") {
    return {
      ...form,
      firstName: request.firstName ?? "",
      lastName: request.lastName ?? "",
      phones: phonesOrBlank(request.phones),
    };
  }
  const contact = request.contacts?.[0];
  return {
    ...form,
    existingCompanyPartyId: request.existingCompanyPartyId ?? "",
    companyName: request.companyName ?? "",
    companyPhones: phonesOrBlank(request.companyPhones),
    contacts: [
      {
        ...emptyLeadContact(contactKey),
        contactPartyId: contact?.contactPartyId ?? "",
        fullName: contact?.fullName ?? "",
        firstName: contact?.firstName ?? "",
        lastName: contact?.lastName ?? "",
        phones: phonesOrBlank(contact?.phones),
      },
    ],
  };
}
