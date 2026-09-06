import { describe, expect, it } from "vitest";
import {
  capabilityAllowsOwner,
  parseLeadResponse,
  parseLeadCapabilitiesResponse,
  parseLeadStagesResponse,
  parseLeadsResponse,
} from "./useLeads";

const lead = {
  id: "01900100-0000-7000-8000-000000000001",
  branchId: "01900100-0000-7000-8000-000000000099",
  displayName: "Acme Trading",
  companyName: "Acme Trading",
  email: "owner@example.com",
  companyPhone: "+201001112223",
  stageId: "01900100-0000-7000-8000-000000000010",
  ownerUserId: "01900100-0000-7000-8000-000000000020",
  acquisitionSource: {
    nameAr: "إحالة",
    nameEn: "Referral",
  },
};

// The four board-card fields, kept OFF the base row on purpose: `lead` above
// stands in for a response from a crm-app that has not shipped them yet, which
// is the case the parser's defaults exist for.
const cardFields = {
  rating: 2,
  cardColor: "TEAL",
  owner: {
    userId: "01900100-0000-7000-8000-000000000020",
    firstName: "Kamal",
    lastName: "Radwan",
  },
  nextActivity: { activityAt: "2026-09-05T09:00:00.000Z", bucket: "OVERDUE" },
  tags: [{ id: "01900100-0000-7000-8000-0000000000a1", name: "VIP", color: "RED" }],
};

