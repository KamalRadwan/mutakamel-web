import { axiosClient } from "@/lib/api/axiosClient";
import type {
  ControlPlaneAuditDiff,
  ControlPlaneAuditEventDetail,
  ControlPlaneAuditEventSummary,
  ControlPlaneAuditPage,
  ControlPlaneAuditQuery,
} from "../types/control-plane-audit";
import {
  CONTROL_PLANE_AUDIT_ACTOR_TYPES,
  CONTROL_PLANE_AUDIT_OUTCOMES,
} from "../types/control-plane-audit";

const BASE_URL = "/api/admin/core/v1/audit";

export const controlPlaneAuditApi = {
  list: async (query: ControlPlaneAuditQuery, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}${serializeControlPlaneAuditQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return parseControlPlaneAuditPage(response.data);
  },

  entityHistory: async (
    entityType: string,
    entityId: string,
    query: ControlPlaneAuditQuery,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}${serializeControlPlaneAuditQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return parseControlPlaneAuditPage(response.data);
  },

  /**
   * Full evidence for one event, including the before/after snapshots,
   * diff, and metadata that `list`/`entityHistory` omit to keep pages small.
   */
  getById: async (id: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE_URL}/${encodeURIComponent(id)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return parseAuditEventDetailResponse(response.data);
  },
};

export function serializeControlPlaneAuditQuery(
  query: ControlPlaneAuditQuery,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function parseControlPlaneAuditPage(payload: unknown): ControlPlaneAuditPage {
  const envelope = record(payload);
  if (!envelope || envelope.success !== true) return invalidResponse();
  const data = envelope.data;
  const envelopeMeta = record(envelope.meta);

  if (Array.isArray(data) && envelopeMeta) {
    return buildPage(data, envelopeMeta);
  }

  const legacyPage = record(data);
  if (!legacyPage || !Array.isArray(legacyPage.items)) return invalidResponse();
  return buildPage(legacyPage.items, legacyPage);
}

function buildPage(items: unknown[], meta: Record<string, unknown>): ControlPlaneAuditPage {
  const page = positiveInteger(meta.page);
  const limit = positiveInteger(meta.limit);
  const total = nonNegativeInteger(meta.total);
  const totalPages = nonNegativeInteger(meta.totalPages);
  if (page === undefined || limit === undefined || total === undefined || totalPages === undefined) {
    return invalidResponse();
  }

  return {
    items: items.map(parseAuditEventSummary),
    total,
    page,
    limit,
    totalPages,
    hasNext: booleanOr(meta.hasNext, page < totalPages),
    hasPrev: booleanOr(meta.hasPrev, page > 1),
  };
}

function parseAuditEventSummary(value: unknown): ControlPlaneAuditEventSummary {
  const event = record(value);
  if (!event) return invalidResponse();
  return parseAuditEventCore(event);
}

function parseAuditEventDetailResponse(payload: unknown): ControlPlaneAuditEventDetail {
  const envelope = record(payload);
  if (!envelope || envelope.success !== true) return invalidResponse();
  const event = record(envelope.data);
  if (!event) return invalidResponse();
  return {
    ...parseAuditEventCore(event),
    before: nullableRecord(event.before),
    after: nullableRecord(event.after),
    diff: parseDiff(event.diff),
    metadata: nullableRecord(event.metadata),
  };
}

function parseAuditEventCore(event: Record<string, unknown>): ControlPlaneAuditEventSummary {
  const actorType = enumValue(event.actorType, CONTROL_PLANE_AUDIT_ACTOR_TYPES);
  const outcome = enumValue(event.outcome, CONTROL_PLANE_AUDIT_OUTCOMES);
  const schemaVersion = positiveInteger(event.schemaVersion);
  const id = stringValue(event.id);
  const action = stringValue(event.action);
  const entityType = stringValue(event.entityType);
  const sourceApp = stringValue(event.sourceApp);
  const sourceType = stringValue(event.sourceType);
  const occurredAt = stringValue(event.occurredAt);
  if (
    !actorType ||
    !outcome ||
    schemaVersion === undefined ||
    !id ||
    !action ||
    !entityType ||
    !sourceApp ||
    !sourceType ||
    !occurredAt ||
    Number.isNaN(Date.parse(occurredAt))
  ) {
    return invalidResponse();
  }

  return {
    id,
    schemaVersion,
    actorType,
    actorId: nullableString(event.actorId),
    actorLabel: nullableString(event.actorLabel),
    tenantId: nullableString(event.tenantId),
    action,
    entityType,
    entityId: nullableString(event.entityId),
    outcome,
    sourceApp,
    sourceType,
    sourceId: nullableString(event.sourceId),
    sourceRoute: nullableString(event.sourceRoute),
    operationId: nullableString(event.operationId),
    correlationId: nullableString(event.correlationId),
    requestId: nullableString(event.requestId),
    idempotencyKey: nullableString(event.idempotencyKey),
    reason: nullableString(event.reason),
    ip: nullableString(event.ip),
    userAgent: nullableString(event.userAgent),
    occurredAt,
  };
}

function parseDiff(value: unknown): ControlPlaneAuditDiff[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ControlPlaneAuditDiff[] => {
    const candidate = record(entry);
    const field = stringValue(candidate?.field);
    if (!candidate || !field) return [];
    return [{
      field,
      ...(Object.hasOwn(candidate, "before") ? { before: candidate.before } : {}),
      ...(Object.hasOwn(candidate, "after") ? { after: candidate.after } : {}),
    }];
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableRecord(value: unknown): Record<string, unknown> | null {
  return value === null || value === undefined ? null : record(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : undefined;
}

function invalidResponse(): never {
  throw new Error("INVALID_CONTROL_PLANE_AUDIT_RESPONSE");
}
