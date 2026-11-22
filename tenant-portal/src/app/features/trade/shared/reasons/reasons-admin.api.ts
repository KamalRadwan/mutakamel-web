import {
  ApiError,
  TRADE_API_BASE,
  assertIdempotencyKey,
  fakeDelay,
  fakeId,
  ifMatch,
  newIdempotencyKey,
  parseIfMatch,
} from '../trade-api';
import {
  TRADE_FAKE_DB,
  assertReasonKind,
  bumpVersion,
  clone,
  fakeCountReasonCodes,
  fakeListReasonCodes,
  nowIso,
} from '../trade-foundation.fake';
import type { LocalizedNames, ReasonCode, ReasonKind } from '../trade-foundation.model';
import { REASON_CODE_PATTERN, REASON_NAME_MAX } from './reason-kinds';

export const REASON_API_BASE = `${TRADE_API_BASE}/reason-codes`;

/** Backend CreateReasonDto: requiresNote / isActive / sortOrder are optional (defaults false / true / 0). */
export interface CreateReasonInput {
  kind: ReasonKind;
  code: string;
  localizedNames: LocalizedNames;
  requiresNote?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateReasonPatch {
  localizedNames?: LocalizedNames;
  requiresNote?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ReasonCounts {
  total: number;
  byKind: Record<ReasonKind, number>;
}

const SORT_ORDER_MAX = 1_000_000;

const KNOWN_REASON_ERROR_KEYS: ReadonlySet<string> = new Set([
  'TRADE_VALIDATION_FAILED',
  'TRADE_CONCURRENCY_STALE_VERSION',
  'TRADE_CONCURRENCY_IF_MATCH_REQUIRED',
  'TRADE_IDEMPOTENCY_IN_FLIGHT',
  'TRADE_AUTH_TARGET_DENIED',
  'TRADE_IDEMPOTENCY_KEY_REQUIRED',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_REASON_NOT_FOUND',
  'TRADE_REASON_CODE_TAKEN',
  'TRADE_REASON_KIND_INVALID',
  'TRADE_REASON_SYSTEM_IMMUTABLE',
  'TRADE_REASON_NOTE_REQUIRED',
]);

// ---------------------------------------------------------------------------
// Fake transport helpers (backend DTO pipe + DomainIdempotencyService)
// ---------------------------------------------------------------------------

/** Replays are scoped by operation (`create`, `update:<id>`, `delete:<id>`) like the backend. */
const replayStore = new Map<string, { fingerprint: string; response: ReasonCode }>();

function replay(operation: string, key: string, request: unknown): ReasonCode | null {
  const hit = replayStore.get(`${operation}:${key}`);
  if (!hit) return null;
  if (hit.fingerprint !== JSON.stringify(request)) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
  }
  return clone(hit.response);
}

function remember(operation: string, key: string, request: unknown, response: ReasonCode): ReasonCode {
  replayStore.set(`${operation}:${key}`, { fingerprint: JSON.stringify(request), response: clone(response) });
  return clone(response);
}

function validationFailed(): never {
  throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
}

/** ReasonLocalizedNamesDto: en and ar are strings, raw length <= 120, with a non-space character. */
function assertNamesDto(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) validationFailed();
  const names = raw as Record<string, unknown>;
  for (const lang of ['en', 'ar']) {
    const value = names[lang];
    if (typeof value !== 'string' || [...value].length > REASON_NAME_MAX || !/\S/.test(value)) validationFailed();
  }
}

function assertOptionalDto(body: { requiresNote?: unknown; isActive?: unknown; sortOrder?: unknown }): void {
  if (body.requiresNote !== undefined && typeof body.requiresNote !== 'boolean') validationFailed();
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') validationFailed();
  if (
    body.sortOrder !== undefined &&
    (!Number.isInteger(body.sortOrder) || (body.sortOrder as number) < 0 || (body.sortOrder as number) > SORT_ORDER_MAX)
  ) {
    validationFailed();
  }
}

function trimNames(names: LocalizedNames): LocalizedNames {
  return { en: names['en'].trim(), ar: names['ar'].trim() };
}

function findLive(id: string, expectedVersion: number): ReasonCode {
  const row = TRADE_FAKE_DB.reasons.find((r) => r.id === id);
  if (!row) throw new ApiError(422, 'TRADE.REASON.NOT_FOUND', { field: ['id'] });
  if (row.version !== expectedVersion) throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  return row;
}

