import type { CoreQuery } from '../../../core/api/core-http';
import {
  ApiError,
  type TradeContext,
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
} from '../shared/trade-api';
import { tradeHttp } from '../shared/trade-http';
import type {
  CreateProfileInput,
  CreateProfileVersionInput,
  DocumentProfile,
  DocumentProfileRecord,
  ListProfilesQuery,
  ProfileContent,
  ProfileCounts,
  ProfileDeleteResult,
  ProfileEvidenceConfig,
  ProfileFilterQuery,
  ProfileList,
  ProfilePublishResult,
  ProfileValidateResult,
  ProfileVersion,
  ProfileVersionCreated,
  ProfileVersionDetail,
  ProfileWriteOptions,
} from './profiles.model';
import {
  DOCUMENT_TYPES,
  PROFILE_REGISTRY,
  PROFILE_REGISTRY_VERSION,
  type DocumentType,
  type ProfileFamilyRegistry,
  type ProfileModeDef,
  type ProfileRegistry,
} from './profiles.registry';

export const PROFILES_QUERY_KEYS = {
  registry: () => ['trade', 'profiles', 'registry'] as const,
  counts: (q?: ProfileFilterQuery) => ['trade', 'profiles', 'counts', q ?? {}] as const,
  list: (q?: ListProfilesQuery) => ['trade', 'profiles', 'list', q ?? {}] as const,
  profile: (id: string) => ['trade', 'profiles', 'detail', id] as const,
  version: (id: string) => ['trade', 'profiles', 'version', id] as const,
};

interface WireProfileFamilyRegistry {
  fields: readonly string[];
  requiredFields: readonly string[];
  serverOwnedFields: readonly string[];
  components: readonly string[];
  requiredComponents: readonly string[];
  modes: Readonly<Record<string, { allowedValues: readonly (string | boolean)[] }>>;
  evidenceCodes: readonly string[];
  serverCaseCodes: readonly string[];
}

interface WireProfileRegistry {
  registryVersion?: string;
  families: Readonly<Record<string, WireProfileFamilyRegistry | ProfileFamilyRegistry>>;
}

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function compactQuery(
  entries: Record<string, string | number | boolean | undefined>,
): CoreQuery | undefined {
  const result: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    result[k] = v;
    count += 1;
  }
  return count > 0 ? result : undefined;
}

interface ResolvedWriteMeta {
  key: string;
  ifMatchHeader?: string;
  scope: TradeContext | undefined;
}

function resolveWriteMeta(
  ifMatchOrOpts: number | ProfileWriteOptions | undefined,
  idempotencyKey: string | undefined,
  ctx: TradeContext | undefined,
  requireIfMatch: boolean,
): ResolvedWriteMeta {
  const opts =
    typeof ifMatchOrOpts === 'object' && ifMatchOrOpts !== null ? ifMatchOrOpts : undefined;
  const expected = typeof ifMatchOrOpts === 'number' ? ifMatchOrOpts : opts?.ifMatch;
  const explicitKey = idempotencyKey !== undefined ? idempotencyKey : opts?.idempotencyKey;
  const resolvedCtx = ctx ?? opts?.ctx ?? {};

  const key = assertIdempotencyKey(
    explicitKey === undefined ? newIdempotencyKey() : explicitKey,
  );

  let ifMatchHeader: string | undefined;
  if (requireIfMatch) {
    if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 1) {
      throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
    }
    ifMatchHeader = ifMatch(expected);
  }

  return {
    key,
    ifMatchHeader,
    scope: scopeFor(resolvedCtx, 'OPTIONAL'),
  };
}

function isMappedFamily(
  candidate: WireProfileFamilyRegistry | ProfileFamilyRegistry,
): candidate is ProfileFamilyRegistry {
  return Array.isArray((candidate as ProfileFamilyRegistry).modes);
}

