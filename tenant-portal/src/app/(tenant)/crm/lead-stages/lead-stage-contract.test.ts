import { describe, expect, it } from "vitest";
import {
  buildCreateLeadStageRequest,
  parseLeadStageCatalogueResponse,
  parseLeadStageResponse,
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
