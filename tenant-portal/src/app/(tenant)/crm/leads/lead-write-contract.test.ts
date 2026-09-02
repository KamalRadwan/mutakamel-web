import { describe, expect, it } from "vitest";
import { MONEY_MAX_AMOUNT } from "../shared/money";
import {
  buildConvertLeadRequest,
  buildUpdateLeadRequest,
  isValidConversionAmount,
  parseLeadConversionResponse,
  type LeadConversionForm,
  type LeadEditForm,
} from "./lead-write-contract";

const LEAD_ID = "01900100-0000-7000-8000-000000000001";
const SOURCE = "01900100-0000-7000-8000-000000000030";
const PROFILE = "01900100-0000-7000-8000-000000000040";
const OPPORTUNITY = "01900100-0000-7000-8000-000000000041";
const PIPELINE = "01900100-0000-7000-8000-000000000050";
const PIPELINE_STAGE = "01900100-0000-7000-8000-000000000051";

const baseline: LeadEditForm = {
  displayName: "Acme Trading",
  firstName: "",
  lastName: "",
  honorificTitle: "Eng.",
  primaryMobile: "+201001112223",
  email: "lead@acme.test",
  companyName: "Acme Trading LLC",
  acquisitionSourceId: SOURCE,
  description: "",
  interestSummary: "",
  expectedNeed: "",
};

describe("lead update payload", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildUpdateLeadRequest({ ...baseline }, baseline)).toEqual({});
  });

  it("sends only the changed keys", () => {
    expect(
      buildUpdateLeadRequest({ ...baseline, displayName: "Acme Group" }, baseline),
    ).toEqual({ displayName: "Acme Group" });
  });

  it("clears a nullable field with an explicit null", () => {
    expect(buildUpdateLeadRequest({ ...baseline, email: "" }, baseline)).toEqual({
      email: null,
    });
    expect(
      buildUpdateLeadRequest({ ...baseline, acquisitionSourceId: "" }, baseline),
    ).toEqual({ acquisitionSourceId: null });
  });

  it("omits an emptied @IsNotEmpty field instead of sending an empty string", () => {
    // `displayName` and `companyName` have no documented way to be cleared,
    // and "" is a 422.
    expect(buildUpdateLeadRequest({ ...baseline, displayName: "" }, baseline)).toEqual({});
    expect(buildUpdateLeadRequest({ ...baseline, companyName: "" }, baseline)).toEqual({});
  });

  it("never sends stageId or status, which the update DTO does not carry", () => {
    const payload = buildUpdateLeadRequest(
      { ...baseline, interestSummary: "New" },
      baseline,
    );
    expect(payload).not.toHaveProperty("stageId");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("companyPhone");
  });
});

const conversion: LeadConversionForm = {
  profileType: "CORPORATE",
  displayName: "Acme Trading",
  companyName: "Acme Trading LLC",
  contactFullName: "Noura Saleh",
  contactJobTitle: "Procurement",
  contactEmail: "noura@acme.test",
  contactMethods: [{ methodType: "MOBILE", value: "+201000000000" }],
  createOpportunity: true,
  pipelineId: PIPELINE,
  stageId: PIPELINE_STAGE,
  title: "Initial ERP rollout",
  amount: "150000.00",
  currencyCode: "egp",
  expectedCloseDate: "2026-07-31",
};

describe("lead conversion payload", () => {
  it("builds the nested ConvertLeadDto shape", () => {
    expect(buildConvertLeadRequest(conversion)).toEqual({
      profileType: "CORPORATE",
      displayName: "Acme Trading",
      companyName: "Acme Trading LLC",
      primaryContact: {
        fullName: "Noura Saleh",
        jobTitle: "Procurement",
        email: "noura@acme.test",
        contactMethods: [{ methodType: "MOBILE", value: "+201000000000" }],
      },
      createOpportunity: true,
      opportunity: {
        pipelineId: PIPELINE,
        stageId: PIPELINE_STAGE,
        title: "Initial ERP rollout",
        // `@IsNumber({ maxDecimalPlaces: 2 })` — the DTO takes a number, not
        // the decimal string it returns.
        amount: 150000,
        currencyCode: "EGP",
        expectedCloseDate: "2026-07-31",
      },
    });
  });

  it("omits the company name on an individual conversion", () => {
    const payload = buildConvertLeadRequest({
      ...conversion,
      profileType: "INDIVIDUAL",
    });
    expect(payload).not.toHaveProperty("companyName");
    expect(payload.displayName).toBe("Acme Trading");
  });

  it("omits the opportunity block entirely when the switch is off", () => {
    const payload = buildConvertLeadRequest({
      ...conversion,
      createOpportunity: false,
    });
    expect(payload.createOpportunity).toBe(false);
    expect(payload).not.toHaveProperty("opportunity");
  });

  it("caps contact methods at the server's ArrayMaxSize(20)", () => {
    const payload = buildConvertLeadRequest({
      ...conversion,
      contactMethods: Array.from({ length: 25 }, () => ({
        methodType: "MOBILE" as const,
        value: "+201000000000",
      })),
    });
    expect(payload.primaryContact?.contactMethods).toHaveLength(20);
  });

  it("drops a contact method with an empty value", () => {
    const payload = buildConvertLeadRequest({
      ...conversion,
      contactMethods: [{ methodType: "EMAIL", value: "  " }],
    });
    expect(payload.primaryContact).not.toHaveProperty("contactMethods");
  });

  it("guards the amount so the one permitted Number() stays exact", () => {
    expect(isValidConversionAmount("")).toBe(true);
    expect(isValidConversionAmount("150000.00")).toBe(true);
    expect(isValidConversionAmount("1.234")).toBe(false);
    expect(isValidConversionAmount("-1")).toBe(false);
    expect(isValidConversionAmount("1234567890123456")).toBe(false);
    expect(() =>
      buildConvertLeadRequest({ ...conversion, amount: "1.234" }),
    ).toThrow();
    // D3: the comment this replaces said "16 integer digits crosses 2^53".
    // The integer part is not what has to survive — the value WITH its cents
    // is, and it stops being exact four orders of magnitude earlier.
    expect(isValidConversionAmount("999999999999999.99")).toBe(false);
    expect(isValidConversionAmount("99999999999999.99")).toBe(false);
    expect(isValidConversionAmount(MONEY_MAX_AMOUNT)).toBe(true);
    expect(
      buildConvertLeadRequest({ ...conversion, amount: MONEY_MAX_AMOUNT }).opportunity
        ?.amount,
    ).toBe(9999999999999.99);
  });

  it("drops a currency code that is not three letters", () => {
    const payload = buildConvertLeadRequest({ ...conversion, currencyCode: "EG" });
    expect(payload.opportunity).not.toHaveProperty("currencyCode");
  });

  it("reads both new record ids off the 201, and tolerates no opportunity", () => {
    expect(
      parseLeadConversionResponse({
        lead: { id: LEAD_ID },
        customerProfile: { id: PROFILE },
        opportunity: { id: OPPORTUNITY },
      }),
    ).toEqual({ customerProfileId: PROFILE, opportunityId: OPPORTUNITY });

    expect(
      parseLeadConversionResponse({
        lead: { id: LEAD_ID },
        customerProfile: { id: PROFILE },
      }),
    ).toEqual({ customerProfileId: PROFILE, opportunityId: null });
  });

  it("rejects a conversion response with no customer profile", () => {
    expect(() => parseLeadConversionResponse({ lead: { id: LEAD_ID } })).toThrow();
  });
});
