import type {
  ControlPlaneAuditFilterDraft,
  ControlPlaneAuditFilterErrors,
  ControlPlaneAuditMode,
  ControlPlaneAuditQuery,
} from "../types/control-plane-audit";

export const EMPTY_CONTROL_PLANE_AUDIT_FILTERS: ControlPlaneAuditFilterDraft = {
  actorType: "",
  actorId: "",
  tenantId: "",
  action: "",
  entityType: "",
  entityId: "",
  outcome: "",
  sourceApp: "",
  sourceType: "",
  correlationId: "",
  from: "",
  to: "",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|authorization|cookie|credential|private[_-]?key|api[_-]?key|access[_-]?key|client[_-]?secret|ciphertext|refresh)/i;
const MAX_RENDER_DEPTH = 8;
const MAX_RENDER_ENTRIES = 100;
const MAX_RENDER_STRING_LENGTH = 2_000;

const FIELD_LIMITS: Partial<Record<keyof ControlPlaneAuditFilterDraft, number>> = {
  actorId: 128,
  action: 96,
  entityType: 128,
  entityId: 256,
  sourceApp: 64,
  sourceType: 64,
  correlationId: 128,
};

export function validateControlPlaneAuditFilters(
  draft: ControlPlaneAuditFilterDraft,
  mode: ControlPlaneAuditMode,
): ControlPlaneAuditFilterErrors {
  const errors: ControlPlaneAuditFilterErrors = {};

  for (const [field, maximum] of Object.entries(FIELD_LIMITS) as Array<
    [keyof ControlPlaneAuditFilterDraft, number]
  >) {
    if (draft[field].trim().length > maximum) {
      errors[field] = `Maximum ${maximum} characters.`;
    }
  }

  if (draft.tenantId.trim() && !UUID_PATTERN.test(draft.tenantId.trim())) {
    errors.tenantId = "Enter a valid tenant UUID.";
  }

  if (mode === "ENTITY_HISTORY") {
    if (!draft.entityType.trim()) {
      errors.entityType = "Entity type is required for entity history.";
    }
    if (!draft.entityId.trim()) {
      errors.entityId = "Entity ID is required for entity history.";
    }
  }

  const from = readLocalDate(draft.from);
  const to = readLocalDate(draft.to);
  if (draft.from && !from) errors.from = "Enter a valid start date and time.";
  if (draft.to && !to) errors.to = "Enter a valid end date and time.";
  if (from && to && from.getTime() >= to.getTime()) {
    errors.dateRange = "The start must be earlier than the exclusive end.";
  }

  return errors;
}

export function toControlPlaneAuditQuery(
  draft: ControlPlaneAuditFilterDraft,
): Omit<ControlPlaneAuditQuery, "page" | "limit"> {
  return compactQuery({
    actorType: draft.actorType || undefined,
    actorId: trimmed(draft.actorId),
    tenantId: trimmed(draft.tenantId),
    action: trimmed(draft.action),
    entityType: trimmed(draft.entityType),
    entityId: trimmed(draft.entityId),
    outcome: draft.outcome || undefined,
    sourceApp: trimmed(draft.sourceApp),
    sourceType: trimmed(draft.sourceType),
    correlationId: trimmed(draft.correlationId),
    from: readLocalDate(draft.from)?.toISOString(),
    to: readLocalDate(draft.to)?.toISOString(),
  });
}

export function sanitizeAuditValue(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    return value.length <= MAX_RENDER_STRING_LENGTH
      ? value
      : `${value.slice(0, MAX_RENDER_STRING_LENGTH)}… [TRUNCATED]`;
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value ?? null;
  }
  if (depth >= MAX_RENDER_DEPTH) return "[MAX_DEPTH]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_RENDER_ENTRIES)
      .map((entry) => sanitizeAuditValue(entry, "", depth + 1, seen));
    if (value.length > MAX_RENDER_ENTRIES) result.push("[TRUNCATED]");
    return result;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [entryKey, entryValue] of entries.slice(0, MAX_RENDER_ENTRIES)) {
    result[entryKey] = sanitizeAuditValue(
      entryValue,
      entryKey,
      depth + 1,
      seen,
    );
  }
  if (entries.length > MAX_RENDER_ENTRIES) result._auditUi = "[TRUNCATED]";
  return result;
}

export function formatAuditValue(value: unknown): string {
  return JSON.stringify(sanitizeAuditValue(value), null, 2);
}

function readLocalDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function trimmed(value: string): string | undefined {
  const result = value.trim();
  return result || undefined;
}

function compactQuery<T extends object>(query: T): T {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as T;
}
