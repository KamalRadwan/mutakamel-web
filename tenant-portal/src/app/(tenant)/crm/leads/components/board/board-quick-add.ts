import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { CrmErrorBag, type CrmFieldMessages } from "../../../shared/crm-form-validation";
import {
  LEAD_CREATE_LIMITS,
  type CreateLeadRequest,
  type CrmProfileType,
  type QuickCreateLeadDraft,
} from "../../lead-create-contract";

export type BoardQuickAddPhoneList = "phones" | "companyPhones" | "contactPhones";

export interface BoardQuickAddValues {
  leadProfileType: CrmProfileType;
  firstName: string;
  lastName: string;
  phones: string[];
  /** Empty means "create a new company" — the full form's convention. */
  existingCompanyPartyId: string;
  companyName: string;
  companyPhones: string[];
  contactFirstName: string;
  contactLastName: string;
  contactPhones: string[];
  /** Empty until the user picks one; `defaultQuickAddSourceId` fills the gap. */
  acquisitionSourceId: string;
  rating: number;
}

export type BoardQuickAddTextField =
  | "firstName"
  | "lastName"
  | "companyName"
  | "contactFirstName"
  | "contactLastName";

export const EMPTY_BOARD_QUICK_ADD: BoardQuickAddValues = {
  leadProfileType: "INDIVIDUAL",
  firstName: "",
  lastName: "",
  phones: [""],
  existingCompanyPartyId: "",
  companyName: "",
  companyPhones: [""],
  contactFirstName: "",
  contactLastName: "",
  contactPhones: [""],
  acquisitionSourceId: "",
  rating: 0,
};

const FACEBOOK_NAMES = ["facebook", "فيسبوك", "فيس بوك"];

/**
 * The source a quick-added lead starts with.
 *
 * A product default: most leads typed straight into a column come from the
 * Facebook campaigns, and the source catalogue carries no "default" flag, so
 * the Facebook entry is found by its name in either language. A tenant without
 * one starts on the catalogue's first source. The user can still change it.
 */
export function defaultQuickAddSourceId(sources: readonly AcquisitionSource[]): string {
  const facebook = sources.find((source) =>
    [source.nameEn, source.nameAr].some((name) =>
      FACEBOOK_NAMES.some((needle) => name.trim().toLowerCase().includes(needle)),
    ),
  );
  return facebook?.id ?? sources[0]?.id ?? "";
}

function cleanPhones(phones: readonly string[]): string[] {
  return phones.map((phone) => phone.trim()).filter((phone) => phone.length > 0);
}

function phonesOrBlank(phones: readonly string[]): string[] {
  return phones.length > 0 ? [...phones] : [""];
}

export function validateBoardQuickAdd(
  values: BoardQuickAddValues,
  sourceId: string,
  messages: CrmFieldMessages,
): Record<string, string> {
  const bag = new CrmErrorBag(messages);
  bag.required("acquisitionSourceId", sourceId);

  if (values.leadProfileType === "INDIVIDUAL") {
    if (bag.required("firstName", values.firstName)) {
      bag.maxLength("firstName", values.firstName, LEAD_CREATE_LIMITS.firstName);
    }
    if (bag.required("lastName", values.lastName)) {
      bag.maxLength("lastName", values.lastName, LEAD_CREATE_LIMITS.lastName);
    }
    bag.phones("phones", values.phones);
    return bag.errors;
  }

  if (!values.existingCompanyPartyId) {
    if (bag.required("companyName", values.companyName)) {
      bag.maxLength("companyName", values.companyName, LEAD_CREATE_LIMITS.companyName);
    }
    bag.phones("companyPhones", values.companyPhones);
  }
  if (bag.required("contactFirstName", values.contactFirstName)) {
    bag.maxLength("contactFirstName", values.contactFirstName, LEAD_CREATE_LIMITS.firstName);
  }
  bag.maxLength("contactLastName", values.contactLastName, LEAD_CREATE_LIMITS.lastName);
  bag.phones("contactPhones", values.contactPhones);
  return bag.errors;
}

interface QuickAddScope {
  branchId: string;
  stageId: string;
  sourceId: string;
}

export function buildBoardQuickAddRequest(
  values: BoardQuickAddValues,
  { branchId, stageId, sourceId }: QuickAddScope,
): CreateLeadRequest {
  const base = { branchId, stageId, acquisitionSourceId: sourceId };

  if (values.leadProfileType === "INDIVIDUAL") {
    const phones = cleanPhones(values.phones);
    return {
      ...base,
      leadProfileType: "INDIVIDUAL",
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      ...(phones.length > 0 && { phones }),
    };
  }

  const contactPhones = cleanPhones(values.contactPhones);
  const contactLastName = values.contactLastName.trim();
  const contacts = [
    {
      firstName: values.contactFirstName.trim(),
      ...(contactLastName && { lastName: contactLastName }),
      isPrimary: true as const,
      ...(contactPhones.length > 0 && { phones: contactPhones }),
    },
  ];
  if (values.existingCompanyPartyId) {
    return {
      ...base,
      leadProfileType: "CORPORATE",
      existingCompanyPartyId: values.existingCompanyPartyId,
      contacts,
    };
  }
  const companyPhones = cleanPhones(values.companyPhones);
  return {
    ...base,
    leadProfileType: "CORPORATE",
    companyName: values.companyName.trim(),
    ...(companyPhones.length > 0 && { companyPhones }),
    contacts,
  };
}

/** What the full create form opens pre-filled with. */
export function buildBoardQuickAddDraft(
  values: BoardQuickAddValues,
  { stageId, sourceId, existingCompanyName }: Omit<QuickAddScope, "branchId"> & {
    existingCompanyName: string;
  },
): QuickCreateLeadDraft {
  return {
    leadProfileType: values.leadProfileType,
    stageId,
    acquisitionSourceId: sourceId,
    firstName: values.firstName,
    lastName: values.lastName,
    phones: phonesOrBlank(values.phones),
    existingCompanyPartyId: values.existingCompanyPartyId,
    companyName: values.existingCompanyPartyId ? existingCompanyName : values.companyName,
    companyPhones: values.existingCompanyPartyId ? [""] : phonesOrBlank(values.companyPhones),
    contactFirstName: values.contactFirstName,
    contactLastName: values.contactLastName,
    contactPhones: phonesOrBlank(values.contactPhones),
  };
}
