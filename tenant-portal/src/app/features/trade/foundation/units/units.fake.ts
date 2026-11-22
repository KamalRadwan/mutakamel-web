import { ApiError, assertIdempotencyKey, fakeDelay, fakeId, parseIfMatch } from '../../shared/trade-api';
import { TRADE_FAKE_DB, bumpVersion, clone, nowIso } from '../../shared/trade-foundation.fake';
import type { LocalizedNames, StatusCounts, Uom, UomStatus } from '../../shared/trade-foundation.model';
import {
  UOM_CODE_CANONICAL_PATTERN,
  UOM_CODE_PATTERN,
  UOM_LIMITS,
  UOM_LOCALE_KEY_PATTERN,
  UOM_REF_KEYS,
  filterUomsBySearch,
  type CreateUomBody,
  type UomListPage,
  type UomRefKey,
  type UomReferenceGroup,
  type UomReferences,
  type UpdateUomBody,
} from './units.model';

const idempotencyStore = new Map<string, { bodyJson: string; result: Uom }>();

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) {
        out[key] = sortValue(entry);
      }
    }
    return out;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function invalid(field: string): ApiError {
  return new ApiError(400, 'TRADE.VALIDATION_FAILED', { [field]: ['invalid'] });
}

function assertPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw invalid(field);
  }
  return value;
}

function assertAllowedKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key) || obj[key] === null) {
      throw invalid(key);
    }
  }
}

/** DTO `@IsString() @MinLength(1) @MaxLength(160)` on the raw value is the 400; the trimmed value is checked by the service (422). */
function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > UOM_LIMITS.nameMax) {
    throw invalid('displayName');
  }
  const trimmed = raw.trim();
  if (trimmed.length < 1) {
    throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
  }
  return trimmed;
}

function normalizeLocalizedNames(raw: unknown): LocalizedNames {
  const obj = assertPlainObject(raw, 'localizedNames');
  const entries = Object.entries(obj);
  if (entries.length < UOM_LIMITS.localizedMin || entries.length > UOM_LIMITS.localizedMax) {
    throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
  }

  const normalized: LocalizedNames = {};
  for (const [localeKey, value] of entries) {
    if (typeof value !== 'string' || !UOM_LOCALE_KEY_PATTERN.test(localeKey)) {
      throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
    }
    const trimmed = value.trim();
    if (trimmed.length < 1 || trimmed.length > UOM_LIMITS.nameMax) {
      throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
    }
    normalized[localeKey] = trimmed;
  }

  return normalized;
}

function localizedNamesEqual(a: LocalizedNames, b: LocalizedNames): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => b[key] === a[key]);
}

function computeUomReferences(id: string): UomReferences {
  let itemBase = 0;
  for (const item of TRADE_FAKE_DB.items) {
    if (item.deletedAt === null && item.baseUomId === id) {
      itemBase += 1;
    }
  }

  let companyDefault = 0;
  for (const profile of TRADE_FAKE_DB.companyProfiles) {
    if (profile.defaultSalesUomId === id || profile.defaultPurchaseUomId === id) {
      companyDefault += 1;
    }
  }

  const countsByKey: Record<UomRefKey, number> = {
    ITEM_BASE: itemBase,
    COMPANY_DEFAULT: companyDefault,
    PRICE_ENTRY: 0,
    PURCHASE_QUOTATION_DRAFT: 0,
    QUOTATION_OPEN: 0,
    ORDER_OPEN: 0,
    SALES_INVOICE_DRAFT: 0,
    CONVERSION: id === 'uom-kg' ? 2 : 0,
    STOCK: id === 'uom-kg' ? 1 : 0,
    RESERVATION: 0,
  };

  // References the fake cannot count (other documents) are shown as price entries.
  if (TRADE_FAKE_DB.uomExternalRefs.includes(id)) {
    countsByKey.PRICE_ENTRY += 1;
  }
  // Backend uomReferences: GROUP BY over the reference rows, so only kinds with a count are returned, by key.
  const groups: UomReferenceGroup[] = UOM_REF_KEYS.filter((key) => countsByKey[key] > 0)
    .sort()
    .map((key) => ({ key, count: countsByKey[key] }));
  return { blocking: groups.length > 0, groups };
}

function refGroupsToErrorDetails(groups: readonly UomReferenceGroup[]): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const group of groups) {
    if (group.count > 0) {
      details[group.key] = [String(group.count)];
    }
  }
  return details;
}

// GET /api/tenant/trade/v1/uoms?page=1&limit=100&search= (Gateway mode NONE: no company or branch header)
export async function fakeListUomsPage(page = 1, limit = 100, search?: string): Promise<UomListPage> {
  await fakeDelay();
  if (search !== undefined) {
    if (typeof search !== 'string' || search.trim().length > UOM_LIMITS.searchMax) {
      throw invalid('search');
    }
  }
  if (!Number.isInteger(page) || page < 1) throw invalid('page');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('limit');
  const matched = filterUomsBySearch(TRADE_FAKE_DB.uoms, search ?? '');
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit);
  return clone({
    items,
    total: matched.length,
    page,
    limit,
    source: 'AUTHORIZED_TRADE_UOM_MASTER',
  });
}

// GET /api/tenant/trade/v1/uoms/status-counts (Gateway mode NONE: no company or branch header)
export async function fakeCountUoms(): Promise<StatusCounts<'ACTIVE' | 'RETIRED'>> {
  await fakeDelay();
  let active = 0;
  let retired = 0;
  for (const uom of TRADE_FAKE_DB.uoms) {
    if (uom.status === 'ACTIVE') {
      active += 1;
    } else {
      retired += 1;
    }
  }
  return clone({
    ACTIVE: active,
    RETIRED: retired,
    total: active + retired,
  });
}

