import { describe, expect, it } from "vitest";
import {
  parseAddContactResponse,
  parseCustomerProfileDetailResponse,
} from "./customer-profile-contract";
import {
  buildAddCustomerContactRequest,
  buildCreateCustomerProfileRequest,
  buildUpdateCustomerProfileRequest,
  toCustomerProfileForm,
  type CustomerProfileForm,
} from "./customer-profile-write-contract";

const ID = "01900100-0000-7000-8000-000000000040";
const BRANCH = "01900100-0000-7000-8000-000000000099";
const PARTY = "01900100-0000-7000-8000-000000000002";
const OWNER = "01900100-0000-7000-8000-000000000020";
const SOURCE = "01900100-0000-7000-8000-000000000030";
const LEAD = "01900100-0000-7000-8000-000000000001";
const RELATIONSHIP = "01900100-0000-7000-8000-000000000060";

const profile = {
  id: ID,
  branchId: BRANCH,
  partyId: PARTY,
  profileType: "CORPORATE",
  status: "PROSPECT",
  displayName: "Acme Retail",
  companyName: "Acme Retail LLC",
  companyEmail: "info@acme.test",
  companyPhone: "+201001112223",
  companyWebsite: "https://acme.test",
  email: "info@acme.test",
  primaryMobile: null,
  phones: ["+201001112223"],
  description: "Key account",
  ownerUserId: OWNER,
  sourceLeadId: LEAD,
  acquisitionSourceId: SOURCE,
  acquisitionSource: { nameAr: "الموقع", nameEn: "Website" },
  party: {
    id: PARTY,
    partyType: "ORGANIZATION",
    displayName: "Acme Retail",
    legalName: "Acme Retail LLC",
    taxNumber: "TAX-12345",
    commercialRegistrationNumber: "CR-67890",
  },
  createdAt: "2026-06-24T15:00:00.000Z",
  updatedAt: "2026-06-24T15:15:00.000Z",
};

describe("customer profile detail contract", () => {
  it("reads the registration identifiers off the joined party, not the profile row", () => {
    const parsed = parseCustomerProfileDetailResponse(profile);
    expect(parsed.taxNumber).toBe("TAX-12345");
    expect(parsed.commercialRegistrationNumber).toBe("CR-67890");
    expect(parsed.legalName).toBe("Acme Retail LLC");
  });

  it("tolerates a response with no party join", () => {
    const parsed = parseCustomerProfileDetailResponse({ ...profile, party: undefined });
    expect(parsed.taxNumber).toBeNull();
    expect(parsed.displayName).toBe("Acme Retail");
  });

  it("rejects an unknown status and a missing display name", () => {
    expect(() =>
      parseCustomerProfileDetailResponse({ ...profile, status: "ARCHIVED" }),
    ).toThrow();
    expect(() =>
      parseCustomerProfileDetailResponse({ ...profile, displayName: "" }),
    ).toThrow();
  });

  it("reads the add-contact 201, which carries only the relationship id", () => {
    expect(parseAddContactResponse({ id: RELATIONSHIP })).toBe(RELATIONSHIP);
    expect(() => parseAddContactResponse({})).toThrow();
  });
});

const form: CustomerProfileForm = {
  profileType: "CORPORATE",
  displayName: "Acme Retail",
  status: "PROSPECT",
  companyName: "Acme Retail LLC",
  companyEmail: "info@acme.test",
  companyPhone: "+201001112223",
  companyWebsite: "https://acme.test",
  taxNumber: "TAX-12345",
  commercialRegistrationNumber: "CR-67890",
  description: "Key account",
  acquisitionSourceId: SOURCE,
};

