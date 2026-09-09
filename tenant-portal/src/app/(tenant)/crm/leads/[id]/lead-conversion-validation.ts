import { isUUIDv7 } from "@/lib/uuid";
import { looksLikeEmail } from "../../shared/crm-form-validation";
import { isExactMoneyDecimal } from "../../shared/money";
import { fromIsoDate, toIsoDate } from "../../shared/iso-date";
import { CRM_CONTACT_METHOD_TYPES, CRM_PROFILE_TYPES } from "../lead-contract";
import type { LeadConversionForm } from "./lead-conversion-contract";

type ConversionIssue = "required" | "invalid" | "email" | "amount" | "duplicate";

/** Exact limits from the three nested ConvertLeadDto classes, rechecked 2026-09-07. */
export function validateLeadConversion(form: LeadConversionForm, requiredCustomFields: readonly string[] = []) {
  const errors: Record<string, ConversionIssue> = {};
  const text = (key: string, value: string, max: number, required = false) => {
    if (required && !value.trim()) errors[key] = "required";
    else if ([...value.trim()].length > max) errors[key] = "invalid";
  };
  const integer = (key: string, value: string, max: number) => {
    if (value !== "" && (!/^\d+$/.test(value) || Number(value) > max)) errors[key] = "invalid";
  };
  if (!CRM_PROFILE_TYPES.includes(form.profileType)) errors.profileType = "invalid";
  text("displayName", form.displayName, 180);
  if (form.profileType === "CORPORATE") text("companyName", form.companyName, 180);
  if (form.newContact && form.profileType === "CORPORATE") {
    text("contactFullName", form.contactFullName, 180, !form.contactFirstName.trim() && !form.contactLastName.trim());
    text("contactFirstName", form.contactFirstName, 80);
    text("contactLastName", form.contactLastName, 80);
    text("contactJobTitle", form.contactJobTitle, 120);
    text("contactEmail", form.contactEmail, 180);
    if (form.contactEmail.trim() && !looksLikeEmail(form.contactEmail)) errors.contactEmail = "email";
    if (form.contactMethods.length > 20) errors.contactMethods = "invalid";
    // Same type/value normalization as PartyDirectoryAdapter.normalizeContactValue.
    const seen = new Set(form.contactEmail.trim() ? ["EMAIL:" + form.contactEmail.trim().toLowerCase()] : []);
    form.contactMethods.forEach((method, index) => {
      const key = "contactMethods." + index;
      if (!CRM_CONTACT_METHOD_TYPES.includes(method.methodType)) errors[key + ".methodType"] = "invalid";
      text(key + ".value", method.value, 255, true);
      text(key + ".label", method.label ?? "", 80);
      const value = method.methodType === "EMAIL" ? method.value.trim().toLowerCase()
        : ["PHONE", "MOBILE", "WHATSAPP"].includes(method.methodType) ? method.value.replace(/[^\d+]/g, "").trim() : method.value.trim();
      const identity = method.methodType + ":" + value;
      if (seen.has(identity)) errors[key + ".value"] = "duplicate";
      seen.add(identity);
    });
  }
  if (form.createOpportunity) {
    for (const key of ["pipelineId", "stageId"] as const) if (!isUUIDv7(form[key])) errors[key] = "required";
    text("title", form.title, 180, true);
    text("description", form.description, 2000);
    integer("importance", form.importance, 3);
    integer("probabilityPercent", form.probabilityPercent, 100);
    if (!isExactMoneyDecimal(form.amount)) errors.amount = "amount";
    if (form.currencyCode.trim() && [...form.currencyCode.trim().toUpperCase()].length !== 3) errors.currencyCode = "invalid";
    if (form.ownerUserId && !isUUIDv7(form.ownerUserId)) errors.ownerUserId = "invalid";
    if (form.expectedCloseDate && toIsoDate(fromIsoDate(form.expectedCloseDate)) !== form.expectedCloseDate) errors.expectedCloseDate = "invalid";
    for (const key of requiredCustomFields) {
      const value = form.customFields[key];
      if (value == null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length)) errors["customFields." + key] = "required";
    }
  }
  return errors;
}
