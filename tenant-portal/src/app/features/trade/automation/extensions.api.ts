import type { CoreQuery } from '../../../core/api/core-http';
import {
  ApiError,
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../shared/trade-api';
import type { Page } from '../shared/trade-foundation.model';
import { tradeHttp } from '../shared/trade-http';
import type {
  CreateExtensionProfileInput,
  ExtensionDraftDiscardResult,
  ExtensionField,
  ExtensionFieldInput,
  ExtensionProfile,
  ExtensionProfileCounts,
  ExtensionProfileDraftResult,
  ExtensionProfileEntity,
  ExtensionProfileFilters,
  ExtensionProfilePublishResult,
  ExtValidateResult,
  ExtVersion,
  ListExtensionProfilesQuery,
  ListExtVersionsQuery,
} from './extensions.model';
import type { ExtensionTargetsResponse } from './extensions.registry';

export const EXTENSIONS_QUERY_KEYS = {
  all: ['trade', 'automation', 'extensions'] as const,
  targets: () => ['trade', 'automation', 'extensions', 'targets'] as const,
  counts: (q?: ExtensionProfileFilters) =>
    ['trade', 'automation', 'extensions', 'counts', q ?? {}] as const,
  list: (q?: ListExtensionProfilesQuery) =>
    ['trade', 'automation', 'extensions', 'list', q ?? {}] as const,
  detail: (id: string) => ['trade', 'automation', 'extensions', 'detail', id] as const,
  versions: (id: string, q?: ListExtVersionsQuery) =>
    ['trade', 'automation', 'extensions', 'versions', id, q ?? {}] as const,
  version: (id: string, versionId: string) =>
    ['trade', 'automation', 'extensions', 'version', id, versionId] as const,
};

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function compactQuery(
  entries: Record<string, string | number | boolean | undefined>,
): CoreQuery | undefined {
  const result: CoreQuery = {};
  let count = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    result[k] = v;
    count += 1;
  }
  return count > 0 ? result : undefined;
}

function requireIfMatchHeader(version: number): string {
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  return ifMatch(version);
}

function sanitizeFieldInput(field: ExtensionFieldInput): ExtensionFieldInput {
  assertBodyBooleans(field, ['isRequired', 'isSearchable']);
  return {
    fieldKey: field.fieldKey,
    valueKind: field.valueKind,
    ...(field.scalarType !== undefined ? { scalarType: field.scalarType } : {}),
    ...(field.schemaCode !== undefined ? { schemaCode: field.schemaCode } : {}),
    ...(field.schemaVersion !== undefined ? { schemaVersion: field.schemaVersion } : {}),
    ...(field.isRequired !== undefined ? { isRequired: field.isRequired } : {}),
    ...(field.isSearchable !== undefined ? { isSearchable: field.isSearchable } : {}),
    visibilityCode: field.visibilityCode,
    ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
    ...(field.maxItems !== undefined ? { maxItems: field.maxItems } : {}),
    ...(field.decimalScale !== undefined ? { decimalScale: field.decimalScale } : {}),
    ...(field.minimumDecimal !== undefined ? { minimumDecimal: field.minimumDecimal } : {}),
    ...(field.maximumDecimal !== undefined ? { maximumDecimal: field.maximumDecimal } : {}),
    ...(field.defaultStrategy !== undefined ? { defaultStrategy: field.defaultStrategy } : {}),
    ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
    ...(field.constraintPayload !== undefined ? { constraintPayload: field.constraintPayload } : {}),
  };
}

function mapField(field: ExtensionField): ExtensionField {
  return {
    ...field,
    scalarType: field.scalarType ?? null,
    schemaCode: field.schemaCode ?? null,
    schemaVersion: field.schemaVersion ?? null,
    maxLength: field.maxLength ?? null,
    maxItems: field.maxItems ?? null,
    decimalScale: field.decimalScale ?? null,
    minimumDecimal: field.minimumDecimal ?? null,
    maximumDecimal: field.maximumDecimal ?? null,
    defaultValue: field.defaultValue ?? null,
    constraintPayload: field.constraintPayload ?? {},
  };
}

function mapVersion(version: ExtVersion): ExtVersion {
  return {
    ...version,
    compatibilitySummary: version.compatibilitySummary ?? {},
    publishedAt: version.publishedAt ?? null,
    publishedBy: version.publishedBy ?? null,
    ...(version.fields !== undefined ? { fields: version.fields.map(mapField) } : {}),
  };
}

function mapProfile(profile: ExtensionProfile): ExtensionProfile {
  return {
    ...profile,
    companyId: profile.companyId ?? null,
    currentPublishedVersionId: profile.currentPublishedVersionId ?? null,
    currentPublishedVersion: profile.currentPublishedVersion
      ? mapVersion(profile.currentPublishedVersion)
      : null,
    editableDraftVersion: profile.editableDraftVersion
      ? mapVersion(profile.editableDraftVersion)
      : null,
  };
}

