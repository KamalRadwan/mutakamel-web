import { describe, expect, it } from "vitest";
import { buildConvertLeadRequest, initialLeadConversion, parseLeadConversionResponse, type LeadConversionForm } from "./lead-conversion-contract";
import { validateLeadConversion } from "./lead-conversion-validation";
import { CONVERSION_IDS as ids, conversionLead, conversionReceipt } from "./__fixtures__/lead-conversion";

function form(overrides: Partial<LeadConversionForm> = {}) {
  return { ...initialLeadConversion(conversionLead), ...overrides };
}
function opportunity(overrides: Partial<LeadConversionForm> = {}) {
  return form({ createOpportunity: true, pipelineId: ids.pipeline, stageId: ids.membership, ...overrides });
}

describe("ConvertLeadDto request", () => {
  it("defaults to the existing party/contact and no opportunity", () => {
    const initial = initialLeadConversion(conversionLead);
    expect(initial.newContact).toBe(false);
    expect(initial.createOpportunity).toBe(false);
    expect(initial.contactFullName).toBe("");
    expect(buildConvertLeadRequest(initial)).toEqual({
      profileType: "CORPORATE", displayName: "Acme", companyName: "Acme Trading", createOpportunity: false,
    });
  });
  it("omits blank optional names and hidden contact/opportunity values", () => {
    expect(buildConvertLeadRequest(form({ profileType: "INDIVIDUAL", displayName: " ",
      companyName: "Do not send", newContact: true, contactFullName: "Do not create", amount: "invalid" })))
      .toEqual({ profileType: "INDIVIDUAL", createOpportunity: false });
  });
  it("maps every contact DTO field without sending UI row ids", () => {
    const payload = buildConvertLeadRequest(form({ newContact: true, contactFullName: " Noura Saleh ",
      contactFirstName: " Noura ", contactLastName: " Saleh ", contactJobTitle: " Sales ", contactEmail: " n@example.test ",
      contactMethods: [{ rowId: ids.party, methodType: "MOBILE", value: " +201000000000 ", label: " Work " }] }));
    expect(payload.primaryContact).toEqual({ fullName: "Noura Saleh", firstName: "Noura", lastName: "Saleh", jobTitle: "Sales",
      email: "n@example.test", contactMethods: [{ methodType: "MOBILE", value: "+201000000000", label: "Work" }] });
  });
  it("supports the server's composed-name fallback", () => {
    expect(buildConvertLeadRequest(form({ newContact: true, contactFirstName: "Noura" })).primaryContact).toEqual({ firstName: "Noura" });
    expect(validateLeadConversion(form({ newContact: true }))).toHaveProperty("contactFullName", "required");
  });
  it("maps the complete opportunity DTO and preserves valid zero values", () => {
    expect(buildConvertLeadRequest(opportunity({ title: " Upgrade ", importance: "0", amount: "1234.50", currencyCode: " egp ",
      ownerUserId: ids.owner, probabilityPercent: "0", expectedCloseDate: "2026-09-30", description: " Details ", customFields: { seats: 0 } })).opportunity)
      .toEqual({ pipelineId: ids.pipeline, stageId: ids.membership, title: "Upgrade", importance: 0, amount: 1234.5,
        currencyCode: "EGP", ownerUserId: ids.owner, probabilityPercent: 0, expectedCloseDate: "2026-09-30", description: "Details", customFields: { seats: 0 } });
    expect(buildConvertLeadRequest(opportunity({ amount: "0" })).opportunity?.amount).toBe(0);
  });
  it("omits optional opportunity defaults instead of inventing them", () => {
    expect(buildConvertLeadRequest(opportunity()).opportunity).toEqual({ pipelineId: ids.pipeline, stageId: ids.membership, title: "Acme" });
  });
  it.each([
    ["title", "x".repeat(181)], ["description", "x".repeat(2001)], ["importance", "4"], ["importance", "1.5"],
    ["probabilityPercent", "101"], ["probabilityPercent", "-1"], ["amount", "-1"], ["amount", "1.234"],
    ["currencyCode", "EG"], ["ownerUserId", "not-a-uuid"], ["expectedCloseDate", "2026-02-30"],
    ["pipelineId", "not-a-uuid"], ["stageId", "not-a-uuid"],
  ])("rejects invalid opportunity %s", (key, value) => {
    expect(validateLeadConversion(opportunity({ [key]: value }))).toHaveProperty(key);
    expect(() => buildConvertLeadRequest(opportunity({ [key]: value }))).toThrow();
  });
  it.each([
    ["displayName", 181], ["companyName", 181], ["contactFullName", 181], ["contactFirstName", 81],
    ["contactLastName", 81], ["contactJobTitle", 121], ["contactEmail", 181],
  ])("enforces the %s DTO length", (key, length) => {
    expect(validateLeadConversion(form({ newContact: true, contactFullName: "Noura", [key]: "x".repeat(length) }))).toHaveProperty(key);
  });
  it("rejects duplicate normalized contact methods, including the email field", () => {
    const errors = validateLeadConversion(form({ newContact: true, contactFullName: "Noura", contactEmail: "N@EXAMPLE.TEST", contactMethods: [
      { rowId: "1", methodType: "EMAIL", value: " n@example.test " },
      { rowId: "2", methodType: "PHONE", value: "+20 100-000" },
      { rowId: "3", methodType: "PHONE", value: "+20100000" },
    ] }));
    expect(errors["contactMethods.0.value"]).toBe("duplicate");
    expect(errors["contactMethods.2.value"]).toBe("duplicate");
  });
  it("rejects over 20 methods without silently truncating", () => {
    const value = form({ newContact: true, contactFullName: "Noura", contactMethods: Array.from({ length: 21 }, (_, i) =>
      ({ rowId: String(i), methodType: "OTHER", value: String(i) })) });
    expect(validateLeadConversion(value).contactMethods).toBe("invalid");
    expect(() => buildConvertLeadRequest(value)).toThrow();
  });
  it("validates required custom fields only when creating an opportunity", () => {
    expect(validateLeadConversion(opportunity(), ["seats"])["customFields.seats"]).toBe("required");
    expect(validateLeadConversion(opportunity({ customFields: { seats: 0, active: false } }), ["seats", "active"])).toEqual({});
    expect(validateLeadConversion(form(), ["seats"])).toEqual({});
  });
});

