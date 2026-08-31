import { describe, expect, it } from "vitest";
import {
  buildCreateLeadStageRequest,
  buildUpdateLeadStageRequest,
  isProtectedLeadStage,
  parseLeadStageCatalogueResponse,
  parseLeadStageResponse,
  toUpdateLeadStageForm,
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
    expect(() =>
      buildCreateLeadStageRequest({
        nameAr: "تم التحويل",
        nameEn: "Converted",
        flag: "CONVERTED",
        category: "POSITIVE",
        isDefault: true,
      }),
    ).toThrow("Invalid lead stage form.");
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

  it("refuses every mutation the NEW stage is protected from", () => {
    expect(isProtectedLeadStage(newStage)).toBe(true);
    for (const form of [
      { ...toUpdateLeadStageForm(newStage), nameEn: "Fresh" },
      { ...toUpdateLeadStageForm(newStage), flag: "CONTACTED" as const },
      { ...toUpdateLeadStageForm(newStage), isActive: false },
    ]) {
      expect(() => buildUpdateLeadStageRequest(form, newStage)).toThrow(
        "Invalid lead stage form.",
      );
    }
  });

  it("refuses turning another stage into NEW", () => {
    expect(() =>
      buildUpdateLeadStageRequest(
        { ...toUpdateLeadStageForm(contacted), flag: "NEW" },
        contacted,
      ),
    ).toThrow("Invalid lead stage form.");
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
