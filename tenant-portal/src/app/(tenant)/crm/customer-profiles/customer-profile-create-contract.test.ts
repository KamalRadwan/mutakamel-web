import { describe, expect, it } from "vitest";
import {
  buildCreateCustomerProfileFullRequest,
  emptyCreateCustomerProfileForm,
  emptyCustomerContactRow,
  type CreateCustomerProfileForm,
} from "./customer-profile-create-contract";
import {
  customerProfileSectionErrorCount,
  sectionOfCustomerProfileError,
  validateCreateCustomerProfile,
  type CustomerProfileCreateMessages,
} from "./customer-profile-create-validation";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";

const messages: CustomerProfileCreateMessages = {
  required: "Required.",
  email: "Bad email.",
  maxLength: "At most {max} characters.",
  duplicatePhone: "Already listed.",
  url: "Bad URL.",
};

function form(overrides: Partial<CreateCustomerProfileForm> = {}): CreateCustomerProfileForm {
  return { ...emptyCreateCustomerProfileForm("row-1"), companyName: "Acme", ...overrides };
}

describe("buildCreateCustomerProfileFullRequest — corporate", () => {
  it("sends the company block and never an address, which the DTO has no key for", () => {
    const request = buildCreateCustomerProfileFullRequest(
      form({
        companyName: "  Acme Trading  ",
        taxNumber: " 123 ",
        companyWebsite: " https://acme.example ",
      }),
      BRANCH_ID,
    );
    expect(request).toMatchObject({
      branchId: BRANCH_ID,
      profileType: "CORPORATE",
      status: "PROSPECT",
      companyName: "Acme Trading",
      taxNumber: "123",
      companyWebsite: "https://acme.example",
    });
    expect(request).not.toHaveProperty("address");
    // Both legacy aliases collapse onto the modern column and would silently lose.
    expect(request).not.toHaveProperty("taxCardNumber");
    // The name is CRM's to compose from `companyName`; typing it twice was the
    // whole reason this key left the form.
    expect(request).not.toHaveProperty("displayName");
    expect(request).not.toHaveProperty("commercialRegisterNumber");
  });

  it("sends companyPhones alone, never beside the singular that would be wiped", () => {
    const request = buildCreateCustomerProfileFullRequest(
      form({ companyPhones: [" 0100 111 2223 ", "", "0111 222 3334"] }),
      BRANCH_ID,
    );
    expect(request.companyPhones).toEqual(["0100 111 2223", "0111 222 3334"]);
    // `synchronizePhoneNumbers` replaces the whole PHONE set from the array
    // afterwards, so a `companyPhone` sent beside it would be soft-deleted.
    expect(request).not.toHaveProperty("companyPhone");
  });

  it("drops contact rows with no name and marks exactly one primary", () => {
    const request = buildCreateCustomerProfileFullRequest(
      form({
        contacts: [
          { ...emptyCustomerContactRow("a"), fullName: "", isPrimary: true },
          { ...emptyCustomerContactRow("b"), fullName: "Dina Ali", isPrimary: false },
          { ...emptyCustomerContactRow("c"), fullName: "Omar Nabil", isPrimary: false },
        ],
      }),
      BRANCH_ID,
    );
    expect(request.contacts).toEqual([
      { fullName: "Dina Ali", isPrimary: true },
      { fullName: "Omar Nabil" },
    ]);
  });

  it("omits contacts entirely when no row was filled in", () => {
    const request = buildCreateCustomerProfileFullRequest(form(), BRANCH_ID);
    // `contacts: []` would ALSO discard `primaryContact` server-side, so an
    // empty list is never sent.
    expect(request).not.toHaveProperty("contacts");
    expect(request).not.toHaveProperty("primaryContact");
  });
});