describe("Leads API contracts", () => {
  it("reads canonical raw list and mutation payloads", () => {
    expect(parseLeadsResponse({
      items: [lead],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    }, lead.branchId)).toEqual({
      items: [
        {
          id: lead.id,
          leadName: "Acme Trading",
          company: "Acme Trading",
          email: "owner@example.com",
          phone: "+201001112223",
          sourceNameAr: "إحالة",
          sourceNameEn: "Referral",
          stageId: lead.stageId,
          ownerUserId: lead.ownerUserId,
          rating: 0,
          cardColor: null,
          owner: null,
          nextActivity: null,
          primaryContactName: "",
          tags: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(parseLeadResponse(lead, lead.branchId).id).toBe(lead.id);
  });

  it("reads the board-card fields, and defaults the ones a row omits", () => {
    expect(parseLeadResponse({ ...lead, ...cardFields }, lead.branchId)).toMatchObject({
      rating: 2,
      cardColor: "TEAL",
      owner: { userId: cardFields.owner.userId, firstName: "Kamal", lastName: "Radwan" },
      nextActivity: { activityAt: cardFields.nextActivity.activityAt, bucket: "OVERDUE" },
      // Mocked: crm-app is still adding `tags` to the list read model, so the
      // base `lead` above deliberately omits it and gets the empty default.
      tags: [{ id: cardFields.tags[0].id, name: "VIP", color: "RED" }],
    });

    // An explicit null is a column nobody has written, not a broken payload.
    expect(
      parseLeadResponse(
        { ...lead, rating: null, cardColor: null, owner: null, nextActivity: null },
        lead.branchId,
      ),
    ).toMatchObject({ rating: 0, cardColor: null, owner: null, nextActivity: null });
  });

  it("rejects a board-card field of the wrong shape rather than rendering a default over it", () => {
    const malformed = [
      { rating: 4 },
      { rating: 1.5 },
      { rating: "2" },
      { cardColor: "MAUVE" },
      { owner: { firstName: "Kamal", lastName: "Radwan" } },
      { owner: { userId: cardFields.owner.userId, firstName: 7 } },
      { nextActivity: { activityAt: "not-a-date", bucket: "OVERDUE" } },
      { nextActivity: { activityAt: cardFields.nextActivity.activityAt, bucket: "SOON" } },
      { tags: "VIP" },
      { tags: [{ name: "VIP" }] },
    ];
    for (const patch of malformed) {
      expect(() => parseLeadResponse({ ...lead, ...patch }, lead.branchId)).toThrow(
        "Invalid leads response.",
      );
    }
  });

  it("uses the branch capability owner boundary for visible actions", () => {
    const capabilities = parseLeadCapabilitiesResponse(
      {
        branchId: "01900100-0000-7000-8000-000000000099",
        leads: {
          create: { scope: "team", ownerUserIds: [lead.ownerUserId] },
          update: { scope: "all", ownerUserIds: null },
          delete: null,
          convert: null,
        },
      },
      "01900100-0000-7000-8000-000000000099",
    );

    expect(capabilityAllowsOwner(capabilities.create, lead.ownerUserId)).toBe(
      true,
    );
    expect(capabilityAllowsOwner(capabilities.create, "other-owner")).toBe(
      false,
    );
    expect(capabilityAllowsOwner(capabilities.update, null)).toBe(true);
    expect(capabilityAllowsOwner(capabilities.delete, lead.ownerUserId)).toBe(
      false,
    );
    expect(() =>
      parseLeadCapabilitiesResponse(
        {
          branchId: "other-branch",
          leads: { create: null, update: null, delete: null },
        },
        "01900100-0000-7000-8000-000000000099",
      ),
    ).toThrow("Invalid lead capabilities response.");
  });

  it("rejects the old raw-page and malformed response shapes", () => {
    expect(() =>
      parseLeadsResponse({ success: true, data: [lead] }, lead.branchId),
    ).toThrow(
      "Invalid leads response.",
    );
    expect(() =>
      parseLeadsResponse({
        items: [lead],
        total: 101,
        page: 1,
        limit: 100,
        totalPages: 2,
        hasNext: false,
        hasPrev: false,
      }, lead.branchId),
    ).toThrow("Invalid leads response.");
    expect(() =>
      parseLeadResponse({ ...lead, stageId: null }, lead.branchId),
    ).toThrow("Invalid leads response.");
    expect(() =>
      parseLeadResponse({ ...lead, id: "../outside" }, lead.branchId),
    ).toThrow("Invalid leads response.");
    expect(() =>
      parseLeadsResponse({
        items: [lead],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      }, lead.branchId),
    ).toThrow("Invalid leads response.");
    expect(() =>
      parseLeadResponse(
        { ...lead, branchId: "01900100-0000-7000-8000-000000000098" },
        lead.branchId,
      ),
    ).toThrow("Invalid leads response.");
  });

  it("accepts an empty page that became out of range under concurrent writes", () => {
    expect(
      parseLeadsResponse({
        items: [],
        total: 0,
        page: 2,
        limit: 50,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }, lead.branchId),
    ).toEqual({
      items: [],
      total: 0,
      page: 2,
      limit: 50,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it("uses active tenant stages in server order and rejects duplicates", () => {
    const stages = [
      {
        id: "01900100-0000-7000-8000-000000000012",
        nameAr: "مؤهل",
        nameEn: "Qualified",
        flag: "QUALIFIED",
        category: "POSITIVE",
        sortOrder: 2,
        isDefault: false,
        isActive: true,
      },
      {
        id: "01900100-0000-7000-8000-000000000013",
        nameAr: "قديم",
        nameEn: "Old",
        flag: "NURTURING",
        category: "IN_PROGRESS",
        sortOrder: 3,
        isDefault: false,
        isActive: false,
      },
      {
        id: "01900100-0000-7000-8000-000000000011",
        nameAr: "جديد",
        nameEn: "New",
        flag: "NEW",
        category: "IN_PROGRESS",
        sortOrder: 1,
        isDefault: true,
        isActive: true,
      },
    ];

    expect(
      parseLeadStagesResponse(stages).map(({ id }) => id),
    ).toEqual([
      "01900100-0000-7000-8000-000000000011",
      "01900100-0000-7000-8000-000000000012",
    ]);
    expect(parseLeadStagesResponse(stages)[0].flag).toBe("NEW");
    expect(() =>
      parseLeadStagesResponse([stages[0], { ...stages[0] }]),
    ).toThrow("Invalid lead stages response.");
  });

});
