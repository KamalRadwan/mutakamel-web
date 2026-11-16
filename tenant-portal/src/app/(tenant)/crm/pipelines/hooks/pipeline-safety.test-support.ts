import type { Pipeline, PipelineStage } from "../pipeline-contract";

export const PIPELINE_ID = "01900200-0000-7000-8000-000000000001";
export const OTHER_ID = "01900200-0000-7000-8000-000000000002";
export const USER_ID = "01900200-0000-7000-8000-000000000003";

export function stages(): PipelineStage[] {
  return (["NEW", "PROPOSAL", "WON", "LOST"] as const).map((flag, index) => ({
    id: `01900200-0000-7000-8000-00000000001${index}`,
    pipelineId: PIPELINE_ID,
    opportunityStageId: `01900200-0000-7000-8000-00000000002${index}`,
    rank: index + 1, nameAr: flag, nameEn: flag, flag,
    category: flag === "WON" ? "POSITIVE" : flag === "LOST" ? "NEGATIVE" : "IN_PROGRESS",
    isActive: true, isSystem: false,
  }));
}

export function pipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  return { id: PIPELINE_ID, code: "SALES", nameAr: "مبيعات", nameEn: "Sales", description: "Sales pipeline",
    isDefault: false, isActive: true, accessMode: "ALL", stages: stages(),
    assignments: { accessMode: "ALL", userIds: [], teamIds: [] },
    createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z", ...overrides };
}
export function response(data: unknown, status = 200) { return { data, status, headers: new Headers() }; }
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
