import type { ScopeState } from '../../../core/scope/scope';
import { ApiError as CoreApiError } from '../../../core/api/api-errors';

export const TRADE_API_BASE = '/api/tenant/trade/v1';

export class ApiError extends Error {
  readonly correlationId?: string;

  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string[]>,
    options?: { correlationId?: string },
  ) {
    super(code);
    this.name = 'ApiError';
    this.correlationId = options?.correlationId;
  }
}

/** Preserve the Trade error contract used by existing pages. */
export function toTradeError(error: unknown): unknown {
  if (!(error instanceof CoreApiError)) return error;
  const raw = error.details;
  let details: Record<string, string[]> | undefined;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    details = Object.fromEntries(Object.entries(raw).map(([field, value]) => [field,
      typeof value === 'string' ? [value]
        : Array.isArray(value) ? value.map(String) : [JSON.stringify(value)],
    ]));
  }
  return new ApiError(error.status, error.code, details, { correlationId: error.correlationId });
}

/** S1: body booleans must be real JSON booleans; "true"/"false" strings are a 400 (query params still accept them). */
export function assertBodyBooleans(body: object | null | undefined, fields: readonly string[]): void {
  const record = (body ?? {}) as Record<string, unknown>;
  const bad = fields.filter((f) => record[f] !== undefined && typeof record[f] !== 'boolean');
  if (bad.length > 0) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', Object.fromEntries(bad.map((f) => [f, ['invalid']])));
  }
}

export { newIdempotencyKey } from '../../../core/api/idempotency';

export function errorCodeOf(e: unknown): string | null {
  return e instanceof ApiError ? e.code : null;
}

export function ifMatch(version: number): string {
  return `"${version}"`;
}

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Backend `requireIdempotencyKey` (controller) then `DomainIdempotencyService.execute`:
 * absent -> 400 TRADE.IDEMPOTENCY.KEY_MISSING; present but not a UUIDv7 -> 422 TRADE.IDEMPOTENCY.KEY_REQUIRED.
 */
export function assertIdempotencyKey(key: string | null | undefined): string {
  if (!key) throw new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING');
  if (!UUID_V7_PATTERN.test(key)) throw new ApiError(422, 'TRADE.IDEMPOTENCY.KEY_REQUIRED');
  return key;
}

/** Backend `parseExpectedVersion`: `If-Match` must be a positive integer (`"3"`, `W/"3"` or `3`), else 400. */
export function parseIfMatch(header: string | null | undefined): number {
  const normalized = header?.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  const version = normalized && /^\d+$/.test(normalized) ? Number(normalized) : NaN;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  return version;
}

export interface TradeContext {
  companyId?: string;
  branchId?: string;
}

export type TradeScopeMode = 'NONE' | 'COMPANY' | 'BRANCH' | 'OPTIONAL';

/** Missing required ids raise client-only 400 TRADE.SCOPE.REQUIRED before a request. */
export function scopeFor(ctx: TradeContext, mode: TradeScopeMode): TradeContext | undefined {
  if (mode === 'NONE') return undefined;
  if ((mode === 'COMPANY' && !ctx.companyId) || (mode === 'BRANCH' && (!ctx.companyId || !ctx.branchId))) {
    throw new ApiError(400, 'TRADE.SCOPE.REQUIRED');
  }
  return {
    ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
    ...(mode !== 'COMPANY' && ctx.branchId ? { branchId: ctx.branchId } : {}),
  };
}

export function tradeContext(scope: ScopeState, target: 'TENANT' | 'COMPANY' | 'BRANCH'): TradeContext {
  if (target === 'TENANT') {
    return {};
  }
  const companyId = scope.company()?.id;
  if (target === 'COMPANY') {
    return companyId ? { companyId } : {};
  }
  const branchId = scope.branch()?.id;
  const ctx: TradeContext = {};
  if (companyId) ctx.companyId = companyId;
  if (branchId) ctx.branchId = branchId;
  return ctx;
}