// GET /api/tenant/trade/v1/uoms/:id/references (Gateway mode NONE: no company or branch header)
export async function fakeUomReferences(id: string): Promise<UomReferences> {
  await fakeDelay();
  const found = TRADE_FAKE_DB.uoms.find((uom) => uom.id === id);
  if (!found) {
    throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
  }
  return clone(computeUomReferences(found.id));
}

// GET /api/tenant/trade/v1/uoms/:id
export async function fakeGetUom(id: string): Promise<Uom> {
  await fakeDelay();
  const found = TRADE_FAKE_DB.uoms.find((uom) => uom.id === id);
  if (!found) {
    throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
  }
  return clone(found);
}

// POST /api/tenant/trade/v1/uoms (header x-idempotency-key; Gateway mode NONE)
export async function fakeCreateUom(body: CreateUomBody, idempotencyKey: string): Promise<Uom> {
  await fakeDelay();

  // Backend: ValidationPipe, then requireIdempotencyKey (400 missing), then DomainIdempotencyService (422 not UUIDv7).
  const key = `catalog.uom.create:${assertIdempotencyKey(idempotencyKey)}`;

  const bodyJson = canonicalJson(body);
  const existing = idempotencyStore.get(key);
  if (existing) {
    if (existing.bodyJson !== bodyJson) {
      throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
    }
    return clone(existing.result);
  }

  const obj = assertPlainObject(body, 'body');
  assertAllowedKeys(obj, new Set(['code', 'displayName', 'localizedNames']));

  const rawCode = obj['code'];
  if (typeof rawCode !== 'string' || !rawCode || rawCode.length > UOM_LIMITS.codeMax || !UOM_CODE_PATTERN.test(rawCode)) {
    throw invalid('code');
  }
  const code = rawCode.trim().toUpperCase();
  if (!UOM_CODE_CANONICAL_PATTERN.test(code)) {
    throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
  }

  const displayName = normalizeDisplayName(obj['displayName']);
  const localizedNames = normalizeLocalizedNames(obj['localizedNames']);

  if (TRADE_FAKE_DB.uoms.some((uom) => uom.code.toUpperCase() === code)) {
    throw new ApiError(409, 'TRADE.CATALOG.UOM_CODE_TAKEN');
  }

  const created: Uom = {
    id: fakeId(),
    code,
    displayName,
    localizedNames,
    status: 'ACTIVE',
    version: 1,
    updatedAt: nowIso(),
  };

  TRADE_FAKE_DB.uoms.push(created);
  idempotencyStore.set(key, { bodyJson, result: clone(created) });
  return clone(created);
}

// PATCH /api/tenant/trade/v1/uoms/:id (headers x-idempotency-key + If-Match)
export async function fakeUpdateUom(
  id: string,
  body: UpdateUomBody,
  ifMatchHeader: string,
  idempotencyKey: string,
): Promise<Uom> {
  await fakeDelay();

  // Backend order: ValidationPipe, key (400 missing), If-Match (400), then the idempotency record (422 not UUIDv7).
  const rawKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!rawKey) {
    throw new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING');
  }
  const expectedVersion = parseIfMatch(ifMatchHeader);
  const key = `catalog.uom.update:${id}:${assertIdempotencyKey(rawKey)}`;

  const bodyJson = canonicalJson({ expectedVersion, body });
  const existing = idempotencyStore.get(key);
  if (existing) {
    if (existing.bodyJson !== bodyJson) {
      throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
    }
    return clone(existing.result);
  }

  const obj = assertPlainObject(body, 'body');
  assertAllowedKeys(obj, new Set(['displayName', 'localizedNames', 'status']));

  const nextDisplayName = obj['displayName'] !== undefined ? normalizeDisplayName(obj['displayName']) : undefined;
  const nextLocalizedNames =
    obj['localizedNames'] !== undefined ? normalizeLocalizedNames(obj['localizedNames']) : undefined;

  let nextStatus: UomStatus | undefined;
  if (obj['status'] !== undefined) {
    if (obj['status'] !== 'ACTIVE' && obj['status'] !== 'RETIRED') {
      throw invalid('status');
    }
    nextStatus = obj['status'];
  }

  const row = TRADE_FAKE_DB.uoms.find((uom) => uom.id === id);
  if (!row) {
    throw new ApiError(422, 'TRADE.CATALOG.UOM_INVALID');
  }

  if (row.version !== expectedVersion) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  if (row.status === 'ACTIVE' && nextStatus === 'RETIRED') {
    const refs = computeUomReferences(row.id);
    if (refs.blocking) {
      const details = refGroupsToErrorDetails(refs.groups);
      throw new ApiError(
        409,
        'TRADE.CATALOG.UOM_RETIRE_REFERENCED',
        Object.keys(details).length > 0 ? details : undefined,
      );
    }
  }

  const displayNameChanged = nextDisplayName !== undefined && nextDisplayName !== row.displayName;
  const localizedNamesChanged =
    nextLocalizedNames !== undefined && !localizedNamesEqual(nextLocalizedNames, row.localizedNames);
  const statusChanged = nextStatus !== undefined && nextStatus !== row.status;

  if (!displayNameChanged && !localizedNamesChanged && !statusChanged) {
    idempotencyStore.set(key, { bodyJson, result: clone(row) });
    return clone(row);
  }

  if (displayNameChanged && nextDisplayName !== undefined) {
    row.displayName = nextDisplayName;
  }
  if (localizedNamesChanged && nextLocalizedNames !== undefined) {
    row.localizedNames = clone(nextLocalizedNames);
  }
  if (statusChanged && nextStatus !== undefined) {
    row.status = nextStatus;
  }

  bumpVersion(row);
  idempotencyStore.set(key, { bodyJson, result: clone(row) });
  return clone(row);
}