function mapFamilyRegistry(
  type: DocumentType,
  raw: WireProfileFamilyRegistry | ProfileFamilyRegistry | undefined,
): ProfileFamilyRegistry {
  const fallback = PROFILE_REGISTRY.families[type];
  if (!raw) return fallback;
  if (isMappedFamily(raw)) return raw;

  const requiredFieldSet = new Set(raw.requiredFields ?? []);
  const serverOwnedSet = new Set(raw.serverOwnedFields ?? []);
  const mandatoryCompSet = new Set(raw.requiredComponents ?? []);

  const fields = (raw.fields ?? []).map((code) => ({
    code,
    familyRequired: requiredFieldSet.has(code),
    serverOwned: serverOwnedSet.has(code),
    defaultVisible: true,
    defaultRequired: requiredFieldSet.has(code),
  }));

  const components = (raw.components ?? []).map((code, idx) => ({
    code,
    mandatory: mandatoryCompSet.has(code),
    defaultOrder: (idx + 1) * 10,
    defaultVisible: true,
  }));

  const modes: ProfileModeDef[] = Object.entries(raw.modes ?? {}).map(([key, def]) => {
    const vals = def.allowedValues ?? [];
    const isBool = vals.length > 0 && vals.every((v) => typeof v === 'boolean');
    const allowedValues = vals.map(String);
    const defaultValue = isBool
      ? vals.includes(true)
        ? true
        : Boolean(vals[0])
      : vals.includes('WORKFLOW')
        ? 'WORKFLOW'
        : String(vals[0] ?? '');
    return {
      key,
      kind: isBool ? 'boolean' : 'enum',
      allowedValues,
      defaultValue,
      locked: vals.length <= 1,
    };
  });

  const evidence = (raw.evidenceCodes ?? []).map((code) => {
    const fallbackItem = fallback.evidence.find((e) => e.code === code);
    return {
      code,
      defaultInclude: fallbackItem?.defaultInclude ?? true,
      defaultRequired: fallbackItem?.defaultRequired ?? false,
    };
  });

  const systemCases = (raw.serverCaseCodes ?? []).map((code) => ({ code }));

  return {
    documentType: type,
    fields,
    components,
    modes,
    evidence,
    systemCases,
  };
}

function mapRegistry(raw: WireProfileRegistry | ProfileRegistry): ProfileRegistry {
  const families = Object.fromEntries(
    DOCUMENT_TYPES.map((type) => [type, mapFamilyRegistry(type, raw.families?.[type])]),
  ) as Record<DocumentType, ProfileFamilyRegistry>;

  return {
    registryVersion: raw.registryVersion ?? PROFILE_REGISTRY_VERSION,
    families,
  };
}

function mapVersion(raw: ProfileVersion): ProfileVersion {
  return {
    ...raw,
    effectiveTo: raw.effectiveTo ?? null,
    supersededAt: raw.supersededAt ?? null,
    supersededByVersionId: raw.supersededByVersionId ?? null,
    validatedBy: raw.validatedBy ?? null,
    publishedBy: raw.publishedBy ?? null,
  };
}

function mapProfile(raw: DocumentProfile): DocumentProfile {
  return {
    ...raw,
    companyId: raw.companyId ?? null,
    currentPublishedVersionId: raw.currentPublishedVersionId ?? null,
    versions: (raw.versions ?? []).map(mapVersion),
  };
}

function mapVersionDetail(raw: ProfileVersionDetail): ProfileVersionDetail {
  return {
    ...mapVersion(raw),
    ...(raw.contentHidden ? { contentHidden: true as const } : {}),
    ...(raw.content !== undefined ? { content: raw.content } : {}),
    requiredCases: raw.requiredCases ?? [],
    latestValidationRun: raw.latestValidationRun ?? null,
    profile: {
      ...raw.profile,
      currentPublishedVersionId: raw.profile.currentPublishedVersionId ?? null,
    },
  };
}

function serializeProfileContent(content: ProfileContent): ProfileContent {
  const fields = content.fields.map((f) => {
    assertBodyBooleans(f, ['required', 'visible']);
    return {
      code: f.code,
      required: f.required,
      visible: f.visible,
    };
  });

  const components = content.components.map((c) => {
    assertBodyBooleans(c, ['visible']);
    return {
      code: c.code,
      order: c.order,
      visible: c.visible,
    };
  });

  const modes: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(content.modes ?? {})) {
    if (value !== undefined) {
      modes[key] = value;
    }
  }

  // G-9: evidence items accept only { code, required }; UI-only `include` is stripped before sending.
  const evidence: ProfileEvidenceConfig[] = [];
  for (const item of content.evidence) {
    assertBodyBooleans(item, ['include', 'required']);
    if (item.include === false) continue;
    evidence.push({
      code: item.code,
      required: item.required,
    });
  }

  return { fields, components, modes, evidence };
}

