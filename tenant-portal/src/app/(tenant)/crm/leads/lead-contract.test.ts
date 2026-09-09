import { describe, expect, it } from "vitest";
import {
  leadCompanyContactsPath,
  leadCompanyOptionsPath,
  leadConvertPath,
  leadPath,
  parseLeadCompanyContactOptions,
  parseLeadCompanyOptions,
  parseLeadDetailResponse,
} from "./lead-contract";

const LEAD_ID = "01900100-0000-7000-8000-000000000001";
const BRANCH = "01900100-0000-7000-8000-000000000099";
const PARTY = "01900100-0000-7000-8000-000000000002";
const STAGE = "01900100-0000-7000-8000-000000000010";
const OWNER = "01900100-0000-7000-8000-000000000020";
const SOURCE = "01900100-0000-7000-8000-000000000030";
const RELATIONSHIP = "01900100-0000-7000-8000-000000000060";
const CONTACT_A = "01900100-0000-7000-8000-000000000070";
const CONTACT_B = "01900100-0000-7000-8000-000000000071";

const address = {
  addressType: "LEGAL",
  label: "Head office",
  country: "EG",
  city: "Cairo",
  area: "Maadi",
  street: "Road 9",
  buildingNo: "14",
  floor: "3",
  apartment: "12",
  landmark: "Beside the metro",
  postalCode: "11431",
};

const contacts = [
  {
    partyId: CONTACT_A,
    relationshipId: RELATIONSHIP,
    displayName: "Noura Saleh",
    firstName: "Noura",
    lastName: "Saleh",
    honorificTitle: "Eng.",
    jobTitle: "Procurement",
    isPrimary: true,
    email: "noura@acme.test",
    phones: ["+201000000000", 42],
  },
  {
    partyId: CONTACT_B,
    relationshipId: null,
    displayName: "Omar Fathy",
    isPrimary: false,
  },
];

const lead = {
  id: LEAD_ID,
  branchId: BRANCH,
  partyId: PARTY,
  leadProfileType: "CORPORATE",
  stageId: STAGE,
  stageFlag: "QUALIFYING",
  status: "OPEN",
  displayName: "Acme Trading",
  companyName: "Acme Trading LLC",
  primaryMobile: "+201001112223",
  email: "lead@acme.test",
  phones: ["+201001112223", 42],
  acquisitionSourceId: SOURCE,
  acquisitionSource: { nameAr: "الموقع", nameEn: "Website" },
  interestSummary: "Wants an ERP rollout",
  address,
  contacts,
  ownerUserId: OWNER,
  createdByUserId: OWNER,
  convertedAt: null,
  createdAt: "2026-06-24T15:00:00.000Z",
  updatedAt: "2026-06-24T15:15:00.000Z",
};

