import { describe, expect, it } from "vitest";
import { buildReplaceAssignmentsRequest } from "./pipeline-contract";

const userId = "01900200-0000-7000-8000-000000000002";

describe("pipeline access replacement request", () => {
  it("rejects an empty restricted set or targets retained under ALL", () => {
    expect(() => buildReplaceAssignmentsRequest("RESTRICTED", [], [])).toThrow("PIPELINE_ASSIGNMENTS_INVALID");
    expect(() => buildReplaceAssignmentsRequest("ALL", [userId], [])).toThrow("PIPELINE_ASSIGNMENTS_INVALID");
  });
  it("rejects duplicate and invalid targets before a write", () => {
    expect(() => buildReplaceAssignmentsRequest("RESTRICTED", [userId, userId], [])).toThrow("PIPELINE_ASSIGNMENTS_INVALID");
    expect(() => buildReplaceAssignmentsRequest("RESTRICTED", ["not-a-uuid"], [])).toThrow("PIPELINE_ASSIGNMENTS_INVALID");
  });
});
