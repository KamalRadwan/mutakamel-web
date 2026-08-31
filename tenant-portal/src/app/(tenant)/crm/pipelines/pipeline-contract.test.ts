import { describe, expect, it } from "vitest";
import {
  buildCreatePipelineRequest,
  buildReplaceAssignmentsRequest,
  buildUpdatePipelineRequest,
  moveStageOrder,
  parseAssignmentOptionsResponse,
  parseAssignmentsResponse,
  parseOpportunityStageDefinitionsResponse,
  parsePipelineResponse,
  parsePipelinesResponse,
  pipelineStagePath,
  pipelineStagesReorderPath,
} from "./pipeline-contract";

const PIPELINE_ID = "01900200-0000-7000-8000-000000000001";
const STAGE_ONE = "01900200-0000-7000-8000-0000000000a1";
const STAGE_TWO = "01900200-0000-7000-8000-0000000000a2";

const membership = (id: string, rank: number) => ({
  id,
  pipelineId: PIPELINE_ID,
  opportunityStageId: `${id.slice(0, -1)}b`,
  rank,
  nameAr: "جديدة",
  nameEn: "New",
  flag: "NEW",
  category: "OPEN",
  isActive: true,
  isSystem: true,
});

const pipeline = {
  id: PIPELINE_ID,
  code: "SALES",
  nameAr: "المبيعات",
  nameEn: "Sales",
  description: "Default sales pipeline",
  isDefault: true,
  isActive: true,
  accessMode: "ALL",
  stages: [membership(STAGE_TWO, 2), membership(STAGE_ONE, 1)],
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-02T09:00:00.000Z",
};

describe("Pipeline API contract", () => {
  it("parses the raw CRM payload and orders stages by rank, not by name", () => {
    const parsed = parsePipelineResponse(pipeline);
    expect(parsed.stages.map(({ rank }) => rank)).toEqual([1, 2]);
    expect(parsed.stages[0].id).toBe(STAGE_ONE);
    // GET /pipelines omits assignments; GET /pipelines/configuration adds
    // them. Absent is null, never an invented empty object.
    expect(parsed.assignments).toBeNull();
    expect(parsePipelinesResponse([pipeline])).toHaveLength(1);
  });

  it("rejects a Core envelope, duplicates, and an unknown stage flag", () => {
    expect(() =>
      parsePipelinesResponse({ success: true, data: [pipeline] }),
    ).toThrow("Invalid CRM pipelines response.");
    expect(() => parsePipelinesResponse([pipeline, pipeline])).toThrow(
      "Invalid CRM pipelines response.",
    );
    expect(() =>
      parsePipelineResponse({
        ...pipeline,
        stages: [{ ...membership(STAGE_ONE, 1), flag: "ARCHIVED" }],
      }),
    ).toThrow("Invalid CRM pipelines response.");
    // A membership row belonging to another pipeline is a server-side
    // inconsistency, not something to render.
    expect(() =>
      parsePipelineResponse({
        ...pipeline,
        stages: [{ ...membership(STAGE_ONE, 1), pipelineId: STAGE_TWO }],
      }),
    ).toThrow("Invalid CRM pipelines response.");
  });

  it("normalises the code and sends only CreatePipelineDto keys", () => {
    expect(
      buildCreatePipelineRequest({
        code: "  sales_eu  ",
        nameAr: "  أوروبا  ",
        nameEn: "  Europe  ",
        description: "   ",
        isDefault: true,
      }),
    ).toEqual({
      code: "SALES_EU",
      nameAr: "أوروبا",
      nameEn: "Europe",
      isDefault: true,
    });
  });

  it("refuses a code the @Matches pattern would reject", () => {
    expect(() =>
      buildCreatePipelineRequest({
        code: "1SALES",
        nameAr: "أ",
        nameEn: "A",
        description: "",
        isDefault: false,
      }),
    ).toThrow("PIPELINE_CODE_INVALID");
  });

  it("omits code and isDefault from the update body", () => {
    expect(
      buildUpdatePipelineRequest({
        nameAr: "المبيعات",
        nameEn: "Sales",
        description: "",
        isActive: false,
      }),
    ).toEqual({
      nameAr: "المبيعات",
      nameEn: "Sales",
      description: "",
      isActive: false,
    });
  });

  it("always sends both assignment arrays, even when empty", () => {
    expect(buildReplaceAssignmentsRequest("ALL", [], [])).toEqual({
      accessMode: "ALL",
      userIds: [],
      teamIds: [],
    });
  });

  it("parses assignments and assignment options", () => {
    expect(
      parseAssignmentsResponse({
        accessMode: "RESTRICTED",
        userIds: [STAGE_ONE],
        teamIds: [],
      }),
    ).toEqual({ accessMode: "RESTRICTED", userIds: [STAGE_ONE], teamIds: [] });

    const options = parseAssignmentOptionsResponse({
      users: [{ id: STAGE_ONE, label: "Sara", status: "ACTIVE" }],
      teams: [
        { id: STAGE_TWO, label: "Field", code: "FIELD", status: "ACTIVE" },
      ],
    });
    expect(options.users[0].code).toBeNull();
    expect(options.teams[0].code).toBe("FIELD");
  });

  it("builds the complete ordered id list a reorder replaces ranks with", () => {
    const stages = parsePipelineResponse(pipeline).stages;
    expect(moveStageOrder(stages, STAGE_ONE, 1)).toEqual([
      STAGE_TWO,
      STAGE_ONE,
    ]);
    // Off either end is not an error, it is "no move" — the control is
    // disabled and nothing must be sent.
    expect(moveStageOrder(stages, STAGE_ONE, -1)).toBeNull();
    expect(moveStageOrder(stages, STAGE_TWO, 1)).toBeNull();
  });

  it("builds canonical Gateway paths and refuses a non-UUIDv7 id", () => {
    expect(pipelineStagesReorderPath(PIPELINE_ID)).toBe(
      `/api/tenant/crm/v1/pipelines/${PIPELINE_ID}/stages/reorder`,
    );
    expect(pipelineStagePath(PIPELINE_ID, STAGE_ONE)).toBe(
      `/api/tenant/crm/v1/pipelines/${PIPELINE_ID}/stages/${STAGE_ONE}`,
    );
    expect(() => pipelineStagePath(PIPELINE_ID, "../../secrets")).toThrow(
      "Invalid CRM pipelines response.",
    );
  });

  it("parses the reusable stage catalogue the pipelines screen composes from", () => {
    const definition = {
      id: STAGE_ONE,
      nameAr: "مراجعة",
      nameEn: "Review",
      flag: "DISCOVERY",
      category: "IN_PROGRESS",
      isActive: true,
      isSystem: false,
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z",
    };
    expect(parseOpportunityStageDefinitionsResponse([definition])).toEqual([
      definition,
    ]);
    expect(() =>
      parseOpportunityStageDefinitionsResponse([definition, definition]),
    ).toThrow("Invalid CRM pipelines response.");
  });
});