describe("actual conversion service receipt", () => {
  it.each([false, true])("accepts flat ids with opportunity=%s", (withOpportunity) => {
    const receipt = parseLeadConversionResponse(conversionReceipt(withOpportunity), ids.lead, withOpportunity);
    expect(receipt.customerProfileId).toBe(ids.customer);
    expect(receipt.opportunityId).toBe(withOpportunity ? ids.opportunity : null);
  });
  it("rejects the obsolete Swagger shape, foreign record ids and inconsistent receipts", () => {
    const receipt = conversionReceipt(true);
    for (const payload of [
      { lead: receipt.lead, customerProfile: { id: ids.customer }, opportunity: { id: ids.opportunity } },
      { ...receipt, customerProfileId: "invalid" },
      { ...receipt, lead: { ...receipt.lead, id: ids.party } },
      { ...receipt, lead: { ...receipt.lead, status: "OPEN" } },
      { ...receipt, lead: { ...receipt.lead, convertedCustomerProfileId: ids.party } },
      { ...receipt, opportunityId: ids.party },
    ]) expect(() => parseLeadConversionResponse(payload, ids.lead, true)).toThrow();
    expect(() => parseLeadConversionResponse(receipt, ids.lead, false)).toThrow();
    expect(() => parseLeadConversionResponse(conversionReceipt(), ids.lead, true)).toThrow();
  });
});