// GET /api/tenant/trade/v1/extensions/profiles/counts?targetCode&status
export function getProfileCounts(
  q: ExtensionProfileFilters = {},
  ctx: TradeContext = {},
): Promise<ExtensionProfileCounts> {
  return tradeHttp().read<ExtensionProfileCounts>(
    '/extensions/profiles/counts',
    compactQuery({ targetCode: q.targetCode, status: q.status }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /api/tenant/trade/v1/extensions/targets
export function getTargets(ctx: TradeContext = {}): Promise<ExtensionTargetsResponse> {
  return tradeHttp().read<ExtensionTargetsResponse>('/extensions/targets', undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// GET /api/tenant/trade/v1/extensions/profiles?targetCode&status&page&limit
export async function listProfiles(
  q: ListExtensionProfilesQuery = {},
  ctx: TradeContext = {},
): Promise<Page<ExtensionProfile>> {
  const res = await tradeHttp().read<Page<ExtensionProfile>>(
    '/extensions/profiles',
    compactQuery({
      targetCode: q.targetCode,
      status: q.status,
      page: q.page,
      limit: q.limit,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return {
    items: res.items.map(mapProfile),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/extensions/profiles/:id
export async function getProfile(id: string, ctx: TradeContext = {}): Promise<ExtensionProfile> {
  const raw = await tradeHttp().read<ExtensionProfile>(
    `/extensions/profiles/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapProfile(raw);
}

// GET /api/tenant/trade/v1/extensions/profiles/:id/versions?status&page&limit
export async function listVersions(
  id: string,
  q: ListExtVersionsQuery = {},
  ctx: TradeContext = {},
): Promise<Page<ExtVersion>> {
  const res = await tradeHttp().read<Page<ExtVersion>>(
    `/extensions/profiles/${encodeSeg(id)}/versions`,
    compactQuery({
      page: q.page,
      limit: q.limit,
      status: q.status,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return {
    items: res.items.map(mapVersion),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/extensions/profiles/:id/versions/:versionId
export async function getVersion(
  id: string,
  versionId: string,
  ctx: TradeContext = {},
): Promise<ExtVersion> {
  const raw = await tradeHttp().read<ExtVersion>(
    `/extensions/profiles/${encodeSeg(id)}/versions/${encodeSeg(versionId)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapVersion(raw);
}

// POST /api/tenant/trade/v1/extensions/profiles (X-Idempotency-Key) -> 201
export async function createProfile(
  input: CreateExtensionProfileInput,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ExtensionProfileDraftResult> {
  const body: CreateExtensionProfileInput = {
    code: input.code,
    targetCode: input.targetCode,
    scopeTarget: input.scopeTarget,
    fields: input.fields.map(sanitizeFieldInput),
  };
  const { data } = await tradeHttp().write<ExtensionProfileDraftResult>(
    'POST',
    '/extensions/profiles',
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/extensions/profiles/:id body {fields} (X-Idempotency-Key, If-Match)
export async function updateFields(
  id: string,
  fields: ExtensionFieldInput[],
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ExtensionProfileDraftResult> {
  const body = { fields: fields.map(sanitizeFieldInput) };
  const { data } = await tradeHttp().write<ExtensionProfileDraftResult>(
    'PATCH',
    `/extensions/profiles/${encodeSeg(id)}`,
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/extensions/profiles/:id/validate (X-Idempotency-Key, If-Match)
export async function validate(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ExtValidateResult> {
  const { data } = await tradeHttp().write<ExtValidateResult>(
    'POST',
    `/extensions/profiles/${encodeSeg(id)}/validate`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/extensions/profiles/:id/publish (X-Idempotency-Key, If-Match)
export async function publish(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ExtensionProfilePublishResult> {
  const { data } = await tradeHttp().write<ExtensionProfilePublishResult>(
    'POST',
    `/extensions/profiles/${encodeSeg(id)}/publish`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// DELETE /api/tenant/trade/v1/extensions/profiles/:id/draft (X-Idempotency-Key, If-Match)
export async function discardDraft(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ExtensionDraftDiscardResult> {
  const { data } = await tradeHttp().write<ExtensionDraftDiscardResult>(
    'DELETE',
    `/extensions/profiles/${encodeSeg(id)}/draft`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/extensions/profiles/:id/retire (X-Idempotency-Key, If-Match)
export async function retire(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<ExtensionProfileEntity> {
  const { data } = await tradeHttp().write<ExtensionProfileEntity>(
    'POST',
    `/extensions/profiles/${encodeSeg(id)}/retire`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}