describe("buildCreateCustomerProfileFullRequest — individual", () => {
  const individual = (overrides: Partial<CreateCustomerProfileForm> = {}) =>
    buildCreateCustomerProfileFullRequest(
      form({ profileType: "INDIVIDUAL", companyName: "", ...overrides }),
      BRANCH_ID,
    );

  it("routes the person's identity and contact methods through primaryContact", () => {
    const request = individual({
      firstName: " Sara ",
      lastName: " Nabil ",
      email: " sara@example.com ",
      phones: [" +201001112223 "],
    });
    // The DTO has no top-level email or phones, and no `fullName` either: CRM
    // builds the person's name from these parts and reuses it as the profile's
    // display name.
    expect(request).not.toHaveProperty("displayName");
    expect(request.primaryContact).toEqual({
      firstName: "Sara",
      lastName: "Nabil",
      email: "sara@example.com",
      phones: ["+201001112223"],
    });
    expect(request).not.toHaveProperty("email");
    expect(request).not.toHaveProperty("phones");
  });

  it("never sends a company key, each of which is a 422 here", () => {
    const request = individual({
      companyName: "Acme",
      taxNumber: "1",
      companyEmail: "a@b.co",
      companyWebsite: "https://acme.example",
      companyPhones: ["0100"],
      contacts: [{ ...emptyCustomerContactRow("a"), fullName: "Dina" }],
    });
    for (const key of [
      "companyName",
      "taxNumber",
      "commercialRegistrationNumber",
      "companyEmail",
      "companyWebsite",
      "companyPhones",
      "contacts",
    ]) {
      expect(request).not.toHaveProperty(key);
    }
  });
});

describe("validateCreateCustomerProfile", () => {
  // The form no longer asks for a display name, so what it must have is the
  // identity CRM composes that name from — one required field per profile type.
  it("requires the company name on a corporate profile", () => {
    expect(
      validateCreateCustomerProfile(form({ companyName: "" }), messages).companyName,
    ).toBe("Required.");
    expect(validateCreateCustomerProfile(form(), messages)).toEqual({});
  });

  it("requires the first name on an individual profile", () => {
    const individual = form({ profileType: "INDIVIDUAL", companyName: "" });
    expect(validateCreateCustomerProfile(individual, messages).firstName).toBe(
      "Required.",
    );
    expect(
      validateCreateCustomerProfile({ ...individual, firstName: "Sara" }, messages),
    ).toEqual({});
  });

  it("rejects a website with no protocol, which @IsUrl requires", () => {
    expect(
      validateCreateCustomerProfile(form({ companyWebsite: "acme.example" }), messages)
        .companyWebsite,
    ).toBe("Bad URL.");
    expect(
      validateCreateCustomerProfile(form({ companyWebsite: "https://acme.example" }), messages)
        .companyWebsite,
    ).toBeUndefined();
  });

  it("flags a contact row that carries data but no name", () => {
    const errors = validateCreateCustomerProfile(
      form({
        contacts: [{ ...emptyCustomerContactRow("a"), email: "dina@example.com" }],
      }),
      messages,
    );
    // The builder drops nameless rows, so without this the email would vanish.
    expect(errors["contacts.0.fullName"]).toBe("Required.");
  });

  it("leaves an entirely empty contact row alone", () => {
    expect(validateCreateCustomerProfile(form(), messages)).toEqual({});
  });

  it("does not check the company fields it does not render on an individual", () => {
    const errors = validateCreateCustomerProfile(
      form({
        profileType: "INDIVIDUAL",
        firstName: "Sara",
        companyWebsite: "nonsense",
        companyEmail: "nope",
      }),
      messages,
    );
    expect(errors).toEqual({});
  });

  it("holds a required custom field open until it has a value", () => {
    expect(
      validateCreateCustomerProfile(form(), messages, ["segment"])["customFields.segment"],
    ).toBe("Required.");
    expect(
      validateCreateCustomerProfile(
        form({ customFields: { segment: "enterprise" } }),
        messages,
        ["segment"],
      ),
    ).toEqual({});
  });

  it("routes every error path to the section that renders it", () => {
    expect(sectionOfCustomerProfileError("companyName")).toBe("company");
    expect(sectionOfCustomerProfileError("companyWebsite")).toBe("company");
    expect(sectionOfCustomerProfileError("contacts.1.email")).toBe("contacts");
    expect(sectionOfCustomerProfileError("phones.0")).toBe("person");
    expect(sectionOfCustomerProfileError("description")).toBe("notes");
    expect(sectionOfCustomerProfileError("customFields.segment")).toBe("customFields");

    const errors = validateCreateCustomerProfile(form({ companyName: "" }), messages);
    expect(customerProfileSectionErrorCount(errors, "company")).toBe(1);
    expect(customerProfileSectionErrorCount(errors, "classification")).toBe(0);
  });
});
