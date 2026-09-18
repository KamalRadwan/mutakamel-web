import { describe, expect, it } from "vitest";
import {
  buildCreateLeadStageRequest,
  buildLeadStageReorderRequest,
  buildUpdateLeadStageRequest,
  canBeDefaultLeadStage,
  entryLeadStageId,
  isProtectedLeadStage,
  parseLeadStageCatalogueResponse,
  parseLeadStageResponse,
  protectedLeadStageIds,
  toUpdateLeadStageForm,
  type CreateLeadStageFormData,
  type LeadStageItem,
} from "./lead-stage-contract";

const stage = {
  id: "01900100-0000-7000-8000-000000000010",
  nameAr: "تم التواصل",
  nameEn: "Contacted",
  flag: "CONTACTED",
  category: "IN_PROGRESS",
  sortOrder: 2,
  isDefault: false,
  isActive: true,
};

describe("Lead-stage API contract", () => {
  it("parses canonical raw CRM payloads in server order", () => {
    const first = {
      ...stage,
      id: "01900100-0000-7000-8000-000000000001",
      nameAr: "جديد",
      nameEn: "New",
      flag: "NEW",
      sortOrder: 1,
      isDefault: true,
    };

    expect(
      parseLeadStageCatalogueResponse([stage, first]).map(({ id }) => id),
    ).toEqual([first.id, stage.id]);
    expect(parseLeadStageResponse(stage)).toEqual(stage);
  });

  it("rejects enveloped, duplicate, and opportunity-only stage shapes", () => {
    expect(() =>
      parseLeadStageCatalogueResponse([stage, { ...stage }]),
    ).toThrow("Invalid lead stages response.");
    expect(() =>
      parseLeadStageResponse({ ...stage, category: "OPEN" }),
    ).toThrow("Invalid lead stages response.");
    expect(() =>
      parseLeadStageCatalogueResponse({ success: true, data: [stage] }),
    ).toThrow("Invalid lead stages response.");
    expect(() =>
      parseLeadStageCatalogueResponse(Array.from({ length: 501 }, () => stage)),
    ).toThrow("Invalid lead stages response.");
    expect(() =>
      parseLeadStageResponse({ ...stage, id: "stage-two" }),
    ).toThrow("Invalid lead stages response.");
  });

  it("builds only the CRM create DTO and trims user labels", () => {
    expect(
      buildCreateLeadStageRequest({
        nameAr: "  متابعة لاحقة  ",
        nameEn: "  Nurturing  ",
        flag: "NURTURING",
        category: "IN_PROGRESS",
        isDefault: false,
      }),
    ).toEqual({
      nameAr: "متابعة لاحقة",
      nameEn: "Nurturing",
      flag: "NURTURING",
      category: "IN_PROGRESS",
      isDefault: false,
    });
    for (const flag of ["NEW", "DISQUALIFIED", "CONVERTED"] as const) {
      expect(() =>
        buildCreateLeadStageRequest({
        nameAr: "تم التحويل",
        nameEn: "Converted",
        flag,
        category: "POSITIVE",
        isDefault: true,
        } as unknown as CreateLeadStageFormData),
      ).toThrow("Invalid lead stage form.");
    }
  });
});

// Task 8.17 — PATCH /lead-stages/:id. Every refusal below is one the service
// issues itself (lead-stages.service.ts): LEAD_STAGE_PROTECTED for the NEW
// stage in either direction, LEAD_STAGE_DEFAULT_DEACTIVATE, and
// LEAD_STAGE_DEFAULT_CONVERTED.
describe("Lead-stage update contract", () => {
  const newStage: LeadStageItem = {
    id: "01900100-0000-7000-8000-000000000001",
    nameAr: "جديد",
    nameEn: "New",
    flag: "NEW",
    category: "IN_PROGRESS",
    sortOrder: 1,
    isDefault: true,
    isActive: true,
  };

  const contacted: LeadStageItem = {
    id: "01900100-0000-7000-8000-000000000002",
    nameAr: "تم التواصل",
    nameEn: "Contacted",
    flag: "CONTACTED",
    category: "IN_PROGRESS",
    sortOrder: 2,
    isDefault: false,
    isActive: true,
  };

  it("sends only the fields that actually changed", () => {
    expect(
      buildUpdateLeadStageRequest(
        { ...toUpdateLeadStageForm(contacted), nameEn: "Reached out" },
        contacted,
      ),
    ).toEqual({ nameEn: "Reached out" });
  });

  it("never sends isDefault — the DTO has no such field", () => {
    const body = buildUpdateLeadStageRequest(
      { ...toUpdateLeadStageForm(contacted), isActive: false },
      contacted,
    );
    expect(body).toEqual({ isActive: false });
    expect(body).not.toHaveProperty("isDefault");
  });

  it("refuses every mutation of NEW, DISQUALIFIED, and CONVERTED", () => {
    for (const protectedStage of [
      newStage,
      { ...contacted, flag: "DISQUALIFIED" as const, category: "NEGATIVE" as const },
      { ...contacted, flag: "CONVERTED" as const, category: "POSITIVE" as const },
    ]) {
      expect(isProtectedLeadStage(protectedStage)).toBe(true);
      for (const form of [
        { ...toUpdateLeadStageForm(protectedStage), nameEn: "Changed" },
        { ...toUpdateLeadStageForm(protectedStage), flag: "CONTACTED" as const },
        {
          ...toUpdateLeadStageForm(protectedStage),
          category:
            protectedStage.category === "IN_PROGRESS"
              ? ("POSITIVE" as const)
              : ("IN_PROGRESS" as const),
        },
        { ...toUpdateLeadStageForm(protectedStage), isActive: false },
      ]) {
        expect(() => buildUpdateLeadStageRequest(form, protectedStage)).toThrow(
          "Invalid lead stage form.",
        );
      }
    }
  });

  it("refuses turning another stage into a protected lifecycle anchor", () => {
    for (const flag of ["NEW", "DISQUALIFIED", "CONVERTED"] as const) {
      expect(() =>
        buildUpdateLeadStageRequest(
          { ...toUpdateLeadStageForm(contacted), flag },
          contacted,
        ),
      ).toThrow("Invalid lead stage form.");
    }
  });

  it("allows defaults only for active non-terminal stages", () => {
    expect(canBeDefaultLeadStage(contacted)).toBe(true);
    expect(canBeDefaultLeadStage({ ...contacted, isActive: false })).toBe(false);
    expect(canBeDefaultLeadStage({ ...contacted, flag: "DISQUALIFIED" })).toBe(false);
    expect(canBeDefaultLeadStage({ ...contacted, flag: "CONVERTED" })).toBe(false);
  });

  it("refuses deactivating the default stage or flagging it CONVERTED", () => {
    const defaultStage = { ...contacted, isDefault: true };
    expect(() =>
      buildUpdateLeadStageRequest(
        { ...toUpdateLeadStageForm(defaultStage), isActive: false },
        defaultStage,
      ),
    ).toThrow("Invalid lead stage form.");
    expect(() =>
      buildUpdateLeadStageRequest(
        {
          ...toUpdateLeadStageForm(defaultStage),
          flag: "CONVERTED",
          category: "POSITIVE",
        },
        defaultStage,
      ),
    ).toThrow("Invalid lead stage form.");
  });
});

