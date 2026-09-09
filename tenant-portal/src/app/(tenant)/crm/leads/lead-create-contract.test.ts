import { describe, expect, it } from "vitest";
import {
  buildCreateLeadRequest,
  emptyCreateLeadForm,
  emptyLeadContact,
  normalizeLeadPhone,
  usesExistingCompany,
  type CreateLeadForm,
} from "./lead-create-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const COMPANY_PARTY_ID = "01900100-0000-7000-8000-0000000000c1";
const CONTACT_PARTY_ID = "01900100-0000-7000-8000-0000000000c2";
const STAGE_ID = "01900100-0000-7000-8000-000000000010";

function corporate(overrides: Partial<CreateLeadForm> = {}): CreateLeadForm {
  const base = emptyCreateLeadForm("contact-1");
  return {
    ...base,
    // Stated, not inherited: a blank form opens on INDIVIDUAL, and a corporate
    // fixture that leaned on the default would silently become an individual
    // one the next time that default moves.
    leadProfileType: "CORPORATE",
    companyName: "  Acme Trading  ",
    contacts: [
      {
        ...emptyLeadContact("contact-1"),
        firstName: "  Dina  ",
        lastName: "  Ali  ",
        email: "  dina@example.com  ",
        phones: ["  +201001112223  ", ""],
      },
    ],
    ...overrides,
  };
}

describe("normalizeLeadPhone", () => {
  // Mirrors LeadsService.normalizeMobile — the two spellings below are the
  // same number to the server, which is what makes them a duplicate.
  it("collapses the spellings the server treats as one number", () => {
    expect(normalizeLeadPhone("00 966 537-8990")).toBe("+9665378990");
    expect(normalizeLeadPhone("+966 53 789 90")).toBe("+9665378990");
    expect(normalizeLeadPhone("0537 8990")).toBe("05378990");
  });
});

describe("buildCreateLeadRequest — corporate", () => {
  it("sends the company, its contacts and nothing the service would drop", () => {
    expect(buildCreateLeadRequest(corporate({ stageId: STAGE_ID }), BRANCH_ID)).toEqual({
      branchId: BRANCH_ID,
      leadProfileType: "CORPORATE",
      // Only the company name goes over the wire. The organization's display
      // name IS the lead's — `ensureParty` derives one from the other — so the
      // server composes both from this single field and they cannot disagree.
      companyName: "Acme Trading",
      stageId: STAGE_ID,
      contacts: [
        {
          firstName: "Dina", lastName: "Ali",
          isPrimary: true,
          email: "dina@example.com",
          phones: ["+201001112223"],
        },
      ],
    });
  });

  it("sends phones as an array only, never alongside the singular the array would shadow", () => {
    const request = buildCreateLeadRequest(
      corporate({ companyPhones: ["  0100 111 2223  ", "0111 222 3334"] }),
      BRANCH_ID,
    );
    expect(request.companyPhones).toEqual(["0100 111 2223", "0111 222 3334"]);
    expect(request).not.toHaveProperty("companyPhone");
    expect(request).not.toHaveProperty("primaryMobile");
  });

  it("marks exactly one contact primary, defaulting to the first row", () => {
    const request = buildCreateLeadRequest(
      corporate({
        contacts: [
          { ...emptyLeadContact("a"), firstName: "One", lastName: "", isPrimary: false },
          { ...emptyLeadContact("b"), firstName: "Two", lastName: "", isPrimary: true },
        ],
      }),
      BRANCH_ID,
    );
    expect(request.contacts?.map((contact) => contact.isPrimary)).toEqual([undefined, true]);
  });

  it("omits every field the service forbids alongside an existing company", () => {
    const request = buildCreateLeadRequest(
      corporate({
        existingCompanyPartyId: COMPANY_PARTY_ID,
        legalName: "Acme LLC",
        taxNumber: "123",
        commercialRegistrationNumber: "456",
        companyPhones: ["0100 111 2223"],
        address: { ...emptyCreateLeadForm("x").address, city: "Cairo" },
      }),
      BRANCH_ID,
    );
    // 422 LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN covers all six of these.
    expect(request.existingCompanyPartyId).toBe(COMPANY_PARTY_ID);
    expect(request).not.toHaveProperty("legalName");
    expect(request).not.toHaveProperty("taxNumber");
    expect(request).not.toHaveProperty("commercialRegistrationNumber");
    expect(request).not.toHaveProperty("companyPhones");
    expect(request).not.toHaveProperty("address");
  });

  it("sends only what the server still applies to a contact taken from the directory", () => {
    const request = buildCreateLeadRequest(
      corporate({
        existingCompanyPartyId: COMPANY_PARTY_ID,
        contacts: [
          {
            ...emptyLeadContact("a"),
            contactPartyId: CONTACT_PARTY_ID,
            firstName: "Dina", lastName: "Ali",
            jobTitle: "Head of Ops",
            email: "ignored@example.com",
            phones: ["0100 111 2223"],
          },
        ],
      }),
      BRANCH_ID,
    );
    // `ensureCorporateContactsBatch` builds no contact methods for a selected
    // party — email and phones there are discarded, so they are not sent. Nor
    // is the name: the directory already holds it, and this form cannot change
    // it.
    expect(request.contacts).toEqual([
      {
        isPrimary: true,
        jobTitle: "Head of Ops",
        contactPartyId: CONTACT_PARTY_ID,
      },
    ]);
  });
});

