import { describe, expect, it } from "vitest";
import {
  CUSTOMER_PROFILES_PAGE_SIZE,
  CUSTOMER_PROFILES_PATH,
  buildCustomerProfilesListPath,
  customerProfilePath,
  parseCustomerProfileResponse,
  parseCustomerProfilesPageResponse,
  resolveCustomerProfilesBranchId,
} from "./useCustomerProfiles";

const PROFILE_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b3";
const BRANCH_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b4";
const OTHER_BRANCH_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b5";

const profile = {
  id: PROFILE_ID,
  branchId: BRANCH_ID,
  partyId: "0191e9a8-7f51-7b32-8d72-19f9217a41b6",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  displayName: "Acme Retail",
  companyName: "Acme Retail LLC",
  primaryMobile: null,
  companyPhone: "+201001112223",
  email: "info@acme.test",
  companyEmail: "info@acme.test",
  createdAt: "2026-08-25T10:00:00.000Z",
  additiveProjectionField: { accepted: true },
};

const rawPage = {
  items: [profile],
  total: 26,
  page: 1,
  limit: CUSTOMER_PROFILES_PAGE_SIZE,
  totalPages: 2,
  hasNext: true,
  hasPrev: false,
};

describe("CRM customer-profile contract", () => {
  it("parses a raw entity projection while tolerating additive fields", () => {
    expect(parseCustomerProfileResponse(profile)).toEqual({
      id: PROFILE_ID,
      branchId: BRANCH_ID,
      displayName: "Acme Retail",
      profileType: "CORPORATE",
      status: "ACTIVE_CUSTOMER",
      companyName: "Acme Retail LLC",
      phone: "+201001112223",
      email: "info@acme.test",
      ownerUserId: null,
      acquisitionSourceNameAr: null,
      acquisitionSourceNameEn: null,
    });
  });

  it("parses the joined ownerUserId and acquisitionSource when present — docs/design/views.md's card-fields", () => {
    const withOwnerAndSource = {
      ...profile,
      ownerUserId: "0191e9a8-7f51-7b32-8d72-19f9217a41b7",
      acquisitionSource: { id: "0191e9a8-7f51-7b32-8d72-19f9217a41b8", nameAr: "الإحالات", nameEn: "Referrals" },
    };
    const parsed = parseCustomerProfileResponse(withOwnerAndSource);
    expect(parsed.ownerUserId).toBe("0191e9a8-7f51-7b32-8d72-19f9217a41b7");
    expect(parsed.acquisitionSourceNameAr).toBe("الإحالات");
    expect(parsed.acquisitionSourceNameEn).toBe("Referrals");
  });

  it("parses the raw page and preserves authoritative pagination", () => {
    expect(parseCustomerProfilesPageResponse(rawPage, BRANCH_ID)).toEqual({
      items: [parseCustomerProfileResponse(profile)],
      total: 26,
      page: 1,
      limit: 25,
      totalPages: 2,
      hasNext: true,
      hasPrev: false,
    });
  });

  it("rejects fabricated success envelopes for entity and page responses", () => {
    expect(() =>
      parseCustomerProfileResponse({ success: true, data: profile }),
    ).toThrow("Invalid CRM customer-profiles response.");
    expect(() =>
      parseCustomerProfilesPageResponse({ success: true, data: rawPage }),
    ).toThrow("Invalid CRM customer-profiles response.");
  });

  it("rejects inconsistent pagination, enum values, and branch leakage", () => {
    expect(() =>
      parseCustomerProfilesPageResponse({ ...rawPage, totalPages: 1 }),
    ).toThrow("Invalid CRM customer-profiles response.");
    expect(() =>
      parseCustomerProfilesPageResponse({ ...rawPage, hasNext: false }),
    ).toThrow("Invalid CRM customer-profiles response.");
    expect(() =>
      parseCustomerProfileResponse({ ...profile, status: "active" }),
    ).toThrow("Invalid CRM customer-profiles response.");
    expect(() =>
      parseCustomerProfilesPageResponse(rawPage, OTHER_BRANCH_ID),
    ).toThrow("Invalid CRM customer-profiles response.");
  });

  it("builds the canonical bounded server-search request", () => {
    expect(
      buildCustomerProfilesListPath({
        branchId: BRANCH_ID,
        page: 2,
        search: "  Acme Retail  ",
      }),
    ).toBe(
      CUSTOMER_PROFILES_PATH +
        "?branchId=" +
        BRANCH_ID +
        "&page=2&limit=25&sortBy=createdAt&sortDir=DESC&search=Acme+Retail",
    );
    expect(customerProfilePath(PROFILE_ID)).toBe(
      CUSTOMER_PROFILES_PATH + "/" + PROFILE_ID,
    );
  });

  it("uses one unique primary branch, then only a sole accessible branch", () => {
    expect(
      resolveCustomerProfilesBranchId({
        accessibleBranches: [BRANCH_ID, OTHER_BRANCH_ID],
        teamMemberships: [
          { branchId: OTHER_BRANCH_ID, isPrimary: true },
        ],
      }),
    ).toBe(OTHER_BRANCH_ID);
    expect(
      resolveCustomerProfilesBranchId({
        accessibleBranches: [BRANCH_ID],
        teamMemberships: [],
      }),
    ).toBe(BRANCH_ID);
    expect(
      resolveCustomerProfilesBranchId({
        accessibleBranches: [BRANCH_ID, OTHER_BRANCH_ID],
        teamMemberships: [],
      }),
    ).toBeNull();
    expect(
      resolveCustomerProfilesBranchId({
        accessibleBranches: [BRANCH_ID, OTHER_BRANCH_ID],
        teamMemberships: [
          { branchId: BRANCH_ID, isPrimary: true },
          { branchId: OTHER_BRANCH_ID, isPrimary: true },
        ],
      }),
    ).toBeNull();
  });
});
