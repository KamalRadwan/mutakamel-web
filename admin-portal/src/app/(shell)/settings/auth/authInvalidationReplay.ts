import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";

export const AUTH_INVALIDATION_REPLAY_PERMISSION =
  "admin.auth_invalidation_outbox.replay";
export const AUTH_INVALIDATION_REPLAY_REASON_MIN_LENGTH = 8;
export const AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH = 500;
export const AUTH_INVALIDATION_REPLAY_MAX_EVENTS = 25;

export type AuthInvalidationReplayTarget = "CONTROL_PLANE" | "TENANT";
export type AuthInvalidationReplayMode = "DRY_RUN" | "APPLY";
export type AuthInvalidationReplayOutcome =
  | "DRY_RUN_VALIDATED"
  | "REPLAY_SCHEDULED";

export interface AuthInvalidationReplayDraft {
  target: AuthInvalidationReplayTarget;
  tenantId: string;
  eventIdsText: string;
  reason: string;
}

export interface AuthInvalidationReplayCommand {
  target: AuthInvalidationReplayTarget;
  tenantId?: string;
  mode: AuthInvalidationReplayMode;
  eventIds: string[];
  reason: string;
}

export interface AuthInvalidationReplayReceipt {
  commandId: string;
  target: AuthInvalidationReplayTarget;
  tenantId: string | null;
  mode: AuthInvalidationReplayMode;
  eventIds: string[];
  eligibleEventCount: number;
  replayedEventCount: number;
  outcome: AuthInvalidationReplayOutcome;
  correlationId?: string;
}

export type AuthInvalidationReplayValidationCode =
  | "tenantRequired"
  | "tenantInvalid"
  | "eventRequired"
  | "eventTooMany"
  | "eventDuplicate"
  | "eventInvalid"
  | "reasonRequired"
  | "reasonTooShort"
  | "reasonTooLong"
  | "dryRunRequired";

export interface AuthInvalidationReplayValidationErrors {
  tenantId?: AuthInvalidationReplayValidationCode;
  eventIds?: AuthInvalidationReplayValidationCode;
  reason?: AuthInvalidationReplayValidationCode;
  workflow?: AuthInvalidationReplayValidationCode;
}

export interface AuthInvalidationReplayBuildResult {
  command: AuthInvalidationReplayCommand | null;
  errors: AuthInvalidationReplayValidationErrors;
}

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalUUIDv7(value: string): boolean {
  return UUID_V7.test(value);
}

export function parseAuthInvalidationEventIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function buildAuthInvalidationReplayCommand(
  draft: AuthInvalidationReplayDraft,
  mode: AuthInvalidationReplayMode,
): AuthInvalidationReplayBuildResult {
  const errors: AuthInvalidationReplayValidationErrors = {};
  const tenantId = draft.tenantId.trim().toLowerCase();
  const eventIds = parseAuthInvalidationEventIds(draft.eventIdsText);
  const reason = draft.reason.trim();

  if (draft.target === "TENANT") {
    if (!tenantId) errors.tenantId = "tenantRequired";
    else if (!isCanonicalUUIDv7(tenantId)) errors.tenantId = "tenantInvalid";
  }

  if (eventIds.length === 0) errors.eventIds = "eventRequired";
  else if (eventIds.length > AUTH_INVALIDATION_REPLAY_MAX_EVENTS) {
    errors.eventIds = "eventTooMany";
  } else if (new Set(eventIds).size !== eventIds.length) {
    errors.eventIds = "eventDuplicate";
  } else if (eventIds.some((eventId) => !isCanonicalUUIDv7(eventId))) {
    errors.eventIds = "eventInvalid";
  }

  if (!reason) errors.reason = "reasonRequired";
  else if (reason.length < AUTH_INVALIDATION_REPLAY_REASON_MIN_LENGTH) {
    errors.reason = "reasonTooShort";
  } else if (reason.length > AUTH_INVALIDATION_REPLAY_REASON_MAX_LENGTH) {
    errors.reason = "reasonTooLong";
  }

  if (Object.keys(errors).length > 0) return { command: null, errors };

  return {
    command: {
      target: draft.target,
      ...(draft.target === "TENANT" ? { tenantId } : {}),
      mode,
      eventIds: [...eventIds].sort(),
      reason,
    },
    errors,
  };
}

