import {
  ApiError,
  TRADE_API_BASE,
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../trade-api';
import { tradeHttp } from '../trade-http';
import type { ReasonCode } from '../trade-foundation.model';
import type { KnownReasonKind, ReasonLocalizedNames } from './reason-kinds';

export type { KnownReasonKind, ReasonLocalizedNames } from './reason-kinds';

export const REASON_API_BASE = `${TRADE_API_BASE}/reason-codes`;
export const REASON_LIST_CAP = 500;

export type AdminReasonCode = Omit<ReasonCode, 'localizedNames'> & {
  localizedNames: ReasonLocalizedNames;
};

/** Backend CreateReasonDto: requiresNote / isActive / sortOrder are optional (defaults false / true / 0). */
export interface CreateReasonInput {
  kind: KnownReasonKind;
  code: string;
  localizedNames: ReasonLocalizedNames;
  requiresNote?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateReasonPatch {
  localizedNames?: ReasonLocalizedNames;
  requiresNote?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ReasonCounts {
  total: number;
  byKind: Record<KnownReasonKind, number>;
}

interface ReasonListResponse {
  items: AdminReasonCode[];
}

const KNOWN_REASON_ERROR_KEYS: ReadonlySet<string> = new Set([
  'TRADE_VALIDATION_FAILED',
  'TRADE_CONCURRENCY_STALE_VERSION',
  'TRADE_CONCURRENCY_IF_MATCH_REQUIRED',
  'TRADE_IDEMPOTENCY_IN_FLIGHT',
  'TRADE_AUTH_TARGET_DENIED',
  'TRADE_IDEMPOTENCY_KEY_MISSING',
  'TRADE_IDEMPOTENCY_KEY_REQUIRED',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_CONTEXT_MISSING_COMPANY',
  'TRADE_REASON_NOT_FOUND',
  'TRADE_REASON_CODE_TAKEN',
  'TRADE_REASON_KIND_INVALID',
  'TRADE_REASON_SYSTEM_IMMUTABLE',
  'TRADE_REASON_NOTE_REQUIRED',
]);

function normalizeReason(row: AdminReasonCode): AdminReasonCode {
  return {
    ...row,
    localizedNames: {
      en: row.localizedNames?.en ?? '',
      ar: row.localizedNames?.ar ?? '',
    },
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// GET /api/tenant/trade/v1/reason-codes/counts?includeInactive (default true) -> { total, byKind }
export function countReasons(includeInactive = true, ctx: TradeContext = {}): Promise<ReasonCounts> {
  return tradeHttp().read<ReasonCounts>(
    '/reason-codes/counts',
    { includeInactive },
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/reason-codes?kind&includeInactive -> { items } (capped at 500, no total)
export async function listReasonsAdmin(
  kind: KnownReasonKind | undefined,
  includeInactive: boolean,
  ctx: TradeContext = {},
): Promise<AdminReasonCode[]> {
  const query = kind === undefined ? { includeInactive } : { kind, includeInactive };
  const response = await tradeHttp().read<ReasonListResponse>('/reason-codes', query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
  return response.items.map(normalizeReason);
}

// POST /api/tenant/trade/v1/reason-codes (x-idempotency-key, NONE scope) -> 201 reason
export async function createReason(
  input: CreateReasonInput,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AdminReasonCode> {
  const body: CreateReasonInput = {
    kind: input.kind,
    code: input.code,
    localizedNames: {
      en: input.localizedNames.en,
      ar: input.localizedNames.ar,
    },
    ...(input.requiresNote !== undefined ? { requiresNote: input.requiresNote } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
  assertBodyBooleans(body, ['requiresNote', 'isActive']);
  const { data } = await tradeHttp().write<AdminReasonCode>('POST', '/reason-codes', body, {
    key: assertIdempotencyKey(idempotencyKey),
    scope: scopeFor({}, 'NONE'),
  });
  return normalizeReason(data);
}

// PATCH /api/tenant/trade/v1/reason-codes/:id (x-idempotency-key, If-Match, NONE scope) -> 200 reason
export async function updateReason(
  id: string,
  version: number,
  patch: UpdateReasonPatch,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AdminReasonCode> {
  const body: UpdateReasonPatch = {
    ...(patch.localizedNames !== undefined
      ? {
          localizedNames: {
            en: patch.localizedNames.en,
            ar: patch.localizedNames.ar,
          },
        }
      : {}),
    ...(patch.requiresNote !== undefined ? { requiresNote: patch.requiresNote } : {}),
    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  };
  assertBodyBooleans(body, ['requiresNote', 'isActive']);
  const { data } = await tradeHttp().write<AdminReasonCode>(
    'PATCH',
    `/reason-codes/${encodeURIComponent(id)}`,
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(version),
      scope: scopeFor({}, 'NONE'),
    },
  );
  return normalizeReason(data);
}

// DELETE /api/tenant/trade/v1/reason-codes/:id (x-idempotency-key, If-Match, NONE scope) -> 200 soft-deleted reason
export async function deleteReason(
  id: string,
  version: number,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AdminReasonCode> {
  const { data } = await tradeHttp().write<AdminReasonCode>(
    'DELETE',
    `/reason-codes/${encodeURIComponent(id)}`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(version),
      scope: scopeFor({}, 'NONE'),
    },
  );
  return normalizeReason(data);
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
