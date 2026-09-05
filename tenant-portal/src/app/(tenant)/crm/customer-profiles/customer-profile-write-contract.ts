// Request builders for the customer-profile writes — MASTER-PLAN 8.7 and 8.9.
//
// Keys copied from
// `crm-app/src/crm/customer-profiles/dto/customer-profile.dto.ts`, and nothing
// else is sent: `forbidNonWhitelisted` turns an extra key into a 400.

import type { CustomerProfileDetail } from "./customer-profile-contract";
import type {
  CustomerProfileStatus,
  CustomerProfileType,
} from "./hooks/useCustomerProfiles";

export interface CustomerProfileForm {
  profileType: CustomerProfileType;
  displayName: string;
  status: CustomerProfileStatus;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
  description: string;
  acquisitionSourceId: string;
}

export function toCustomerProfileForm(
  profile: CustomerProfileDetail,
): CustomerProfileForm {
  return {
    profileType: profile.profileType,
    displayName: profile.displayName,
    status: profile.status,
    companyName: profile.companyName ?? "",
    companyEmail: profile.companyEmail ?? "",
    companyPhone: profile.companyPhone ?? "",
    companyWebsite: profile.companyWebsite ?? "",
    taxNumber: profile.taxNumber ?? "",
    commercialRegistrationNumber: profile.commercialRegistrationNumber ?? "",
    description: profile.description ?? "",
    acquisitionSourceId: profile.acquisitionSourceId ?? "",
  };
}

/**
 * The corporate-only keys.
 *
 * `CustomerProfilesService.assertCorporateOnlyFields` rejects every one of them
 * on an `INDIVIDUAL` profile, so they are omitted rather than sent empty.
 */
const CORPORATE_ONLY_KEYS = [
  "companyName",
  "companyEmail",
  "companyPhone",
  "companyWebsite",
  "taxNumber",
  "commercialRegistrationNumber",
] as const;

export interface CreateCustomerProfileRequest {
  branchId: string;
  profileType: CustomerProfileType;
  displayName: string;
  status?: CustomerProfileStatus;
  acquisitionSourceId?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  description?: string;
}

export function buildCreateCustomerProfileRequest(
  form: CustomerProfileForm,
  branchId: string,
): CreateCustomerProfileRequest {
  const request: CreateCustomerProfileRequest = {
    branchId,
    profileType: form.profileType,
    displayName: form.displayName.trim(),
    status: form.status,
  };
  const description = form.description.trim();
  if (description.length > 0) request.description = description;
  if (form.acquisitionSourceId.length > 0) {
    request.acquisitionSourceId = form.acquisitionSourceId;
  }
  if (form.profileType === "CORPORATE") {
    for (const key of CORPORATE_ONLY_KEYS) {
      const value = form[key].trim();
      if (value.length > 0) request[key] = value;
    }
  }
  return request;
}

export type UpdateCustomerProfileRequest = Partial<
  Omit<CreateCustomerProfileRequest, "branchId" | "profileType" | "acquisitionSourceId">
> & {
  /** `@IsUUID('7')` on `string | null` — an explicit null is how it is cleared. */
  acquisitionSourceId?: string | null;
};

/**
 * Changed keys only, so a field another user edited between load and save is
 * left alone.
 *
 * `profileType` is absent from `UpdateCustomerProfileDto` entirely — a profile
 * does not change between individual and corporate — and `displayName` and
 * `companyName` carry `@IsNotEmpty()`, so an emptied box is omitted rather than
 * sent as `""`.
 */
export function buildUpdateCustomerProfileRequest(
  form: CustomerProfileForm,
  baseline: CustomerProfileForm,
): UpdateCustomerProfileRequest {
  const request: UpdateCustomerProfileRequest = {};

  if (form.status !== baseline.status) request.status = form.status;
  if (form.displayName.trim() !== baseline.displayName.trim()) {
    const displayName = form.displayName.trim();
    if (displayName.length > 0) request.displayName = displayName;
  }
  if (form.description.trim() !== baseline.description.trim()) {
    request.description = form.description.trim();
  }
  if (form.acquisitionSourceId !== baseline.acquisitionSourceId) {
    // An explicit `null` is how this reference is cleared. Omitting the key
    // would mean "leave it alone", which is the opposite of what an emptied
    // picker asked for.
    request.acquisitionSourceId =
      form.acquisitionSourceId.length > 0 ? form.acquisitionSourceId : null;
  }
  if (form.profileType === "CORPORATE") {
    for (const key of CORPORATE_ONLY_KEYS) {
      const next = form[key].trim();
      if (next === baseline[key].trim()) continue;
      if (key === "companyName" && next.length === 0) continue;
      request[key] = next;
    }
  }
  return request;
}

export interface CustomerContactForm {
  honorificTitle: string;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
}

export const EMPTY_CUSTOMER_CONTACT_FORM: CustomerContactForm = {
  honorificTitle: "",
  fullName: "",
  jobTitle: "",
  email: "",
  phone: "",
};

export interface AddCustomerContactRequest {
  fullName: string;
  honorificTitle?: string;
  jobTitle?: string;
  email?: string;
  phones?: string[];
}

/**
 * `POST /:id/contacts`, body `CustomerProfileContactPersonDto`.
 *
 * The phone travels as `phones: [value]` rather than a `phone` key — the DTO
 * has no singular `phone`, and inventing one is a 400.
 */
export function buildAddCustomerContactRequest(
  form: CustomerContactForm,
): AddCustomerContactRequest {
  const request: AddCustomerContactRequest = { fullName: form.fullName.trim() };
  const honorificTitle = form.honorificTitle.trim();
  const jobTitle = form.jobTitle.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();
  if (honorificTitle.length > 0) request.honorificTitle = honorificTitle;
  if (jobTitle.length > 0) request.jobTitle = jobTitle;
  if (email.length > 0) request.email = email;
  if (phone.length > 0) request.phones = [phone];
  return request;
}
