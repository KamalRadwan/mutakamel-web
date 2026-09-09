import type { LeadDetail } from "../lead-contract";
import { LEAD_CREATE_LIMITS, type LeadAddressForm } from "../lead-create-contract";
import {
  buildLeadCompanyFieldRequest,
  buildLeadCompanyPhonesRequest,
  type LeadCompanyField,
  type UpdateLeadRequest,
} from "../lead-write-contract";
import { CrmErrorBag, type CrmFieldMessages } from "../../shared/crm-form-validation";

export const COMPANY_FIELDS = [
  "companyName", "taxNumber", "commercialRegistrationNumber", "companyEmail", "companyWebsite",
] as const satisfies readonly LeadCompanyField[];

// crm-app/src/crm/leads/dto/lead.dto.ts — UpdateLeadDto and CreateLeadPartyAddressDto.
export const COMPANY_FIELD_LIMITS: Record<LeadCompanyField, number> = {
  companyName: LEAD_CREATE_LIMITS.companyName,
  companyEmail: LEAD_CREATE_LIMITS.email,
  companyWebsite: 255,
  taxNumber: LEAD_CREATE_LIMITS.taxNumber,
  commercialRegistrationNumber: LEAD_CREATE_LIMITS.commercialRegistrationNumber,
};

export interface LeadCompanyForm extends Record<LeadCompanyField, string> {
  phones: string[];
  address: LeadAddressForm;
}

export interface LeadCompanyUpdateRequest extends UpdateLeadRequest {
  address?: LeadAddressForm;
}

export function companyFormFromLead(lead: LeadDetail): LeadCompanyForm {
  return {
    companyName: lead.companyName ?? "",
    taxNumber: lead.taxNumber ?? "",
    commercialRegistrationNumber: lead.commercialRegistrationNumber ?? "",
    companyEmail: lead.companyEmail ?? "",
    companyWebsite: lead.companyWebsite ?? "",
    phones: lead.phones.length > 0 ? [...lead.phones] : [""],
    address: {
      country: lead.address?.country ?? "",
      state: lead.address?.area ?? "",
      city: lead.address?.city ?? "",
      street1: lead.address?.street ?? "",
      street2: lead.address?.apartment ?? "",
      buildingNo: lead.address?.buildingNo ?? "",
      floor: lead.address?.floor ?? "",
      landmark: lead.address?.landmark ?? "",
      postalCode: lead.address?.postalCode ?? "",
    },
  };
}

function normalizedAddress(address: LeadAddressForm): LeadAddressForm {
  return Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])) as unknown as LeadAddressForm;
}

export function companyFormIsDirty(form: LeadCompanyForm, baseline: LeadCompanyForm): boolean {
  return JSON.stringify(form) !== JSON.stringify(baseline);
}

export function validateCompanyForm(
  form: LeadCompanyForm,
  baseline: LeadCompanyForm,
  messages: CrmFieldMessages,
  addressClearMessage: string,
) {
  const bag = new CrmErrorBag(messages);
  for (const field of COMPANY_FIELDS) {
    if (form[field].trim() === baseline[field].trim()) continue;
    if (field === "companyName") bag.required(field, form[field]);
    if (field === "companyEmail") bag.email(field, form[field]);
    bag.maxLength(field, form[field], COMPANY_FIELD_LIMITS[field]);
  }
  bag.phones("companyPhones", form.phones);
  const address = normalizedAddress(form.address);
  if (JSON.stringify(address) !== JSON.stringify(normalizedAddress(baseline.address))) {
    if (!Object.values(address).some(Boolean)) bag.set("address", addressClearMessage);
    for (const [key, value] of Object.entries(address)) {
      const max = ["country", "state", "city"].includes(key) ? 120
        : ["street1", "landmark"].includes(key) ? 160 : key === "postalCode" ? 40 : 80;
      bag.maxLength(`address.${key}`, value, max);
    }
  }
  return bag.errors;
}

export function buildCompanyModalRequest(
  form: LeadCompanyForm,
  baseline: LeadCompanyForm,
): LeadCompanyUpdateRequest {
  let request: LeadCompanyUpdateRequest = {};
  for (const field of COMPANY_FIELDS) {
    if (form[field].trim() !== baseline[field].trim()) {
      request = { ...request, ...buildLeadCompanyFieldRequest(field, form[field]) };
    }
  }
  const phones = form.phones.map((phone) => phone.trim()).filter(Boolean);
  const stored = baseline.phones.map((phone) => phone.trim()).filter(Boolean);
  if (JSON.stringify(phones) !== JSON.stringify(stored)) {
    request = { ...request, ...buildLeadCompanyPhonesRequest(phones) };
  }
  const address = normalizedAddress(form.address);
  if (JSON.stringify(address) !== JSON.stringify(normalizedAddress(baseline.address))
    && Object.values(address).some(Boolean)) {
    // Lead update upserts the whole LEGAL address; omitted address properties
    // would clear untouched columns in the Directory.
    request.address = address;
  }
  return request;
}
