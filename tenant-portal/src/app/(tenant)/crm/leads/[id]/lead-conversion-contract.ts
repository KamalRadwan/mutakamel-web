import { isUUIDv7 } from "@/lib/uuid";
import { toMoneyWireNumber } from "../../shared/money";
import { parseLeadDetailResponse, type CrmContactMethodType, type CrmProfileType, type LeadDetail } from "../lead-contract";
import { validateLeadConversion } from "./lead-conversion-validation";

// Complete conversion DTOs: crm-app/src/crm/leads/dto/lead.dto.ts.
interface ConversionContactMethod {
  methodType: CrmContactMethodType;
  value: string;
  label?: string;
}
interface ConversionContact {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  contactMethods?: ConversionContactMethod[];
}
interface ConversionOpportunity {
  pipelineId: string;
  stageId: string;
  title: string;
  importance?: number;
  amount?: number;
  description?: string;
  currencyCode?: string;
  ownerUserId?: string;
  expectedCloseDate?: string;
  probabilityPercent?: number;
  customFields?: Record<string, unknown>;
}
export interface ConvertLeadRequest {
  profileType: CrmProfileType;
  displayName?: string;
  companyName?: string;
  primaryContact?: ConversionContact;
  createOpportunity?: boolean;
  opportunity?: ConversionOpportunity;
}
export interface LeadConversionForm {
  profileType: CrmProfileType;
  displayName: string;
  companyName: string;
  newContact: boolean;
  contactFullName: string;
  contactFirstName: string;
  contactLastName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactMethods: Array<ConversionContactMethod & { rowId: string }>;
  createOpportunity: boolean;
  pipelineId: string;
  stageId: string;
  title: string;
  importance: string;
  amount: string;
  description: string;
  currencyCode: string;
  ownerUserId: string;
  expectedCloseDate: string;
  probabilityPercent: string;
  customFields: Record<string, unknown>;
}

export function initialLeadConversion(lead: LeadDetail): LeadConversionForm {
  return {
    profileType: lead.leadProfileType, displayName: lead.displayName,
    companyName: lead.companyName ?? "", newContact: false,
    contactFullName: "", contactFirstName: "", contactLastName: "",
    contactJobTitle: "", contactEmail: "", contactMethods: [],
    createOpportunity: false, pipelineId: "", stageId: "", title: lead.displayName,
    importance: "", amount: "", description: "", currencyCode: "",
    ownerUserId: "", expectedCloseDate: "", probabilityPercent: "", customFields: {},
  };
}

export function buildConvertLeadRequest(form: LeadConversionForm): ConvertLeadRequest {
  if (Object.keys(validateLeadConversion(form)).length) throw new Error("Invalid conversion form.");
  const request: ConvertLeadRequest = { profileType: form.profileType, createOpportunity: form.createOpportunity };
  if (form.displayName.trim()) request.displayName = form.displayName.trim();
  if (form.profileType === "CORPORATE" && form.companyName.trim()) request.companyName = form.companyName.trim();
  // Supplying primaryContact creates a NEW person. Never resend an existing contact.
  if (form.profileType === "CORPORATE" && form.newContact) {
    const contact: ConversionContact = {};
    if (form.contactFullName.trim()) contact.fullName = form.contactFullName.trim();
    if (form.contactFirstName.trim()) contact.firstName = form.contactFirstName.trim();
    if (form.contactLastName.trim()) contact.lastName = form.contactLastName.trim();
    if (form.contactJobTitle.trim()) contact.jobTitle = form.contactJobTitle.trim();
    if (form.contactEmail.trim()) contact.email = form.contactEmail.trim();
    if (form.contactMethods.length) contact.contactMethods = form.contactMethods.map((method) => ({
      methodType: method.methodType, value: method.value.trim(),
      ...(method.label?.trim() ? { label: method.label.trim() } : {}),
    }));
    request.primaryContact = contact;
  }
  if (form.createOpportunity) {
    const opportunity: ConversionOpportunity = { pipelineId: form.pipelineId, stageId: form.stageId, title: form.title.trim() };
    const amount = toMoneyWireNumber(form.amount);
    if (amount !== undefined) opportunity.amount = amount;
    if (form.importance !== "") opportunity.importance = Number(form.importance);
    if (form.probabilityPercent !== "") opportunity.probabilityPercent = Number(form.probabilityPercent);
    if (form.currencyCode.trim()) opportunity.currencyCode = form.currencyCode.trim().toUpperCase();
    if (form.description.trim()) opportunity.description = form.description.trim();
    if (form.ownerUserId) opportunity.ownerUserId = form.ownerUserId;
    if (form.expectedCloseDate) opportunity.expectedCloseDate = form.expectedCloseDate;
    if (Object.keys(form.customFields).length) opportunity.customFields = form.customFields;
    request.opportunity = opportunity;
  }
  return request;
}

export interface LeadConversionResult {
  lead: LeadDetail;
  customerProfileId: string;
  opportunityId: string | null;
}

/** The service returns flat ids, NOT the stale Swagger customerProfile/opportunity objects. */
export function parseLeadConversionResponse(payload: unknown, expectedLeadId: string, expectsOpportunity: boolean): LeadConversionResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid conversion response.");
  const result = payload as Record<string, unknown>;
  const lead = parseLeadDetailResponse(result.lead);
  if (!isUUIDv7(result.customerProfileId) || lead.id !== expectedLeadId ||
    lead.status !== "CONVERTED" || lead.convertedCustomerProfileId !== result.customerProfileId) {
    throw new Error("Invalid conversion receipt.");
  }
  const opportunityId = result.opportunityId ?? null;
  if ((opportunityId !== null && !isUUIDv7(opportunityId)) ||
    expectsOpportunity !== (opportunityId !== null) || lead.convertedOpportunityId !== opportunityId) {
    throw new Error("Invalid conversion opportunity receipt.");
  }
  return { lead, customerProfileId: result.customerProfileId, opportunityId: opportunityId as string | null };
}
