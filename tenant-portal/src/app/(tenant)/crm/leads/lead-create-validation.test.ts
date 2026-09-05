import { describe, expect, it } from "vitest";
import {
  emptyCreateLeadForm,
  emptyLeadContact,
  type CreateLeadForm,
} from "./lead-create-contract";
import {
  leadCreateSectionErrorCount,
  sectionOfLeadCreateError,
  validateCreateLead,
  type LeadCreateMessages,
} from "./lead-create-validation";

const messages: LeadCreateMessages = {
  required: "Required.",
  email: "Bad email.",
  maxLength: "At most {max} characters.",
  duplicatePhone: "Already listed.",
  url: "Bad URL.",
  contactRequired: "Add a contact.",
};

const SOURCE_ID = "01900100-0000-7000-8000-0000000000a1";

// CORPORATE is stated rather than inherited: a blank form now opens on
// INDIVIDUAL, and the corporate cases below would quietly stop testing one.
function form(overrides: Partial<CreateLeadForm> = {}): CreateLeadForm {
  return {
    ...emptyCreateLeadForm("contact-1"),
    leadProfileType: "CORPORATE",
    acquisitionSourceId: SOURCE_ID,
    ...overrides,
  };
}

describe("validateCreateLead — corporate", () => {
  it("requires the company name and the first contact's name", () => {
    const errors = validateCreateLead(form(), messages);
    // 422 LEAD_COMPANY_NAME_REQUIRED and the contact DTO's @IsNotEmpty.
    expect(errors.companyName).toBe("Required.");
    expect(errors["contacts.0.fullName"]).toBe("Required.");
  });

  it("accepts a corporate lead whose company came from the directory", () => {
    const errors = validateCreateLead(
      form({
        existingCompanyPartyId: "01900100-0000-7000-8000-0000000000c1",
        companyName: "Acme Trading",
        contacts: [{ ...emptyLeadContact("a"), contactPartyId: "x", fullName: "Dina" }],
      }),
      messages,
    );
    expect(errors).toEqual({});
  });

  it("does not validate the fields hidden behind an existing company", () => {
    const errors = validateCreateLead(
      form({
        existingCompanyPartyId: "01900100-0000-7000-8000-0000000000c1",
        companyName: "Acme",
        legalName: "x".repeat(500),
        companyPhones: ["1", "1"],
        contacts: [{ ...emptyLeadContact("a"), fullName: "Dina" }],
      }),
      messages,
    );
    // Those boxes are not on screen there; an error on one would be unreachable.
    expect(errors).toEqual({});
  });

  it("rejects a phone repeated in the same list, however it is spelled", () => {
    const errors = validateCreateLead(
      form({
        companyName: "Acme",
        companyPhones: ["00966537 8990", "+966 5378990"],
        contacts: [{ ...emptyLeadContact("a"), fullName: "Dina" }],
      }),
      messages,
    );
    // PARTY_DUPLICATE_CONTACT_METHOD compares normalised numbers, and the flag
    // lands on the later row — the one just typed.
    expect(errors["companyPhones.0"]).toBeUndefined();
    expect(errors["companyPhones.1"]).toBe("Already listed.");
  });

  it("skips the discarded boxes on a contact taken from the directory", () => {
    const errors = validateCreateLead(
      form({
        companyName: "Acme",
        contacts: [
          {
            ...emptyLeadContact("a"),
            contactPartyId: "x",
            fullName: "Dina",
            email: "not-an-email",
          },
        ],
      }),
      messages,
    );
    expect(errors["contacts.0.email"]).toBeUndefined();
  });
});

describe("validateCreateLead — individual", () => {
  const individual = (overrides: Partial<CreateLeadForm> = {}) =>
    validateCreateLead(
      form({ leadProfileType: "INDIVIDUAL", displayName: "Sara", ...overrides }),
      messages,
    );

  it("requires a display name and checks the email shape", () => {
    expect(individual({ displayName: "" }).displayName).toBe("Required.");
    expect(individual({ email: "sara@" }).email).toBe("Bad email.");
    expect(individual({ email: "sara@example.com" }).email).toBeUndefined();
  });

  it("ignores the company fields it does not render", () => {
    expect(individual({ companyName: "" })).toEqual({});
  });

  it("reports the DTO's own length ceiling with the number in it", () => {
    expect(individual({ displayName: "x".repeat(181) }).displayName).toBe(
      "At most 180 characters.",
    );
  });
});

describe("validateCreateLead — acquisition source", () => {
  // The one rule here that is NOT a mirror: `CreateLeadDto` marks
  // `acquisitionSourceId` `@IsOptional()`, so this is the form's rule and not
  // the server's. Pinned so that nobody "fixes" it back to match the DTO
  // without meeting the reason first.
  it("refuses a lead with no source, on both profile types", () => {
    expect(validateCreateLead(form({ acquisitionSourceId: "" }), messages).acquisitionSourceId)
      .toBe("Required.");
    expect(
      validateCreateLead(
        form({ leadProfileType: "INDIVIDUAL", displayName: "Sara", acquisitionSourceId: "" }),
        messages,
      ).acquisitionSourceId,
    ).toBe("Required.");
  });

  it("accepts any source the picker can offer", () => {
    expect(
      validateCreateLead(
        form({ leadProfileType: "INDIVIDUAL", displayName: "Sara" }),
        messages,
      ).acquisitionSourceId,
    ).toBeUndefined();
  });
});

describe("required custom fields", () => {
  it("blocks a submit that CUSTOM_FIELD_REQUIRED would reject", () => {
    const base = form({
      companyName: "Acme",
      contacts: [{ ...emptyLeadContact("a"), fullName: "Dina" }],
    });
    expect(validateCreateLead(base, messages, ["budget"])["customFields.budget"]).toBe(
      "Required.",
    );
    expect(
      validateCreateLead({ ...base, customFields: { budget: 0 } }, messages, ["budget"]),
    ).toEqual({});
  });
});

describe("section index", () => {
  it("routes every error path to the section that renders it", () => {
    expect(sectionOfLeadCreateError("acquisitionSourceId")).toBe("classification");
    expect(sectionOfLeadCreateError("companyName")).toBe("company");
    expect(sectionOfLeadCreateError("companyPhones.1")).toBe("company");
    expect(sectionOfLeadCreateError("contacts.2.email")).toBe("contacts");
    expect(sectionOfLeadCreateError("address.city")).toBe("address");
    expect(sectionOfLeadCreateError("customFields.budget")).toBe("customFields");
    expect(sectionOfLeadCreateError("phones.0")).toBe("person");
    expect(sectionOfLeadCreateError("nonsense")).toBeNull();
  });

  it("counts a section's errors so the index can flag one scrolled out of view", () => {
    const errors = validateCreateLead(form({ acquisitionSourceId: "" }), messages);
    expect(leadCreateSectionErrorCount(errors, "classification")).toBe(1);
    expect(leadCreateSectionErrorCount(errors, "company")).toBe(1);
    expect(leadCreateSectionErrorCount(errors, "contacts")).toBe(1);
    expect(leadCreateSectionErrorCount(errors, "address")).toBe(0);
  });
});
