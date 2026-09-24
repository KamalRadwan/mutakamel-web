import { describe, expect, it } from "vitest";
import { customerProfileTextSearch } from "../customer-profile-search-contract";
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
const PARTY_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b6";
const CONTACT_PARTY_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b9";
const OWNER_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b7";
const TAG_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41ba";
const IMAGE_URL =
  "/api/tenant/core/v1/directory/parties/" + PARTY_ID + "/image?v=1789371508713";

function profileTags(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `0191e9a8-7f51-7b32-8d72-${index.toString(16).padStart(12, "0")}`,
    name: `Tag ${index + 1}`,
  }));
}

const profile = {
  id: PROFILE_ID,
  branchId: BRANCH_ID,
  partyId: PARTY_ID,
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
      partyId: PARTY_ID,
      displayName: "Acme Retail",
      profileType: "CORPORATE",
      status: "ACTIVE_CUSTOMER",
      companyName: "Acme Retail LLC",
      imageUrl: null,
      phone: "+201001112223",
      phones: ["+201001112223"],
      email: "info@acme.test",
      companyWebsite: null,
      country: "",
      city: "",
      primaryContactName: null,
      primaryContact: null,
      tags: [],
      ownerUserId: null,
      owner: null,
      nextActivity: null,
      acquisitionSourceNameAr: null,
      acquisitionSourceNameEn: null,
      sourceIconUrl: null,
      rating: 0,
      cardColor: null,
    });
  });

  it("retains a corporate primary contact and all rich fields after a local row update", () => {
    const parsed = parseCustomerProfileResponse({
      ...profile,
      party: { imageUrl: IMAGE_URL },
      address: { country: "Egypt", city: "Cairo" },
      companyWebsite: "https://acme.test/about",
      phones: ["+201001112223", "+201009998887"],
      tags: [{ id: TAG_ID, name: "Healthcare" }],
      ownerUserId: OWNER_ID,
      owner: {
        userId: OWNER_ID,
        firstName: "Kamal",
        lastName: "Radwan",
        avatarUrl:
          "/api/tenant/core/v1/directory/parties/" +
          CONTACT_PARTY_ID +
          "/image?v=1789371508714",
      },
      primaryContact: {
        partyId: CONTACT_PARTY_ID,
        displayName: "Mona Saleh",
        jobTitle: "Procurement Manager",
        email: "mona@acme.test",
        phones: ["+201055500000"],
        isPrimary: true,
      },
      rating: 2,
      cardColor: "TEAL",
    });

    const afterStatusUpdate = { ...parsed, status: "INACTIVE" as const };
    expect(afterStatusUpdate.primaryContact).toEqual({
      partyId: CONTACT_PARTY_ID,
      displayName: "Mona Saleh",
      jobTitle: "Procurement Manager",
      email: "mona@acme.test",
      phones: ["+201055500000"],
      isPrimary: true,
    });
    expect(afterStatusUpdate.primaryContactName).toBe("Mona Saleh");
    expect(afterStatusUpdate.phones).toEqual([
      "+201001112223",
      "+201009998887",
    ]);
    expect(afterStatusUpdate.country).toBe("Egypt");
    expect(afterStatusUpdate.city).toBe("Cairo");
    expect(afterStatusUpdate.imageUrl).toBe(IMAGE_URL);
    expect(afterStatusUpdate.companyWebsite).toBe("https://acme.test/about");
    expect(afterStatusUpdate.tags).toEqual([
      { id: TAG_ID, name: "Healthcare", backgroundColor: null, textColor: null },
    ]);
    expect(afterStatusUpdate.owner?.avatarUrl).toContain("/image?v=");
    expect(afterStatusUpdate.rating).toBe(2);
    expect(afterStatusUpdate.cardColor).toBe("TEAL");
  });

  it("accepts the lean Board primary-contact name without rich contact fields", () => {
    const parsed = parseCustomerProfileResponse({
      ...profile,
      primaryContactName: "Mona Saleh",
    });

    expect(parsed.primaryContactName).toBe("Mona Saleh");
    expect(parsed.primaryContact).toBeNull();
  });

  it("accepts more than one attach batch of tags up to the 500-tag catalogue limit", () => {
    expect(
      parseCustomerProfileResponse({ ...profile, tags: profileTags(51) }).tags,
    ).toHaveLength(51);
    expect(
      parseCustomerProfileResponse({ ...profile, tags: profileTags(500) }).tags,
    ).toHaveLength(500);
    expect(() =>
      parseCustomerProfileResponse({ ...profile, tags: profileTags(501) }),
    ).toThrow("Invalid CRM customer-profiles response.");
  });

  it("rejects untrusted party images and non-http company websites", () => {
    expect(() =>
      parseCustomerProfileResponse({
        ...profile,
        party: { imageUrl: "https://example.test/customer.png" },
      }),
    ).toThrow("Invalid CRM customer-profiles response.");
    expect(() =>
      parseCustomerProfileResponse({
        ...profile,
        companyWebsite: "javascript:alert(1)",
      }),
    ).toThrow("Invalid CRM customer-profiles response.");
  });

  it("rejects invalid customer card fields", () => {
    expect(() =>
      parseCustomerProfileResponse({ ...profile, rating: 4 }),
    ).toThrow("Invalid CRM customer-profiles response.");
    expect(() =>
      parseCustomerProfileResponse({ ...profile, cardColor: "MAUVE" }),
    ).toThrow("Invalid CRM customer-profiles response.");
  });

  it("parses the joined ownerUserId and acquisitionSource when present — docs/design/views.md's card-fields", () => {
    const withOwnerAndSource = {
      ...profile,
      ownerUserId: OWNER_ID,
      acquisitionSource: { id: "0191e9a8-7f51-7b32-8d72-19f9217a41b8", nameAr: "الإحالات", nameEn: "Referrals" },
    };
    const parsed = parseCustomerProfileResponse(withOwnerAndSource);
    expect(parsed.ownerUserId).toBe(OWNER_ID);
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
    // The query string itself belongs to `customer-profile-search-contract`
    // and is asserted key by key in its own test; what is checked here is that
    // this module puts it behind the path it owns.
    expect(
      buildCustomerProfilesListPath({
        branchId: BRANCH_ID,
        page: 2,
        search: customerProfileTextSearch("  Acme Retail  "),
      }),
    ).toBe(
      CUSTOMER_PROFILES_PATH +
        "?branchId=" +
        BRANCH_ID +
        "&page=2&limit=25&sortBy=createdAt&sortDir=DESC&search=Acme+Retail&searchField=customer",
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