// GET /api/tenant/trade/v1/document-profiles/registry
export async function getRegistry(ctx: TradeContext = {}): Promise<ProfileRegistry> {
  const raw = await tradeHttp().read<WireProfileRegistry | ProfileRegistry>(
    '/document-profiles/registry',
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapRegistry(raw);
}

// GET /api/tenant/trade/v1/document-profiles/counts?documentType&versionStatus&q
export function getProfileCounts(
  q: ProfileFilterQuery = {},
  ctx: TradeContext = {},
): Promise<ProfileCounts> {
  const query = compactQuery({
    documentType: q.documentType,
    versionStatus: q.versionStatus,
    q: q.q,
  });
  return tradeHttp().read<ProfileCounts>('/document-profiles/counts', query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// GET /api/tenant/trade/v1/document-profiles?documentType&versionStatus&q&page&limit&include
export async function listProfiles(
  q: ListProfilesQuery = {},
  ctx: TradeContext = {},
): Promise<ProfileList> {
  const query = compactQuery({
    documentType: q.documentType,
    versionStatus: q.versionStatus,
    q: q.q,
    page: q.page,
    limit: q.limit,
    include: q.include,
  });
  const res = await tradeHttp().read<ProfileList>('/document-profiles', query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
  return {
    items: res.items.map(mapProfile),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/document-profiles/:id
export async function getProfile(
  id: string,
  ctx: TradeContext = {},
): Promise<DocumentProfile> {
  const raw = await tradeHttp().read<DocumentProfile>(
    `/document-profiles/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapProfile(raw);
}

// POST /api/tenant/trade/v1/document-profiles { code, documentType, scopeTarget }
export async function createProfile(
  input: CreateProfileInput,
  opts?: ProfileWriteOptions | string,
  ctx?: TradeContext,
): Promise<DocumentProfileRecord> {
  const resolvedOpts = typeof opts === 'string' ? { idempotencyKey: opts } : opts;
  const { key, scope } = resolveWriteMeta(resolvedOpts, undefined, ctx, false);
  const body: CreateProfileInput = {
    code: input.code,
    documentType: input.documentType,
    scopeTarget: input.scopeTarget,
  };
  const res = await tradeHttp().write<DocumentProfileRecord>(
    'POST',
    '/document-profiles',
    body,
    { key, scope },
  );
  return {
    ...res.data,
    companyId: res.data.companyId ?? null,
    currentPublishedVersionId: res.data.currentPublishedVersionId ?? null,
  };
}

// POST /api/tenant/trade/v1/document-profiles/:id/versions; If-Match = profile version
export async function createVersion(
  profileId: string,
  input: CreateProfileVersionInput,
  ifMatchOrOpts?: number | ProfileWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<ProfileVersionCreated> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const body: CreateProfileVersionInput = {
    content: serializeProfileContent(input.content),
    ...(input.requiredCases !== undefined
      ? {
          requiredCases: input.requiredCases.map((c) => {
            assertBodyBooleans(c, ['expectedValid']);
            return {
              code: c.code,
              input: { ...c.input },
              expectedValid: c.expectedValid,
            };
          }),
        }
      : {}),
    effectiveFrom: input.effectiveFrom,
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
    ...(input.restoredFromVersionId !== undefined
      ? { restoredFromVersionId: input.restoredFromVersionId }
      : {}),
    ...(input.restorationReason !== undefined
      ? { restorationReason: input.restorationReason }
      : {}),
  };
  const res = await tradeHttp().write<ProfileVersionCreated>(
    'POST',
    `/document-profiles/${encodeSeg(profileId)}/versions`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// GET /api/tenant/trade/v1/document-profile-versions/:id
export async function getVersion(
  id: string,
  ctx: TradeContext = {},
): Promise<ProfileVersionDetail> {
  const raw = await tradeHttp().read<ProfileVersionDetail>(
    `/document-profile-versions/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapVersionDetail(raw);
}

// DELETE /api/tenant/trade/v1/document-profile-versions/:id
export async function deleteVersion(
  id: string,
  ifMatchOrOpts?: number | ProfileWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<ProfileDeleteResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const res = await tradeHttp().write<ProfileDeleteResult>(
    'DELETE',
    `/document-profile-versions/${encodeSeg(id)}`,
    undefined,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// POST /api/tenant/trade/v1/document-profile-versions/:id/validate
export async function validateVersion(
  id: string,
  ifMatchOrOpts?: number | ProfileWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<ProfileValidateResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const res = await tradeHttp().write<ProfileValidateResult>(
    'POST',
    `/document-profile-versions/${encodeSeg(id)}/validate`,
    undefined,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// POST /api/tenant/trade/v1/document-profile-versions/:id/publish { expectedActivePointerVersion }
export async function publishVersion(
  id: string,
  expectedActivePointerVersion: number,
  ifMatchOrOpts?: number | ProfileWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<ProfilePublishResult> {
  if (!Number.isSafeInteger(expectedActivePointerVersion) || expectedActivePointerVersion < 0) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', {
      expectedActivePointerVersion: ['invalid'],
    });
  }
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const res = await tradeHttp().write<ProfilePublishResult>(
    'POST',
    `/document-profile-versions/${encodeSeg(id)}/publish`,
    { expectedActivePointerVersion },
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}
