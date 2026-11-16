import { describe, expect, it } from "vitest";
import { EMPTY_OPPORTUNITY_FORM, buildCreateOpportunityRequest, buildUpdateOpportunityRequest, toOpportunityForm } from "./opportunity-write-contract";
import { parseOpportunityDetailResponse } from "./opportunity-contract";
import { isValidOpportunityAmount, isValidOpportunityDate } from "./opportunity-form-values";
import { validateCreateOpportunity, validateUpdateOpportunity, type OpportunityCreateMessages } from "./opportunity-create-validation";

const id = (suffix: string) => `01900100-0000-7000-8000-${suffix.padStart(12, "0")}`;
const fixture = { id: id("1"), branchId: id("2"), customerProfileId: id("3"), customerPartyId: id("4"), contactPartyId: id("5"), leadId: id("6"), pipelineId: id("7"), stageId: id("8"), status: "IN_PROGRESS", title: "Annual support", importance: 0, amount: null, currencyCode: null, description: null, probabilityPercent: null, expectedCloseDate: null, ownerUserId: id("9"), cardColor: "TEAL", createdAt: "2026-11-01T09:00:00.000Z", updatedAt: "2026-11-04T09:00:00.123Z" };
const baseline = toOpportunityForm(parseOpportunityDetailResponse(fixture));
const messages: OpportunityCreateMessages = { required: "Required", email: "Email", maxLength: "Max {max}", duplicatePhone: "Duplicate", phone: "Phone", url: "URL", amountInvalid: "Amount", outOfRange: "Range", currencyLength: "Currency", dateInvalid: "Real date", selectionInvalid: "Selection" };

describe("complete opportunity form contract", () => {
  it("retains saved nullable data and human-selected relations without adding a no-op snapshot", () => {
    expect(baseline).toMatchObject({ ownerUserId: id("9"), contactPartyId: id("5"), leadId: id("6"), cardColor: "TEAL", expectedUpdatedAt: fixture.updatedAt, amount: "", currencyCode: "", expectedCloseDate: "", probabilityPercent: "", importance: "0" });
    expect(buildUpdateOpportunityRequest(baseline, baseline)).toEqual({});
    expect(buildUpdateOpportunityRequest({ ...baseline, customerProfileId: id("99"), leadId: id("98"), pipelineId: id("97"), stageId: id("96") }, baseline)).toEqual({});
  });

  it("sends all editable relations, card clear and the exact original concurrency snapshot", () => {
    expect(buildUpdateOpportunityRequest({ ...baseline, ownerUserId: id("10"), contactPartyId: "", cardColor: null, expectedUpdatedAt: "changed by a draft" }, baseline)).toEqual({ ownerUserId: id("10"), contactPartyId: null, cardColor: null, expectedUpdatedAt: fixture.updatedAt });
    expect(() => buildUpdateOpportunityRequest({ ...baseline, ownerUserId: "" }, baseline)).toThrow("CRM_VALUE_OUT_OF_RANGE");
  });

  it("sends contact and source lead on create, omitting saved-only fields", () => {
    const request = buildCreateOpportunityRequest(baseline, fixture.branchId);
    expect(request).toMatchObject({ ownerUserId: id("9"), contactPartyId: id("5"), leadId: id("6"), importance: 0 });
    expect(request).not.toHaveProperty("cardColor");
    expect(request).not.toHaveProperty("expectedUpdatedAt");
  });

  it("accepts the exact API cap only with eligible currency scale and rejects one integer above it", () => {
    expect(isValidOpportunityAmount("8796093022207.999", "KWD")).toBe(true);
    expect(isValidOpportunityAmount("8796093022208", "KWD")).toBe(false);
    expect(isValidOpportunityAmount("8796093022207.999", "EGP")).toBe(false);
    expect(isValidOpportunityAmount("0000000000001.00", "EGP")).toBe(true);
  });

  it.each(["2026-02-29", "2026-11-31", "2026-11-04T00:00:00Z", "04/11/2026"])("rejects impossible or non date-only values %s", (date) => {
    expect(isValidOpportunityDate(date)).toBe(false);
    expect(validateUpdateOpportunity({ ...baseline, expectedCloseDate: date }, messages).expectedCloseDate).toBe("Real date");
    expect(() => buildUpdateOpportunityRequest({ ...baseline, expectedCloseDate: date }, baseline)).toThrow();
  });

  it("accepts leap dates and rejects currency punctuation, whitespace and non-ASCII letters", () => {
    expect(isValidOpportunityDate("2028-02-29")).toBe(true);
    for (const currencyCode of ["U$D", "1GP", "جنيه", "U D"]) {
      expect(validateCreateOpportunity({ ...baseline, currencyCode }, messages).currencyCode).toBe("Currency");
      expect(() => buildCreateOpportunityRequest({ ...baseline, currencyCode }, fixture.branchId)).toThrow("CRM_OPPORTUNITY_CURRENCY_INVALID");
    }
  });

  it("keeps update null clears and CREATE requirements independent", () => {
    expect(validateUpdateOpportunity({ ...baseline, customFields: { budget: 0, approved: false } }, messages, ["budget", "approved"])).toEqual({});
    expect(validateUpdateOpportunity({ ...baseline, customFields: { budget: null } }, messages, ["budget"])["customFields.budget"]).toBe("Required");
    expect(EMPTY_OPPORTUNITY_FORM.importance).toBe("0");
    expect(validateUpdateOpportunity({ ...baseline, importance: "" }, messages).importance).toBe("Required");
  });
});
