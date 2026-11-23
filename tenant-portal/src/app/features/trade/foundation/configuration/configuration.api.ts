import type { CoreQuery } from '../../../../core/api/core-http';
import {
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  type TradeContext,
} from '../../shared/trade-api';
import type { Page } from '../../shared/trade-foundation.model';
import { tradeHttp } from '../../shared/trade-http';
import type {
  ConfigDefinition,
  ConfigDefinitionDetail,
  ConfigVersion,
  CreateDefinitionBody,
  CreatedConfigDefinition,
  CreatedConfigVersion,
  CreateVersionBody,
  EffectiveVersionState,
  ListDefinitionsQuery,
  MergeStrategy,
  PublishedConfigVersion,
  PublishVersionBody,
  RawConfigVersion,
  RiskClass,
  ScopeTarget,
  TestResult,
  ValueSchema,
  VersionStatus,
  VersionTestEvidence,
} from './configuration.model';

interface WireVersionTestEvidence {
  passed: boolean;
  diagnostics?: unknown;
  testedAt: string;
  testedBy?: string | null;
}

interface WireConfigVersion {
  id: string;
  versionNumber: number;
  version: number;
  scopeTarget: ScopeTarget;
  companyId?: string | null;
  branchId?: string | null;
  channelId?: string | null;
  value: unknown;
  status: VersionStatus;
  effectiveState: EffectiveVersionState;
  effectiveFrom: string;
  effectiveTo?: string | null;
  supersededAt?: string | null;
  supersededByVersionId?: string | null;
  contentHash: string;
  createdBy?: string | null;
  createdByName?: string | null;
  testEvidence?: WireVersionTestEvidence | null;
}

interface WireRawConfigVersion {
  id: string;
  definitionId: string;
  versionNumber: number;
  version: number;
  scopeTarget: ScopeTarget;
  companyId?: string | null;
  branchId?: string | null;
  channelId?: string | null;
  value: unknown;
  status: VersionStatus;
  effectiveFrom: string;
  effectiveTo?: string | null;
  supersededAt?: string | null;
  supersededByVersionId?: string | null;
  contentHash: string;
  createdBy?: string | null;
}

interface WireConfigDefinition {
  id: string;
  key: string;
  valueSchema: ValueSchema;
  allowedScopes: readonly ScopeTarget[];
  mergeStrategy: MergeStrategy;
  riskClass: RiskClass;
  companyLockPolicy?: { requireCompanyBaseline?: boolean };
  version: number;
  versions?: readonly WireConfigVersion[];
}

interface WireTestResult {
  evidenceId: string;
  passed: boolean;
  diagnostics?: unknown;
  mergeStrategy: MergeStrategy;
  contentHash: string;
  version: number;
}

interface WirePublishedConfigVersion extends WireRawConfigVersion {
  configurationEpoch: number;
}

function normalizeDiagnostics(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      out.push(...normalizeDiagnostics(item));
    }
    return out;
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    if ('diagnostics' in record) {
      return normalizeDiagnostics(record['diagnostics']);
    }
    const out: string[] = [];
    if (typeof record['code'] === 'string' && record['code'].trim()) {
      out.push(record['code'].trim());
    }
    if (typeof record['path'] === 'string' && record['path'].trim()) {
      out.push(record['path'].trim());
    }
    if (Array.isArray(record['paths'])) {
      for (const pathItem of record['paths']) {
        if (typeof pathItem === 'string' && pathItem.trim()) {
          out.push(pathItem.trim());
        }
      }
    }
    return out;
  }
  return [String(raw)];
}

function mapTestEvidence(raw: WireVersionTestEvidence | null | undefined): VersionTestEvidence | null {
  if (!raw) return null;
  return {
    passed: Boolean(raw.passed),
    diagnostics: normalizeDiagnostics(raw.diagnostics),
    testedAt: raw.testedAt,
    testedBy: raw.testedBy ?? null,
  };
}