function systemImmutable(): never {
  throw new ApiError(409, 'TRADE.REASON.SYSTEM_IMMUTABLE', { field: ['isSystem'] });
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// GET /api/tenant/trade/v1/reason-codes/counts?includeInactive (default true) -> { total, byKind }
export async function countReasons(includeInactive = true): Promise<ReasonCounts> {
  await fakeDelay();
  return fakeCountReasonCodes({ includeInactive });
}

// GET /api/tenant/trade/v1/reason-codes?kind&includeInactive -> { items } (unwrapped here; no search param)
export async function listReasonsAdmin(kind: ReasonKind, includeInactive: boolean): Promise<ReasonCode[]> {
  await fakeDelay();
  return fakeListReasonCodes({ kind, includeInactive }).items;
}

// POST /api/tenant/trade/v1/reason-codes (x-idempotency-key) -> 201 reason
export async function createReason(input: CreateReasonInput, idempotencyKey: string): Promise<ReasonCode> {
  await fakeDelay();
  // DTO pipe (400): code is matched as sent, never trimmed or upper-cased.
  if (typeof input.kind !== 'string' || typeof input.code !== 'string' || !REASON_CODE_PATTERN.test(input.code)) {
    validationFailed();
  }
  assertNamesDto(input.localizedNames);
  assertOptionalDto(input);

  const key = assertIdempotencyKey(idempotencyKey);
  const request = {
    kind: input.kind,
    code: input.code,
    localizedNames: { en: input.localizedNames['en'], ar: input.localizedNames['ar'] },
    requiresNote: input.requiresNote,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
  const replayed = replay('create', key, request);
  if (replayed) return replayed;

  assertReasonKind(input.kind);
  if (TRADE_FAKE_DB.reasons.some((r) => r.kind === input.kind && r.code === input.code)) {
    throw new ApiError(409, 'TRADE.REASON.CODE_TAKEN', { field: ['code'] });
  }

  const created: ReasonCode = {
    id: fakeId(),
    kind: input.kind,
    code: input.code,
    localizedNames: trimNames(input.localizedNames),
    requiresNote: input.requiresNote ?? false,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    isSystem: false,
    version: 1,
    updatedAt: nowIso(),
  };
  TRADE_FAKE_DB.reasons.push(created);
  return remember('create', key, request, created);
}

// PATCH /api/tenant/trade/v1/reason-codes/:id (x-idempotency-key, If-Match) -> 200 reason
export async function updateReason(
  id: string,
  version: number,
  patch: UpdateReasonPatch,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<ReasonCode> {
  await fakeDelay();
  if (patch.localizedNames !== undefined) assertNamesDto(patch.localizedNames);
  assertOptionalDto(patch);
  const key = assertIdempotencyKey(idempotencyKey);
  const expectedVersion = parseIfMatch(ifMatch(version));

  const operation = `update:${id}`;
  const request = { expectedVersion, ...patch };
  const replayed = replay(operation, key, request);
  if (replayed) return replayed;

  const row = findLive(id, expectedVersion);
  if (row.isSystem && patch.isActive === false) systemImmutable();

  const next = {
    localizedNames: patch.localizedNames === undefined ? row.localizedNames : trimNames(patch.localizedNames),
    requiresNote: patch.requiresNote ?? row.requiresNote,
    isActive: patch.isActive ?? row.isActive,
    sortOrder: patch.sortOrder ?? row.sortOrder,
  };
  const unchanged =
    next.localizedNames['en'] === row.localizedNames['en'] &&
    next.localizedNames['ar'] === row.localizedNames['ar'] &&
    next.requiresNote === row.requiresNote &&
    next.isActive === row.isActive &&
    next.sortOrder === row.sortOrder;
  if (!unchanged) {
    Object.assign(row, next);
    bumpVersion(row);
  }
  return remember(operation, key, request, row);
}

// DELETE /api/tenant/trade/v1/reason-codes/:id (x-idempotency-key, If-Match) -> 200 the soft-deleted reason
export async function deleteReason(
  id: string,
  version: number,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<ReasonCode> {
  await fakeDelay();
  const key = assertIdempotencyKey(idempotencyKey);
  const expectedVersion = parseIfMatch(ifMatch(version));

  const operation = `delete:${id}`;
  const request = { expectedVersion };
  const replayed = replay(operation, key, request);
  if (replayed) return replayed;

  const row = findLive(id, expectedVersion);
  if (row.isSystem) systemImmutable();

  // Soft delete: the row leaves every read and the reason rule (NOT_FOUND); its code is free again.
  TRADE_FAKE_DB.reasons.splice(TRADE_FAKE_DB.reasons.indexOf(row), 1);
  bumpVersion(row);
  return remember(operation, key, request, row);
}

export function reasonErrorKey(e: unknown): string {
  if (!(e instanceof ApiError)) {
    return 'tset.errors.generic';
  }
  const normalized = e.code.replaceAll('.', '_');
  if (KNOWN_REASON_ERROR_KEYS.has(normalized)) {
    return `tset.errors.${normalized}`;
  }
  return 'tset.errors.generic';
}