describe("buildCreateLeadRequest — individual", () => {
  const individual = (overrides: Partial<CreateLeadForm> = {}): CreateLeadForm => ({
    ...emptyCreateLeadForm("contact-1"),
    leadProfileType: "INDIVIDUAL",
    firstName: "  Sara  ",
    lastName: "  Nabil  ",
    email: "  sara@example.com  ",
    phones: ["  +201001112223  "],
    ...overrides,
  });

  it("sends the person's own identity and contact methods", () => {
    expect(buildCreateLeadRequest(individual(), BRANCH_ID)).toEqual({
      branchId: BRANCH_ID,
      leadProfileType: "INDIVIDUAL",
      firstName: "Sara",
      lastName: "Nabil",
      email: "sara@example.com",
      phones: ["+201001112223"],
    });
  });

  it("never sends a display name — CRM composes it from the name parts", () => {
    // `CreateLeadDto.displayName` is `@IsOptional()` and `LeadsService`
    // composes it, so sending one would let the list and the Directory
    // disagree about the same person's name.
    expect(buildCreateLeadRequest(individual(), BRANCH_ID)).not.toHaveProperty("displayName");
  });

  it("never sends a company, its contacts, or the registration trio", () => {
    const request = buildCreateLeadRequest(
      individual({ companyName: "Acme", legalName: "Acme LLC", taxNumber: "1" }),
      BRANCH_ID,
    );
    // The trio is 422 LEAD_CORPORATE_FIELDS_FORBIDDEN; the rest is silently
    // dropped by the service, which is just as wrong to send.
    expect(request).not.toHaveProperty("legalName");
    expect(request).not.toHaveProperty("taxNumber");
    expect(request).not.toHaveProperty("companyName");
    expect(request).not.toHaveProperty("contacts");
    expect(usesExistingCompany(individual({ existingCompanyPartyId: COMPANY_PARTY_ID }))).toBe(false);
  });
});

describe("buildCreateLeadRequest — address and custom fields", () => {
  it("sends the modern address spellings only, and nothing when every box is blank", () => {
    const blank = buildCreateLeadRequest(corporate(), BRANCH_ID);
    expect(blank).not.toHaveProperty("address");

    const filled = buildCreateLeadRequest(
      corporate({
        address: {
          ...emptyCreateLeadForm("x").address,
          city: " Cairo ",
          state: " Giza ",
          street1: " Nile St ",
          street2: " Apt 4 ",
        },
      }),
      BRANCH_ID,
    );
    expect(filled.address).toEqual({
      city: "Cairo",
      state: "Giza",
      street1: "Nile St",
      street2: "Apt 4",
    });
    // The legacy aliases would write the same three columns and lose.
    expect(filled.address).not.toHaveProperty("area");
    expect(filled.address).not.toHaveProperty("street");
    expect(filled.address).not.toHaveProperty("apartment");
  });

  it("drops empty custom-field values rather than sending them as blanks", () => {
    const request = buildCreateLeadRequest(
      corporate({
        customFields: { budget: 5000, note: "   ", tags: [], active: false, cleared: null },
      }),
      BRANCH_ID,
    );
    // `false` is a real BOOLEAN value; only absent, blank and empty are dropped.
    expect(request.customFields).toEqual({ budget: 5000, active: false });
  });
});

describe("emptyCreateLeadForm", () => {
  it("opens on the shape with the fewest mandatory fields", () => {
    // CORPORATE additionally requires a company name and one contact, both
    // 422s when missing. A blank form must not open already owing two answers.
    expect(emptyCreateLeadForm("contact-1").leadProfileType).toBe("INDIVIDUAL");
  });

  it("leaves the branch to the screen until the user picks one", () => {
    expect(emptyCreateLeadForm("contact-1").branchId).toBe("");
  });

  it("starts with no tags selected", () => {
    expect(emptyCreateLeadForm("contact-1").tagIds).toEqual([]);
  });
});

describe("buildCreateLeadRequest — branch", () => {
  const OTHER_BRANCH_ID = "01900100-0000-7000-8000-000000000098";

  it("files against the screen's branch when the form names none", () => {
    expect(buildCreateLeadRequest(corporate(), BRANCH_ID).branchId).toBe(BRANCH_ID);
  });

  it("lets a branch picked in the form win over the screen's", () => {
    const request = buildCreateLeadRequest(
      corporate({ branchId: OTHER_BRANCH_ID }),
      BRANCH_ID,
    );
    expect(request.branchId).toBe(OTHER_BRANCH_ID);
  });

  it("never sends a company key, because `CreateLeadDto` has none", () => {
    // `forbidNonWhitelisted` makes an invented key a 400, and the company the
    // picker narrows by is derived server-side from `branchId`.
    const request = buildCreateLeadRequest(corporate({ branchId: OTHER_BRANCH_ID }), BRANCH_ID);
    expect(request).not.toHaveProperty("companyId");
    expect(request).not.toHaveProperty("company");
  });

  it("sends every selected tag in the atomic create request", () => {
    const secondTag = "01900100-0000-7000-8000-0000000000d2";
    const request = buildCreateLeadRequest(
      corporate({
        tagIds: ["01900100-0000-7000-8000-0000000000d1", secondTag],
      }),
      BRANCH_ID,
    );
    expect(request.tagIds).toEqual([
      "01900100-0000-7000-8000-0000000000d1",
      secondTag,
    ]);
  });

  it("omits the optional tag array when the selection is empty", () => {
    expect(buildCreateLeadRequest(corporate(), BRANCH_ID)).not.toHaveProperty("tagIds");
  });
});
