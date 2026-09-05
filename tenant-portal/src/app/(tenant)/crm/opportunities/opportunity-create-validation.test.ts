import { describe, expect, it } from "vitest";
import {
  opportunitySectionErrorCount,
  sectionOfOpportunityError,
  validateCreateOpportunity,
  type OpportunityCreateMessages,
} from "./opportunity-create-validation";
import {
  EMPTY_OPPORTUNITY_FORM,
  buildCreateOpportunityRequest,
  type OpportunityForm,
} from "./opportunity-write-contract";

const BRANCH = "01900100-0000-7000-8000-000000000099";
const PROFILE = "01900100-0000-7000-8000-000000000001";
const PIPELINE = "01900100-0000-7000-8000-000000000002";
const STAGE = "01900100-0000-7000-8000-000000000003";

const messages: OpportunityCreateMessages = {
  required: "Required.",
  email: "Bad email.",
  maxLength: "At most {max} characters.",
  duplicatePhone: "Already listed.",
  url: "Bad URL.",
  amountInvalid: "Bad amount.",
  outOfRange: "Out of range.",
  currencyLength: "Three characters.",
};

function form(overrides: Partial<OpportunityForm> = {}): OpportunityForm {
  return {
    ...EMPTY_OPPORTUNITY_FORM,
    customerProfileId: PROFILE,
    pipelineId: PIPELINE,
    stageId: STAGE,
    title: "ERP rollout",
    ...overrides,
  };
}

describe("validateCreateOpportunity", () => {
  it("requires the four fields the DTO marks non-optional", () => {
    const errors = validateCreateOpportunity({ ...EMPTY_OPPORTUNITY_FORM }, messages);
    expect(errors.customerProfileId).toBe("Required.");
    expect(errors.pipelineId).toBe("Required.");
    expect(errors.stageId).toBe("Required.");
    expect(errors.title).toBe("Required.");
  });

  it("accepts a filled form with every optional field blank", () => {
    expect(validateCreateOpportunity(form(), messages)).toEqual({});
  });

  it("rejects an amount that would not survive as cents", () => {
    expect(validateCreateOpportunity(form({ amount: "12.345" }), messages).amount).toBe(
      "Bad amount.",
    );
    expect(validateCreateOpportunity(form({ amount: "12.34" }), messages).amount).toBeUndefined();
  });

  it("holds importance and probability to the DTO's integer ranges", () => {
    expect(validateCreateOpportunity(form({ importance: "4" }), messages).importance).toBe(
      "Out of range.",
    );
    expect(validateCreateOpportunity(form({ importance: "3" }), messages).importance).toBeUndefined();
    expect(
      validateCreateOpportunity(form({ probabilityPercent: "101" }), messages).probabilityPercent,
    ).toBe("Out of range.");
    expect(
      validateCreateOpportunity(form({ probabilityPercent: "50" }), messages).probabilityPercent,
    ).toBeUndefined();
  });

  it("requires a currency code to be exactly three characters when given", () => {
    expect(validateCreateOpportunity(form({ currencyCode: "SA" }), messages).currencyCode).toBe(
      "Three characters.",
    );
    // No catalogue check, because the server has none either.
    expect(
      validateCreateOpportunity(form({ currencyCode: "AAA" }), messages).currencyCode,
    ).toBeUndefined();
  });

  it("holds a required custom field open until it has a value", () => {
    expect(
      validateCreateOpportunity(form(), messages, ["budget"])["customFields.budget"],
    ).toBe("Required.");
    expect(
      validateCreateOpportunity(form({ customFields: { budget: 1 } }), messages, ["budget"]),
    ).toEqual({});
  });

  it("routes every error path to the section that renders it", () => {
    expect(sectionOfOpportunityError("customerProfileId")).toBe("placement");
    expect(sectionOfOpportunityError("stageId")).toBe("placement");
    expect(sectionOfOpportunityError("amount")).toBe("deal");
    expect(sectionOfOpportunityError("description")).toBe("notes");
    expect(sectionOfOpportunityError("customFields.budget")).toBe("customFields");
    expect(sectionOfOpportunityError("nonsense")).toBeNull();

    const errors = validateCreateOpportunity({ ...EMPTY_OPPORTUNITY_FORM }, messages);
    expect(opportunitySectionErrorCount(errors, "placement")).toBe(3);
    expect(opportunitySectionErrorCount(errors, "deal")).toBe(1);
    expect(opportunitySectionErrorCount(errors, "notes")).toBe(0);
  });
});

describe("buildCreateOpportunityRequest — custom fields", () => {
  it("sends only the values that carry something", () => {
    const request = buildCreateOpportunityRequest(
      form({ customFields: { budget: 5000, note: "  ", tags: [], won: false } }),
      BRANCH,
    );
    // `false` is a real BOOLEAN value; only absent, blank and empty are dropped.
    expect(request.customFields).toEqual({ budget: 5000, won: false });
  });

  it("omits the key entirely when nothing was filled in", () => {
    expect(buildCreateOpportunityRequest(form(), BRANCH)).not.toHaveProperty("customFields");
  });
});