describe("customer profile write payloads", () => {
  it("builds the create body with the corporate block", () => {
    expect(buildCreateCustomerProfileRequest(form, BRANCH)).toEqual({
      branchId: BRANCH,
      profileType: "CORPORATE",
      displayName: "Acme Retail",
      status: "PROSPECT",
      description: "Key account",
      acquisitionSourceId: SOURCE,
      companyName: "Acme Retail LLC",
      companyEmail: "info@acme.test",
      companyPhone: "+201001112223",
      companyWebsite: "https://acme.test",
      taxNumber: "TAX-12345",
      commercialRegistrationNumber: "CR-67890",
    });
  });

  it("omits every corporate key on an individual profile", () => {
    // `assertCorporateOnlyFields` rejects all of them there.
    const payload = buildCreateCustomerProfileRequest(
      { ...form, profileType: "INDIVIDUAL" },
      BRANCH,
    );
    expect(payload).not.toHaveProperty("companyName");
    expect(payload).not.toHaveProperty("taxNumber");
    expect(payload).not.toHaveProperty("commercialRegistrationNumber");
  });

  it("sends the canonical alias only, never both", () => {
    const payload = buildCreateCustomerProfileRequest(form, BRANCH);
    // The service resolves `taxNumber ?? taxCardNumber`, so the legacy alias
    // adds nothing and would be a second key for the same value.
    expect(payload).not.toHaveProperty("taxCardNumber");
    expect(payload).not.toHaveProperty("commercialRegisterNumber");
  });

  it("patches only the changed keys and never the profile type", () => {
    const baseline = { ...form };
    expect(buildUpdateCustomerProfileRequest(baseline, baseline)).toEqual({});
    const changed = buildUpdateCustomerProfileRequest(
      { ...baseline, status: "ACTIVE_CUSTOMER", companyPhone: "+201009998887" },
      baseline,
    );
    expect(changed).toEqual({
      status: "ACTIVE_CUSTOMER",
      companyPhone: "+201009998887",
    });
    expect(changed).not.toHaveProperty("profileType");
  });

  it("clears the acquisition source with an explicit null", () => {
    const baseline = { ...form };
    expect(
      buildUpdateCustomerProfileRequest({ ...baseline, acquisitionSourceId: "" }, baseline),
    ).toEqual({ acquisitionSourceId: null });
  });

  it("omits an emptied company name rather than sending an empty string", () => {
    const baseline = { ...form };
    expect(
      buildUpdateCustomerProfileRequest({ ...baseline, companyName: "" }, baseline),
    ).toEqual({});
  });

  it("round-trips the detail record through the form", () => {
    const parsed = parseCustomerProfileDetailResponse(profile);
    expect(toCustomerProfileForm(parsed)).toEqual(form);
  });

  it("sends a contact phone as `phones`, the only key the DTO has", () => {
    expect(
      buildAddCustomerContactRequest({
        honorificTitle: "Ms",
        firstName: "  Noura ",
        lastName: " Saleh ",
        jobTitle: "Procurement",
        email: "noura@acme.test",
        phone: "+201000000000",
      }),
    ).toEqual({
      firstName: "Noura",
      lastName: "Saleh",
      honorificTitle: "Ms",
      jobTitle: "Procurement",
      email: "noura@acme.test",
      phones: ["+201000000000"],
    });
  });

  it("never sends a name the service is meant to compose", () => {
    // `CustomerProfileContactPersonDto.fullName` is optional and the service
    // builds it from the parts below; sending one here would let this dialog
    // and the Directory disagree about the same person's name.
    expect(
      buildAddCustomerContactRequest({
        honorificTitle: "Ms",
        firstName: "Noura",
        lastName: "Saleh",
        jobTitle: "",
        email: "",
        phone: "",
      }),
    ).not.toHaveProperty("fullName");
  });

  it("omits every blank contact field", () => {
    expect(
      buildAddCustomerContactRequest({
        honorificTitle: "",
        firstName: "Noura",
        lastName: "",
        jobTitle: "",
        email: "",
        phone: "",
      }),
    ).toEqual({ firstName: "Noura" });
  });
});