describe("Lead-stage reorder contract", () => {
  const entry: LeadStageItem = {
    ...(stage as LeadStageItem),
    id: "01900100-0000-7000-8000-000000000001",
    nameAr: "جديد",
    nameEn: "New",
    flag: "NEW",
    sortOrder: 1,
    isDefault: true,
  };
  const qualified: LeadStageItem = {
    ...(stage as LeadStageItem),
    id: "01900100-0000-7000-8000-000000000030",
    flag: "QUALIFIED",
    sortOrder: 3,
  };
  const disqualified: LeadStageItem = {
    ...qualified,
    id: "01900100-0000-7000-8000-000000000040",
    flag: "DISQUALIFIED",
    category: "NEGATIVE",
    sortOrder: 4,
  };
  const converted: LeadStageItem = {
    ...qualified,
    id: "01900100-0000-7000-8000-000000000050",
    flag: "CONVERTED",
    category: "POSITIVE",
    sortOrder: 5,
  };
  const catalogue: LeadStageItem[] = [
    entry,
    stage as LeadStageItem,
    qualified,
    disqualified,
    converted,
  ];

  it("sends the COMPLETE order the endpoint replaces, as its own array", () => {
    const orderedIds = [
      entry.id,
      qualified.id,
      stage.id,
      disqualified.id,
      converted.id,
    ];
    const request = buildLeadStageReorderRequest(catalogue, orderedIds);

    expect(request).toEqual({ orderedIds });
    // Its own array: the caller's list must not become the optimistic state by
    // reference.
    expect(request.orderedIds).not.toBe(orderedIds);
  });

  // `assertExactOrder` in crm-app answers 422 LEAD_STAGE_REORDER_INVALID for
  // each of these, so none of them is worth a round trip.
  it("refuses a partial order, a duplicate, an unknown id, or a displaced NEW", () => {
    expect(() =>
      buildLeadStageReorderRequest(catalogue, [entry.id, stage.id]),
    ).toThrow("Invalid lead stage order.");
    expect(() =>
      buildLeadStageReorderRequest(catalogue, [
        entry.id,
        stage.id,
        qualified.id,
        disqualified.id,
        disqualified.id,
      ]),
    ).toThrow("Invalid lead stage order.");
    expect(() =>
      buildLeadStageReorderRequest(catalogue, [
        entry.id,
        stage.id,
        qualified.id,
        disqualified.id,
        "01900100-0000-7000-8000-0000000000ff",
      ]),
    ).toThrow("Invalid lead stage order.");
    expect(() =>
      buildLeadStageReorderRequest(catalogue, [
        stage.id,
        entry.id,
        qualified.id,
        disqualified.id,
        converted.id,
      ]),
    ).toThrow("Invalid lead stage order.");
    expect(() =>
      buildLeadStageReorderRequest(catalogue, [
        entry.id,
        stage.id,
        disqualified.id,
        qualified.id,
        converted.id,
      ]),
    ).toThrow("Invalid lead stage order.");
    expect(() =>
      buildLeadStageReorderRequest(catalogue, [
        entry.id,
        stage.id,
        qualified.id,
        converted.id,
        disqualified.id,
      ]),
    ).toThrow("Invalid lead stage order.");
    expect(() => buildLeadStageReorderRequest([], [])).toThrow(
      "Invalid lead stage order.",
    );
  });

  it("names the pinned entry stage only when the catalogue holds exactly one", () => {
    expect(entryLeadStageId(catalogue)).toBe(entry.id);
    expect(entryLeadStageId([stage as LeadStageItem, qualified])).toBeNull();
    expect(entryLeadStageId([entry, { ...qualified, flag: "NEW" }])).toBeNull();
  });

  it("pins all three server-owned lifecycle stages", () => {
    expect([...protectedLeadStageIds(catalogue)]).toEqual([
      entry.id,
      disqualified.id,
      converted.id,
    ]);
  });
});
