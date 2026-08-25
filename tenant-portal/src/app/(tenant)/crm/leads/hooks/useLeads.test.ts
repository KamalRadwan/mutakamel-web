import { describe, expect, it } from "vitest";
import {
  buildCreateLeadRequest,
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

  it("builds the corporate lead DTO required by CRM", () => {
    expect(
      buildCreateLeadRequest(
        {
          contactName: "  Dina Ali  ",
          companyName: "  Acme Trading  ",
          email: "  dina@example.com  ",
          phone: "  +201001112223  ",
          stageId: lead.stageId,
        },
        "01900100-0000-7000-8000-000000000099",
      ),
    ).toEqual({
      branchId: "01900100-0000-7000-8000-000000000099",
      leadProfileType: "CORPORATE",
      displayName: "Acme Trading",
      companyName: "Acme Trading",
      companyPhone: "+201001112223",
      contacts: [
        {
          fullName: "Dina Ali",
          email: "dina@example.com",
          phone: "+201001112223",
          isPrimary: true,
        },
      ],
      stageId: lead.stageId,
    });
  });
});
