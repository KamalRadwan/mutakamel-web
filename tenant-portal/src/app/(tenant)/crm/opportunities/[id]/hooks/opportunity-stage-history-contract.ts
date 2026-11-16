import { isUUIDv7 } from "@/lib/uuid";

export interface OpportunityHistorySnapshot {
  membershipId: string; stageNameAr: string; stageNameEn: string; pipelineNameAr: string; pipelineNameEn: string;
}
export interface OpportunityHistoryRow {
  id: string; opportunityId: string; fromStageId: string | null; toStageId: string | null;
  fromStatus: string | null; toStatus: string | null; changedAt: string | null; changedByUserId: string | null; reason: string | null;
  fromStageSnapshot: OpportunityHistorySnapshot | null; toStageSnapshot: OpportunityHistorySnapshot | null;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid opportunity stage history");
  return value as Record<string, unknown>;
}
function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Invalid opportunity stage history value");
  return value;
}
function nullableId(value: unknown): string | null {
  const id = nullableString(value);
  if (id !== null && !isUUIDv7(id)) throw new Error("Invalid opportunity stage history identifier");
  return id;
}
function snapshot(value: unknown, stageId: string | null): OpportunityHistorySnapshot | null {
  if (value === null) { if (stageId !== null) throw new Error("Missing historical stage snapshot"); return null; }
  const item = object(value);
  if (!isUUIDv7(item.membershipId) || item.membershipId !== stageId) throw new Error("Invalid historical membership snapshot");
  for (const key of ["stageNameAr", "stageNameEn", "pipelineNameAr", "pipelineNameEn"] as const) if (typeof item[key] !== "string" || !item[key].trim()) throw new Error("Invalid historical stage name");
  return { membershipId: item.membershipId, stageNameAr: item.stageNameAr as string, stageNameEn: item.stageNameEn as string, pipelineNameAr: item.pipelineNameAr as string, pipelineNameEn: item.pipelineNameEn as string };
}
export function parseOpportunityStageHistory(value: unknown, opportunityId: string) {
  const body = object(value);
  if (!Array.isArray(body.items) || body.items.length > 100 || (body.nextCursor !== null && (typeof body.nextCursor !== "string" || !body.nextCursor || body.nextCursor.length > 256))) throw new Error("Invalid opportunity stage history page");
  const seen = new Set<string>();
  const items: OpportunityHistoryRow[] = body.items.map((value) => {
    const item = object(value);
    if (!isUUIDv7(item.id) || item.opportunityId !== opportunityId || seen.has(item.id)) throw new Error("Invalid opportunity stage history owner");
    seen.add(item.id);
    const fromStageId = nullableId(item.fromStageId), toStageId = nullableId(item.toStageId);
    const changedAt = nullableString(item.changedAt);
    if (changedAt !== null && !Number.isFinite(Date.parse(changedAt))) throw new Error("Invalid stage history timestamp");
    return { id: item.id, opportunityId, fromStageId, toStageId, fromStatus: nullableString(item.fromStatus), toStatus: nullableString(item.toStatus), changedAt,
      changedByUserId: nullableId(item.changedByUserId), reason: nullableString(item.reason), fromStageSnapshot: snapshot(item.fromStageSnapshot, fromStageId), toStageSnapshot: snapshot(item.toStageSnapshot, toStageId) };
  });
  return { items, nextCursor: body.nextCursor as string | null };
}
