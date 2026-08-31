import { describe, expect, it } from "vitest";
import type { OpportunityStageDefinition } from "../pipelines/pipeline-contract";
import {
  allowedCategoriesForFlag,
  buildCreateOpportunityStageRequest,
  buildUpdateOpportunityStageRequest,
  defaultCategoryForFlag,
  isCategoryAllowedForFlag,
  opportunityStagePath,
  toOpportunityStageForm,
} from "./opportunity-stage-contract";

const STAGE_ID = "01900300-0000-7000-8000-000000000001";

const stage: OpportunityStageDefinition = {
  id: STAGE_ID,
  nameAr: "مراجعة",
  nameEn: "Review",
  flag: "DISCOVERY",
  category: "IN_PROGRESS",
  isActive: true,
  isSystem: false,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

describe("Opportunity-stage API contract", () => {
  // OpportunityStagesService.assertCategory: NEW must be OPEN, WON must be
  // POSITIVE, LOST must be NEGATIVE, and OPEN cannot be used by any other flag.
  it("mirrors the server's flag/category pairing rule exactly", () => {
    expect(allowedCategoriesForFlag("NEW")).toEqual(["OPEN"]);
    expect(allowedCategoriesForFlag("WON")).toEqual(["POSITIVE"]);
    expect(allowedCategoriesForFlag("LOST")).toEqual(["NEGATIVE"]);
    expect(allowedCategoriesForFlag("PROPOSAL")).not.toContain("OPEN");
    expect(defaultCategoryForFlag("NEGOTIATION")).toBe("POSITIVE");
    expect(isCategoryAllowedForFlag("DISCOVERY", "OPEN")).toBe(false);
    expect(isCategoryAllowedForFlag("NEW", "OPEN")).toBe(true);
  });

  it("refuses a pairing the server would answer 422 for", () => {
    expect(() =>
      buildCreateOpportunityStageRequest({
        nameAr: "أ",
        nameEn: "A",
        flag: "WON",
        category: "IN_PROGRESS",
        isActive: true,
      }),
    ).toThrow("OPPORTUNITY_STAGE_CATEGORY_INVALID");
  });

  it("sends only CreateOpportunityStageDto keys and trims the names", () => {
    expect(
      buildCreateOpportunityStageRequest({
        nameAr: "  مراجعة  ",
        nameEn: "  Review  ",
        flag: "DISCOVERY",
        category: "IN_PROGRESS",
        // isActive is server-set on create; sending it would be a 400 under
        // forbidNonWhitelisted.
        isActive: true,
      }),
    ).toEqual({
      nameAr: "مراجعة",
      nameEn: "Review",
      flag: "DISCOVERY",
      category: "IN_PROGRESS",
    });
  });

  it("drops unchanged semantic fields from the update body", () => {
    expect(
      buildUpdateOpportunityStageRequest(
        { ...toOpportunityStageForm(stage), nameEn: "Commercial review" },
        stage,
      ),
    ).toEqual({ nameAr: "مراجعة", nameEn: "Commercial review" });
  });

  it("includes flag, category and isActive only when they actually change", () => {
    expect(
      buildUpdateOpportunityStageRequest(
        {
          ...toOpportunityStageForm(stage),
          flag: "WON",
          category: "POSITIVE",
          isActive: false,
        },
        stage,
      ),
    ).toEqual({
      nameAr: "مراجعة",
      nameEn: "Review",
      flag: "WON",
      category: "POSITIVE",
      isActive: false,
    });
  });

  it("rejects a blank name and a non-UUIDv7 path segment", () => {
    expect(() =>
      buildCreateOpportunityStageRequest({
        nameAr: "   ",
        nameEn: "A",
        flag: "DISCOVERY",
        category: "IN_PROGRESS",
        isActive: true,
      }),
    ).toThrow("OPPORTUNITY_STAGE_NAME_INVALID");
    expect(() => opportunityStagePath("not-a-uuid")).toThrow(
      "Invalid CRM opportunity-stage id.",
    );
    expect(opportunityStagePath(STAGE_ID)).toBe(
      `/api/tenant/crm/v1/opportunity-stages/${STAGE_ID}`,
    );
  });
});