function mapConfigVersion(raw: WireConfigVersion): ConfigVersion {
  return {
    id: raw.id,
    versionNumber: raw.versionNumber,
    version: raw.version,
    scopeTarget: raw.scopeTarget,
    companyId: raw.companyId ?? null,
    branchId: raw.branchId ?? null,
    channelId: raw.channelId ?? null,
    value: raw.value,
    status: raw.status,
    effectiveState: raw.effectiveState,
    effectiveFrom: raw.effectiveFrom,
    effectiveTo: raw.effectiveTo ?? null,
    supersededAt: raw.supersededAt ?? null,
    supersededByVersionId: raw.supersededByVersionId ?? null,
    contentHash: raw.contentHash,
    createdBy: raw.createdBy ?? null,
    createdByName: raw.createdByName ?? null,
    testEvidence: mapTestEvidence(raw.testEvidence),
  };
}

function mapRawConfigVersion(raw: WireRawConfigVersion): RawConfigVersion {
  return {
    id: raw.id,
    definitionId: raw.definitionId,
    versionNumber: raw.versionNumber,
    version: raw.version,
    scopeTarget: raw.scopeTarget,
    companyId: raw.companyId ?? null,
    branchId: raw.branchId ?? null,
    channelId: raw.channelId ?? null,
    value: raw.value,
    status: raw.status,
    effectiveFrom: raw.effectiveFrom,
    effectiveTo: raw.effectiveTo ?? null,
    supersededAt: raw.supersededAt ?? null,
    supersededByVersionId: raw.supersededByVersionId ?? null,
    contentHash: raw.contentHash,
    createdBy: raw.createdBy ?? null,
  };
}

function mapConfigDefinition(raw: WireConfigDefinition): ConfigDefinition {
  return {
    id: raw.id,
    key: raw.key,
    valueSchema: raw.valueSchema,
    allowedScopes: [...raw.allowedScopes],
    mergeStrategy: raw.mergeStrategy,
    riskClass: raw.riskClass,
    companyLockPolicy: raw.companyLockPolicy ?? {},
    version: raw.version,
    versions: (raw.versions ?? []).map(mapConfigVersion),
  };
}

function mapCreatedDefinition(raw: WireConfigDefinition): CreatedConfigDefinition {
  return {
    id: raw.id,
    key: raw.key,
    valueSchema: raw.valueSchema,
    allowedScopes: [...raw.allowedScopes],
    mergeStrategy: raw.mergeStrategy,
    riskClass: raw.riskClass,
    companyLockPolicy: raw.companyLockPolicy ?? {},
    version: raw.version,
    ...(raw.versions ? { versions: raw.versions.map(mapConfigVersion) } : {}),
  };
}

function mapTestResult(raw: WireTestResult): TestResult {
  return {
    evidenceId: raw.evidenceId,
    passed: Boolean(raw.passed),
    diagnostics: normalizeDiagnostics(raw.diagnostics),
    mergeStrategy: raw.mergeStrategy,
    contentHash: raw.contentHash,
    version: raw.version,
  };
}

function buildListQuery(query: ListDefinitionsQuery): CoreQuery | undefined {
  const params: CoreQuery = {};
  if (query.page !== undefined) params['page'] = query.page;
  if (query.limit !== undefined) params['limit'] = query.limit;
  return Object.keys(params).length > 0 ? params : undefined;
}

