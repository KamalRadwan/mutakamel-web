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