export function authInvalidationReplayScopeFingerprint(
  command: AuthInvalidationReplayCommand,
): string {
  return JSON.stringify({
    target: command.target,
    tenantId: command.tenantId ?? null,
    eventIds: command.eventIds,
    reason: command.reason,
  });
}

export function authInvalidationReplayIntentFingerprint(
  command: AuthInvalidationReplayCommand,
): string {
  return JSON.stringify(command);
}

export function shouldRetainAuthInvalidationReplayIntent(error: {
  httpStatus: number;
  errorCode: string;
}): boolean {
  return (
    error.errorCode === "GW.IDEM.IN_FLIGHT" ||
    error.errorCode === "UNKNOWN_ERROR" ||
    error.httpStatus >= 500
  );
}

export async function replayAuthInvalidationOutbox(
  command: AuthInvalidationReplayCommand,
  idempotencyKey: string,
): Promise<AuthInvalidationReplayReceipt> {
  if (!isCanonicalUUIDv7(idempotencyKey)) {
    throw new Error("INVALID_AUTH_INVALIDATION_REPLAY_COMMAND_ID");
  }
  const response = await axiosClient.post(
    "/api/admin/core/v1/auth-invalidation-outbox/replay",
    command,
    {
      headers: { "x-idempotency-key": idempotencyKey },
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
      cache: "no-store",
    },
  );
  return readAuthInvalidationReplayReceipt(
    unwrapCoreData(response.data),
    command,
    idempotencyKey,
    response.headers.get("x-correlation-id") ??
      response.headers.get("correlation-id") ??
      undefined,
  );
}

export function readAuthInvalidationReplayReceipt(
  value: unknown,
  expected: AuthInvalidationReplayCommand,
  idempotencyKey: string,
  correlationId?: string,
): AuthInvalidationReplayReceipt {
  const item = record(value);
  const target = item?.target;
  const tenantId = item?.tenantId;
  const mode = item?.mode;
  const eventIds = item?.eventIds;
  const outcome = item?.outcome;
  const expectedTenantId = expected.tenantId ?? null;
  const expectedOutcome: AuthInvalidationReplayOutcome =
    expected.mode === "DRY_RUN" ? "DRY_RUN_VALIDATED" : "REPLAY_SCHEDULED";
  const expectedReplayed = expected.mode === "APPLY" ? expected.eventIds.length : 0;

  if (
    !item ||
    item.commandId !== idempotencyKey ||
    !isCanonicalUUIDv7(idempotencyKey) ||
    target !== expected.target ||
    (tenantId ?? null) !== expectedTenantId ||
    mode !== expected.mode ||
    !sameStrings(eventIds, expected.eventIds) ||
    item.eligibleEventCount !== expected.eventIds.length ||
    item.replayedEventCount !== expectedReplayed ||
    outcome !== expectedOutcome
  ) {
    throw new Error("INVALID_AUTH_INVALIDATION_REPLAY_RESPONSE");
  }

  return {
    commandId: idempotencyKey,
    target: expected.target,
    tenantId: expectedTenantId,
    mode: expected.mode,
    eventIds: [...expected.eventIds],
    eligibleEventCount: expected.eventIds.length,
    replayedEventCount: expectedReplayed,
    outcome: expectedOutcome,
    ...(safeCorrelationId(correlationId) ? { correlationId } : {}),
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sameStrings(value: unknown, expected: string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function safeCorrelationId(value: string | undefined): boolean {
  return Boolean(
    value &&
    value.length <= 200 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value),
  );
}