// GET /api/tenant/trade/v1/configuration/definitions?page&limit (OPTIONAL_COMPANY_BRANCH)
export async function listDefinitions(
  ctx: TradeContext,
  query: ListDefinitionsQuery = {},
): Promise<Page<ConfigDefinition>> {
  const res = await tradeHttp().read<Page<WireConfigDefinition>>(
    '/configuration/definitions',
    buildListQuery(query),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return {
    items: res.items.map(mapConfigDefinition),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// GET /api/tenant/trade/v1/configuration/definitions/:id (OPTIONAL_COMPANY_BRANCH)
export async function getDefinition(
  id: string,
  ctx: TradeContext = {},
): Promise<ConfigDefinitionDetail> {
  const raw = await tradeHttp().read<WireConfigDefinition>(
    `/configuration/definitions/${encodeURIComponent(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return mapConfigDefinition(raw);
}

// POST /api/tenant/trade/v1/configuration/definitions (x-idempotency-key; Gateway mode NONE)
export async function createDefinition(
  body: CreateDefinitionBody,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<CreatedConfigDefinition> {
  if (body.companyLockPolicy?.requireCompanyBaseline !== undefined) {
    assertBodyBooleans(body.companyLockPolicy, ['requireCompanyBaseline']);
  }
  const companyLockPolicy: { requireCompanyBaseline?: boolean } =
    body.companyLockPolicy?.requireCompanyBaseline !== undefined
      ? { requireCompanyBaseline: body.companyLockPolicy.requireCompanyBaseline }
      : {};
  const payload: CreateDefinitionBody = {
    key: body.key,
    valueSchema: body.valueSchema,
    allowedScopes: [...body.allowedScopes],
    mergeStrategy: body.mergeStrategy,
    riskClass: body.riskClass,
    companyLockPolicy,
  };
  const { data } = await tradeHttp().write<WireConfigDefinition>(
    'POST',
    '/configuration/definitions',
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor({}, 'NONE'),
    },
  );
  return mapCreatedDefinition(data);
}

// POST /api/tenant/trade/v1/configuration/definitions/:id/versions (OPTIONAL_COMPANY_BRANCH, If-Match: definitionVersion, x-idempotency-key)
export async function createVersion(
  ctx: TradeContext,
  definitionId: string,
  definitionVersion: number,
  body: CreateVersionBody,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<CreatedConfigVersion> {
  const payload: CreateVersionBody = {
    scopeTarget: body.scopeTarget,
    value: body.value,
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo ?? null,
  };
  const { data } = await tradeHttp().write<WireRawConfigVersion>(
    'POST',
    `/configuration/definitions/${encodeURIComponent(definitionId)}/versions`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(definitionVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return mapRawConfigVersion(data);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/test (OPTIONAL_COMPANY_BRANCH, If-Match: rowVersion, x-idempotency-key; empty body)
export async function testVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TestResult> {
  const { data } = await tradeHttp().write<WireTestResult>(
    'POST',
    `/configuration/versions/${encodeURIComponent(versionId)}/test`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(rowVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return mapTestResult(data);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/publish (OPTIONAL_COMPANY_BRANCH, If-Match: rowVersion, x-idempotency-key)
export async function publishVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  body: PublishVersionBody,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<PublishedConfigVersion> {
  const payload: PublishVersionBody = body.supersedesVersionId
    ? { supersedesVersionId: body.supersedesVersionId }
    : {};
  const { data } = await tradeHttp().write<WirePublishedConfigVersion>(
    'POST',
    `/configuration/versions/${encodeURIComponent(versionId)}/publish`,
    payload,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(rowVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return {
    ...mapRawConfigVersion(data),
    configurationEpoch: data.configurationEpoch,
  };
}

// POST /api/tenant/trade/v1/configuration/versions/:id/retire (OPTIONAL_COMPANY_BRANCH, If-Match: rowVersion, x-idempotency-key)
export async function retireVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<ConfigVersion> {
  const { data } = await tradeHttp().write<WireConfigVersion>(
    'POST',
    `/configuration/versions/${encodeURIComponent(versionId)}/retire`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(rowVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return mapConfigVersion(data);
}

// POST /api/tenant/trade/v1/configuration/versions/:id/cancel (OPTIONAL_COMPANY_BRANCH, If-Match: rowVersion, x-idempotency-key)
export async function cancelVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<ConfigVersion> {
  const { data } = await tradeHttp().write<WireConfigVersion>(
    'POST',
    `/configuration/versions/${encodeURIComponent(versionId)}/cancel`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: ifMatch(rowVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return mapConfigVersion(data);
}