describe("lead detail contract", () => {
  it("reads the party-backed read model", () => {
    const parsed = parseLeadDetailResponse(lead);
    expect(parsed.displayName).toBe("Acme Trading");
    expect(parsed.companyName).toBe("Acme Trading LLC");
    expect(parsed.acquisitionSourceNameEn).toBe("Website");
    expect(parsed.status).toBe("OPEN");
    expect(parsed.stageFlag).toBe("QUALIFYING");
  });

  it("drops non-string entries from the phones array", () => {
    expect(parseLeadDetailResponse(lead).phones).toEqual(["+201001112223"]);
  });

  it("treats every optional reference as null rather than as invalid", () => {
    const bare = parseLeadDetailResponse({
      ...lead,
      ownerUserId: null,
      createdByUserId: null,
      acquisitionSourceId: null,
      acquisitionSource: null,
      companyName: null,
      email: null,
    });
    expect(bare.ownerUserId).toBeNull();
    expect(bare.acquisitionSourceNameAr).toBeNull();
    expect(bare.email).toBeNull();
  });

  it("rejects an unknown status, an unknown flag and a missing display name", () => {
    expect(() => parseLeadDetailResponse({ ...lead, status: "ARCHIVED" })).toThrow();
    expect(() => parseLeadDetailResponse({ ...lead, stageFlag: "WON" })).toThrow();
    expect(() => parseLeadDetailResponse({ ...lead, displayName: "" })).toThrow();
  });

  it("reads the primary address the detail response alone carries", () => {
    const parsed = parseLeadDetailResponse(lead);
    expect(parsed.address).toEqual({
      addressType: "LEGAL",
      label: "Head office",
      country: "EG",
      city: "Cairo",
      area: "Maadi",
      street: "Road 9",
      buildingNo: "14",
      floor: "3",
      apartment: "12",
      landmark: "Beside the metro",
      postalCode: "11431",
    });
  });

  it("reads an address with nothing but its type, every other column being nullable", () => {
    expect(
      parseLeadDetailResponse({ ...lead, address: { addressType: "SHIPPING" } }).address,
    ).toEqual({
      addressType: "SHIPPING",
      label: null,
      country: null,
      city: null,
      area: null,
      street: null,
      buildingNo: null,
      floor: null,
      apartment: null,
      landmark: null,
      postalCode: null,
    });
  });

  it("reads an address type this build has never heard of", () => {
    expect(
      parseLeadDetailResponse({ ...lead, address: { addressType: "WAREHOUSE" } }).address
        ?.addressType,
    ).toBe("WAREHOUSE");
  });

  it("answers null for an absent or malformed address instead of throwing", () => {
    // A party with no address on file, an older server that sends neither
    // field, and a shape this build did not expect all mean the same thing to
    // a detail screen: there is nothing to draw.
    expect(parseLeadDetailResponse({ ...lead, address: null }).address).toBeNull();
    expect(parseLeadDetailResponse({ ...lead, address: undefined }).address).toBeNull();
    expect(parseLeadDetailResponse({ ...lead, address: "Cairo" }).address).toBeNull();
    expect(parseLeadDetailResponse({ ...lead, address: [address] }).address).toBeNull();
    expect(parseLeadDetailResponse({ ...lead, address: { city: "Cairo" } }).address).toBeNull();
    expect(
      parseLeadDetailResponse({ ...lead, address: { addressType: "" } }).address,
    ).toBeNull();
  });

  it("reads the lead's own contacts and keeps the server's primary-first order", () => {
    const parsed = parseLeadDetailResponse(lead);
    expect(parsed.contacts).toHaveLength(2);
    expect(parsed.contacts[0]).toEqual({
      partyId: CONTACT_A,
      relationshipId: RELATIONSHIP,
      displayName: "Noura Saleh",
      firstName: "Noura",
      lastName: "Saleh",
      honorificTitle: "Eng.",
      jobTitle: "Procurement",
      isPrimary: true,
      email: "noura@acme.test",
      // The same non-string filter the top-level `phones` gets.
      phones: ["+201000000000"],
    });
    expect(parsed.contacts[1]).toEqual({
      partyId: CONTACT_B,
      // Nullable here and required on the company picker: a lead contact need
      // not be linked to an organization at all.
      relationshipId: null,
      displayName: "Omar Fathy",
      firstName: null,
      lastName: null,
      honorificTitle: null,
      jobTitle: null,
      isPrimary: false,
      email: null,
      phones: [],
    });
  });

  it("answers [] for an absent or malformed contacts array instead of throwing", () => {
    expect(parseLeadDetailResponse({ ...lead, contacts: [] }).contacts).toEqual([]);
    expect(parseLeadDetailResponse({ ...lead, contacts: undefined }).contacts).toEqual([]);
    expect(parseLeadDetailResponse({ ...lead, contacts: null }).contacts).toEqual([]);
    expect(parseLeadDetailResponse({ ...lead, contacts: { partyId: CONTACT_A } }).contacts).toEqual(
      [],
    );
  });

  it("drops one unusable contact rather than failing the whole response", () => {
    // Nine rendered rows tell the user more than a screen that renders none.
    const parsed = parseLeadDetailResponse({
      ...lead,
      contacts: [
        contacts[0],
        { relationshipId: RELATIONSHIP, displayName: "No party id", isPrimary: false },
        { partyId: "not-a-uuid", displayName: "Bad party id", isPrimary: false },
        { partyId: CONTACT_B, displayName: "", isPrimary: false },
        { partyId: CONTACT_B, isPrimary: false },
        "Omar Fathy",
        null,
      ],
    });
    expect(parsed.contacts.map((contact) => contact.partyId)).toEqual([CONTACT_A]);
  });

  it("truncates a contact list past the defensive read bound", () => {
    const many = Array.from({ length: 130 }, (_, index) => ({
      partyId: CONTACT_A,
      relationshipId: null,
      displayName: `Contact ${index}`,
      isPrimary: index === 0,
    }));
    const parsed = parseLeadDetailResponse({ ...lead, contacts: many });
    expect(parsed.contacts).toHaveLength(100);
    expect(parsed.contacts[99].displayName).toBe("Contact 99");
  });

  it("crowns nobody when the primary flag is not a boolean", () => {
    const parsed = parseLeadDetailResponse({
      ...lead,
      contacts: [{ partyId: CONTACT_A, displayName: "Noura Saleh", isPrimary: "yes" }],
    });
    expect(parsed.contacts[0].isPrimary).toBe(false);
  });

  it("builds the id-scoped paths and refuses a malformed id", () => {
    expect(leadPath(LEAD_ID)).toBe(`/api/tenant/crm/v1/leads/${LEAD_ID}`);
    expect(leadConvertPath(LEAD_ID)).toBe(`/api/tenant/crm/v1/leads/${LEAD_ID}/convert`);
    expect(() => leadPath("capabilities")).toThrow();
    expect(leadCompanyOptionsPath(BRANCH)).toContain(`branchId=${BRANCH}`);
    expect(leadCompanyContactsPath(PARTY, BRANCH)).toContain(
      `/company-options/${PARTY}/contacts`,
    );
  });
});

describe("corporate company options", () => {
  it("keeps an organization with no branch, which the query deliberately returns", () => {
    const [option] = parseLeadCompanyOptions([
      {
        id: PARTY,
        displayName: "Acme Trading",
        legalName: "Acme Trading LLC",
        organizationName: "Acme Trading LLC",
        branchId: null,
      },
    ]);
    expect(option.branchId).toBeNull();
    expect(option.legalName).toBe("Acme Trading LLC");
  });

  it("reads a contact on `partyId`, not `id`", () => {
    const [contact] = parseLeadCompanyContactOptions([
      {
        partyId: PARTY,
        relationshipId: RELATIONSHIP,
        displayName: "Noura Saleh",
        jobTitle: "Procurement",
        primaryEmail: "noura@acme.test",
        phones: ["+201000000000"],
        isPrimary: true,
      },
    ]);
    expect(contact.partyId).toBe(PARTY);
    expect(contact.relationshipId).toBe(RELATIONSHIP);
    expect(contact.phones).toEqual(["+201000000000"]);
  });

  it("rejects a contact row missing its relationship id", () => {
    expect(() =>
      parseLeadCompanyContactOptions([
        { partyId: PARTY, displayName: "Noura Saleh", isPrimary: true },
      ]),
    ).toThrow();
  });
});