export function contextHeaders(ctx: TradeContext): Record<string, string> {
  const headers: Record<string, string> = {};
  if (ctx.companyId) headers['x-mutakamel-company-id'] = ctx.companyId;
  if (ctx.branchId) headers['x-mutakamel-branch-id'] = ctx.branchId;
  return headers;
}

const KNOWN_ERROR_KEYS: ReadonlySet<string> = new Set([
  'TRADE_VALIDATION_FAILED',
  'TRADE_EXTENSION',
  'TRADE_AUTH_CONTEXT_REQUIRED',
  'TRADE_AUTH_CONTEXT_REQUIRED',
  'TRADE_AUTH_TARGET_DENIED',
  'TRADE_AUTH_TARGET_INVALID',
  'TRADE_CONCURRENCY_STALE_VERSION',
  'TRADE_CONCURRENCY_IF_MATCH_REQUIRED',
  'TRADE_IDEMPOTENCY_KEY_MISSING',
  'TRADE_IDEMPOTENCY_KEY_REQUIRED',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_IDEMPOTENCY_IN_FLIGHT',
  'TRADE_CONTEXT_INVALID_ID',
  'TRADE_CONTEXT_MISSING_COMPANY',
  'TRADE_CONTEXT_MISSING_BRANCH',
  'TRADE_CONTEXT_SCOPE_NOT_FOUND',
  'TRADE_CONTEXT_BRANCH_COMPANY_MISMATCH',
  'TRADE_CONTEXT_EXECUTION_TARGET_MISMATCH',
  'TRADE_CONTEXT_EXECUTION_TARGET_INVALID',
  'TRADE_CONTEXT_SCOPE_INACTIVE',
  'TRADE_CONTEXT_COMPANY_REQUIRED',
  'TRADE_DEPENDENCY_TIMEOUT',
  'TRADE_DEPENDENCY_ENTITLEMENT_UNAVAILABLE',
  'TRADE_DEPENDENCY_NUMBERING_UNAVAILABLE',
  'TRADE_ENTITLEMENT_FEATURE_REQUIRED',
  'TRADE_ENTITLEMENT_PUBLICATION_UNAVAILABLE',
  'TRADE_MODULE_DISABLED',
  'TRADE_PROVISIONING_MAINTENANCE_ACTIVE',
  'TRADE_CATALOG_ITEM_NOT_FOUND',
  'TRADE_CATALOG_CODE_TAKEN',
  'TRADE_CATALOG_ITEM_IDENTITY_CONFLICT',
  'TRADE_CATALOG_ITEM_IDENTITY_INVALID',
  'TRADE_CATALOG_ITEM_REFERENCE_INVALID',
  'TRADE_CATALOG_UOM_INVALID',
  'TRADE_CATALOG_UOM_CODE_TAKEN',
  'TRADE_CATALOG_UOM_RETIRE_REFERENCED',
  'TRADE_CATALOG_COMPANY_PROFILE_ALREADY_EXISTS',
  'TRADE_CATALOG_COMPANY_PROFILE_NOT_FOUND',
  'TRADE_CATALOG_COMPANY_PROFILE_INVALID',
  'TRADE_CATALOG_CAPABILITY_INCOMPATIBLE',
  'TRADE_CATALOG_TRACKING_LOCKED',
  'TRADE_CATALOG_BRANCH_PROFILE_ALREADY_EXISTS',
  'TRADE_CATALOG_BRANCH_PROFILE_NOT_FOUND',
  'TRADE_CATALOG_BRANCH_MISMATCH',
  'TRADE_CATALOG_CHANNEL_INVALID',
  'TRADE_CATALOG_CHANNEL_LISTING_INVALID',
  'TRADE_CATALOG_CHANNEL_LISTING_ALREADY_EXISTS',
  'TRADE_CATALOG_CHANNEL_LISTING_NOT_FOUND',
  'TRADE_CATALOG_CHANNEL_NOT_FOUND',
  'TRADE_CATALOG_CHANNEL_BRANCH_ALREADY_EXISTS',
  'TRADE_CATALOG_CHANNEL_BRANCH_NOT_FOUND',
  'TRADE_CATALOG_ITEM_IMAGE_REQUIRED',
  'TRADE_CATALOG_ITEM_IMAGE_TOO_LARGE',
  'TRADE_CATALOG_ITEM_IMAGE_INVALID',
  'TRADE_CATALOG_ITEM_IMAGE_NOT_FOUND',
  'TRADE_CATALOG_ITEM_IMAGE_STORAGE_UNAVAILABLE',
  'TRADE_CATALOG_ITEM_IMAGE_PRINT_BUDGET_EXCEEDED',
  'TRADE_CATALOG_CATEGORY_INVALID',
  'TRADE_CATALOG_CATEGORY_NOT_FOUND',
  'TRADE_CATALOG_CATEGORY_CODE_TAKEN',
  'TRADE_CATALOG_CATEGORY_NAME_TAKEN',
  'TRADE_CATALOG_CATEGORY_PARENT_INVALID',
  'TRADE_CATALOG_CATEGORY_PARENT_INACTIVE',
  'TRADE_CATALOG_CATEGORY_CYCLE',
  'TRADE_CATALOG_CATEGORY_DEPTH_EXCEEDED',
  'TRADE_CATALOG_CATEGORY_LIMIT_EXCEEDED',
  'TRADE_CATALOG_CATEGORY_ORDER_INVALID',
  'TRADE_CATALOG_CATEGORY_ASSIGNMENT_INVALID',
  'TRADE_CATALOG_CATEGORY_DELETE_BLOCKED',
  'TRADE_CATALOG_CATEGORY_QUERY_INVALID',
  'TRADE_CATALOG_CATEGORY_WRITE_BUSY',
  'TRADE_ACCOUNT_ALREADY_EXISTS',
  'TRADE_ACCOUNT_NOT_FOUND',
  'TRADE_ACCOUNT_PARTY_ROLE_INVALID',
  'TRADE_ACCOUNT_CREDIT_LIMIT_INVALID',
  'TRADE_ACCOUNT_PRICE_BOOK_INCOMPATIBLE',
  'TRADE_ACCOUNT_TERM_INVALID',
  'TRADE_ACCOUNT_BLOCK_TRANSITION_INVALID',
  'TRADE_ACCOUNT_BRANCH_RULE_ALREADY_EXISTS',
  'TRADE_ACCOUNT_BRANCH_RULE_NOT_FOUND',
  'TRADE_ACCOUNT_BRANCH_RULE_WEAKENS_POLICY',
  'TRADE_ACCOUNT_BLOCKED',
  'TRADE_CREDIT_EXPOSURE_UNAVAILABLE',
  'TRADE_QUOTE_COMMERCIAL_ACCOUNT_BLOCKED',
  'TRADE_SALES_ORDER_COMMERCIAL_ACCOUNT_REQUIRED',
  'TRADE_CONFIGURATION_DEFINITION_INVALID',
  'TRADE_CONFIGURATION_DEFINITION_NOT_FOUND',
  'TRADE_CONFIGURATION_KEY_TAKEN',
  'TRADE_CONFIGURATION_VALUE_INVALID',
  'TRADE_CONFIGURATION_SCOPE_FORBIDDEN',
  'TRADE_CONFIGURATION_EFFECTIVE_OVERLAP',
  'TRADE_CONFIGURATION_TEST_FAILED',
  'TRADE_CONFIGURATION_PUBLISH_NOT_ALLOWED',
  'TRADE_CONFIGURATION_DEFAULT_PRICE_BOOK_NOT_FOUND',
  'TRADE_CONFIGURATION_DEFAULT_PRICE_BOOK_INCOMPATIBLE',
  'TRADE_APPROVAL_MAKER_CHECKER_REQUIRED',
  'TRADE_APPROVAL_REJECTED',
  'TRADE_DASHBOARD_NOT_FOUND',
  'TRADE_DASHBOARD_NAME_CONFLICT',
  'TRADE_DASHBOARD_DEFINITION_INVALID',
  'TRADE_DASHBOARD_LIMIT_EXCEEDED',
  'TRADE_DASHBOARD_REVISION_CONFLICT',
  'TRADE_DASHBOARD_LAYOUT_INVALID',
  'TRADE_DASHBOARD_LAYOUT_OVERLAP',
  'TRADE_DASHBOARD_WIDGET_INVALID',
  'TRADE_DASHBOARD_WIDGET_ALREADY_PLACED',
  'TRADE_DASHBOARD_WIDGET_UNAVAILABLE',
  'TRADE_DASHBOARD_WIDGET_ACCESS_DENIED',
  'TRADE_DASHBOARD_METRIC_NOT_REGISTERED',
  'TRADE_DASHBOARD_METRIC_INCOMPATIBLE',
  'TRADE_DASHBOARD_METRIC_PERMISSION_REQUIRED',
  'TRADE_DASHBOARD_VISUALIZATION_INCOMPATIBLE',
  'TRADE_DASHBOARD_FILTER_INVALID',
  'TRADE_DASHBOARD_SCOPE_INVALID',
  'TRADE_DASHBOARD_SCOPE_DENIED',
  'TRADE_DASHBOARD_SCOPE_EMPTY',
  'TRADE_DASHBOARD_SCOPE_TRUNCATED',
  'TRADE_DASHBOARD_SCOPE_TARGET_OMITTED',
  'TRADE_DASHBOARD_COMPANY_BRANCH_MISMATCH',
  'TRADE_DASHBOARD_SOURCE_UNAVAILABLE',
  'TRADE_DASHBOARD_SOURCE_PERMISSION_REQUIRED',
  'TRADE_DASHBOARD_EXECUTION_FAILED',
  'TRADE_DASHBOARD_EXECUTION_BUDGET_EXCEEDED',
  'TRADE_DASHBOARD_SHARE_TARGET_INVALID',
  'TRADE_DASHBOARD_SHARE_ACCESS_INVALID',
  'TRADE_DASHBOARD_TRANSITIVE_SHARE_FORBIDDEN',
  'TRADE_DASHBOARD_WIDGET_NOT_FOUND',
  'TRADE_DASHBOARD_MULTI_COMPANY_AGGREGATION_FORBIDDEN',
  'TRADE_DASHBOARD_CURRENCY_MERGE_FORBIDDEN',
  'TRADE_DASHBOARD_SOURCE_STALE',
  'TRADE_DASHBOARD_DRILL_TARGET_INVALID',
  'TRADE_REASON_NOT_FOUND',
  'TRADE_REASON_INACTIVE',
  'TRADE_REASON_NOTE_REQUIRED',
  'TRADE_REASON_CODE_TAKEN',
  'TRADE_REASON_KIND_INVALID',
  'TRADE_REASON_SYSTEM_IMMUTABLE',
  'TRADE_TERMS_NOT_FOUND',
  'TRADE_TERMS_SELECTION_INVALID',
  'TRADE_TERMS_PAYMENT_REQUIRED',
  'TRADE_TERMS_SOURCE_LOCKED',
  'TRADE_TERMS_SNAPSHOT_TOO_LARGE',
  'TRADE_TERMS_NOTE_TOO_LONG',
  'TRADE_BULK_JOB_ACTIVE',
]);

export function errorKey(e: unknown): string {
  if (!(e instanceof ApiError)) {
    return 'tradeShared.errors.network';
  }
  if (e.code.startsWith('TRADE.EXTENSION.')) {
    return 'tradeShared.errors.TRADE_EXTENSION';
  }
  const normalized = e.code.replaceAll('.', '_');
  if (KNOWN_ERROR_KEYS.has(normalized)) {
    return `tradeShared.errors.${normalized}`;
  }
  if (e.status === 403) {
    return 'tradeShared.errors.permission';
  }
  if (e.status === 404) {
    return 'tradeShared.errors.notFound';
  }
  return 'tradeShared.errors.generic';
}
