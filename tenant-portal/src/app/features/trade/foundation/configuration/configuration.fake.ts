import { FAKE_USER, FAKE_USER_ID } from '../../../../core/auth/current-user.fake';
import { ApiError, fakeDelay, fakeId, type TradeContext } from '../../shared/trade-api';
import { TRADE_FAKE_DB, clone, nowIso } from '../../shared/trade-foundation.fake';
import type { Page } from '../../shared/trade-foundation.model';
import type {
  ConfigDefinition,
  ConfigDefinitionDetail,
  ConfigVersion,
  ConfigVersionDetail,
  CreateDefinitionBody,
  CreateVersionBody,
  CreatedConfigVersion,
  ListDefinitionsQuery,
  PublishVersionBody,
  PublishedConfigVersion,
  RiskClass,
  ScopeTarget,
  TestResult,
  VersionTestEvidence,
} from './configuration.model';
import { mergeFitsSchema, stableJson, validateSchemaSubset, validateValue } from './value-schema';
import { versionState } from './version-state';

// "me" is the session user, so the UI maker-checker check (createdBy === CurrentUser.userId()) matches the fake.
const CURRENT_USER_ID = FAKE_USER_ID;
const SARA_USER_ID = 'usr-2';
const OMAR_USER_ID = 'usr-3';

const KEY_PATTERN = /^trade\.[a-z0-9][a-z0-9_.-]{1,110}$/;
const VALID_SCOPES: ReadonlySet<ScopeTarget> = new Set(['TENANT', 'COMPANY', 'BRANCH']);
const VALID_RISKS: ReadonlySet<RiskClass> = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

interface FakeConfigVersion extends Omit<ConfigVersion, 'effectiveState'> {
  createdBy: string;
}

interface FakeConfigDefinition extends Omit<ConfigDefinition, 'versions'> {
  versions: FakeConfigVersion[];
}

function hashValue(value: unknown): string {
  const input = stableJson(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `sha256-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function makeVersion(params: {
  id: string;
  versionNumber: number;
  scopeTarget: ScopeTarget;
  companyId?: string | null;
  branchId?: string | null;
  value: unknown;
  status: ConfigVersion['status'];
  effectiveFrom: string;
  effectiveTo?: string | null;
  supersededAt?: string | null;
  supersededByVersionId?: string | null;
  createdBy?: string;
}): FakeConfigVersion {
  return {
    id: params.id,
    versionNumber: params.versionNumber,
    version: 1,
    scopeTarget: params.scopeTarget,
    companyId: params.companyId ?? null,
    branchId: params.branchId ?? null,
    channelId: null,
    value: params.value,
    status: params.status,
    effectiveFrom: params.effectiveFrom,
    effectiveTo: params.effectiveTo ?? null,
    supersededAt: params.supersededAt ?? null,
    supersededByVersionId: params.supersededByVersionId ?? null,
    contentHash: hashValue(params.value),
    createdBy: params.createdBy ?? OMAR_USER_ID,
  };
}

const SEED_DEFINITIONS: FakeConfigDefinition[] = [
  {
    id: 'cfg-def-1',
    key: 'trade.quotation.default_validity_days',
    valueSchema: { type: 'integer', minimum: 1, maximum: 365 },
    allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
    mergeStrategy: 'MIN',
    riskClass: 'LOW',
    companyLockPolicy: { requireCompanyBaseline: true },
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-1-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: 30,
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-1-2',
        versionNumber: 2,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: 21,
        status: 'PUBLISHED',
        effectiveFrom: '2026-03-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-1-3',
        versionNumber: 3,
        scopeTarget: 'BRANCH',
        companyId: 'c1',
        branchId: 'b1',
        value: 14,
        status: 'TESTED',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        createdBy: SARA_USER_ID,
      }),
      makeVersion({
        id: 'cfg-ver-1-4',
        versionNumber: 4,
        scopeTarget: 'BRANCH',
        companyId: 'c1',
        branchId: 'b1',
        value: 28,
        status: 'DRAFT',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        createdBy: CURRENT_USER_ID,
      }),
    ],
  },
  {
    id: 'cfg-def-2',
    key: 'trade.sales.allow_negative_stock',
    valueSchema: { type: 'boolean' },
    allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
    mergeStrategy: 'DENY_WINS',
    riskClass: 'HIGH',
    companyLockPolicy: { requireCompanyBaseline: false },
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-2-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: false,
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-2-2',
        versionNumber: 2,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: false,
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-2-3',
        versionNumber: 3,
        scopeTarget: 'BRANCH',
        companyId: 'c1',
        branchId: 'b1',
        value: true,
        status: 'DRAFT',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
      }),
    ],
  },
  {
    id: 'cfg-def-3',
    key: 'trade.pricing.rounding_mode',
    valueSchema: { type: 'string', enum: ['HALF_UP', 'HALF_EVEN', 'UP', 'DOWN'] },
    allowedScopes: ['TENANT', 'COMPANY'],
    mergeStrategy: 'OVERRIDE',
    riskClass: 'MEDIUM',
    companyLockPolicy: {},
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-3-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: 'HALF_UP',
        status: 'SUPERSEDED',
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        supersededAt: '2026-06-01T00:00:00.000Z',
        supersededByVersionId: 'cfg-ver-3-2',
      }),
      makeVersion({
        id: 'cfg-ver-3-2',
        versionNumber: 2,
        scopeTarget: 'TENANT',
        value: 'HALF_EVEN',
        status: 'PUBLISHED',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-3-3',
        versionNumber: 3,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: 'HALF_UP',
        status: 'SCHEDULED',
        effectiveFrom: '2027-01-01T00:00:00.000Z',
      }),
    ],
  },
  {
    id: 'cfg-def-4',
    key: 'trade.documents.allowed_currencies',
    valueSchema: {
      type: 'array',
      items: { type: 'string', enum: ['EGP', 'SAR', 'USD', 'EUR', 'AED', 'GBP'] },
      minItems: 1,
      maxItems: 6,
    },
    allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
    mergeStrategy: 'UNION',
    riskClass: 'MEDIUM',
    companyLockPolicy: {},
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-4-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: ['USD'],
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-4-2',
        versionNumber: 2,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: ['EGP', 'EUR'],
        status: 'PUBLISHED',
        effectiveFrom: '2026-02-01T00:00:00.000Z',
        effectiveTo: '2026-10-31T23:59:59.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-4-3',
        versionNumber: 3,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: ['EGP'],
        status: 'TESTED',
        effectiveFrom: '2026-11-15T00:00:00.000Z',
        createdBy: CURRENT_USER_ID,
      }),
    ],
  },
  {
    id: 'cfg-def-5',
    key: 'trade.purchasing.approval_threshold',
    valueSchema: { type: 'number', minimum: 0, maximum: 100000000 },
    allowedScopes: ['TENANT', 'COMPANY'],
    mergeStrategy: 'MAX',
    riskClass: 'HIGH',
    companyLockPolicy: {},
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-5-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: 50000,
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-5-2',
        versionNumber: 2,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: 75000,
        status: 'PUBLISHED',
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-5-3',
        versionNumber: 3,
        scopeTarget: 'COMPANY',
        companyId: 'c1',
        value: 100000,
        status: 'TESTED',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        createdBy: SARA_USER_ID,
      }),
    ],
  },
  {
    id: 'cfg-def-6',
    key: 'trade.pos.receipt_footer',
    valueSchema: { type: 'string', minLength: 0, maxLength: 200 },
    allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
    mergeStrategy: 'OVERRIDE',
    riskClass: 'LOW',
    companyLockPolicy: {},
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-6-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: 'Thank you for shopping with us.',
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-6-2',
        versionNumber: 2,
        scopeTarget: 'BRANCH',
        companyId: 'c1',
        branchId: 'b1',
        value: 'شكرًا لزيارتكم فرع القاهرة',
        status: 'DRAFT',
        effectiveFrom: '2026-11-25T00:00:00.000Z',
        createdBy: SARA_USER_ID,
      }),
    ],
  },
  {
    id: 'cfg-def-7',
    key: 'trade.documents.print_layout',
    valueSchema: {
      type: 'object',
      properties: {
        showLogo: { type: 'boolean' },
        paperSize: { type: 'string', enum: ['A4', 'A5', 'LETTER'] },
        margins: {
          type: 'object',
          properties: {
            top: { type: 'integer', minimum: 0, maximum: 50 },
            bottom: { type: 'integer', minimum: 0, maximum: 50 },
          },
          required: ['top', 'bottom'],
          additionalProperties: false,
        },
      },
      required: ['showLogo', 'paperSize', 'margins'],
      additionalProperties: false,
    },
    allowedScopes: ['TENANT', 'COMPANY'],
    mergeStrategy: 'OVERRIDE',
    riskClass: 'LOW',
    companyLockPolicy: {},
    version: 1,
    versions: [
      makeVersion({
        id: 'cfg-ver-7-1',
        versionNumber: 1,
        scopeTarget: 'TENANT',
        value: { showLogo: true, paperSize: 'A4', margins: { top: 10, bottom: 10 } },
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
      makeVersion({
        id: 'cfg-ver-7-2',
        versionNumber: 2,
        scopeTarget: 'TENANT',
        value: { showLogo: true, paperSize: 'A4', margins: { top: 80, bottom: 10 } },
        status: 'DRAFT',
        effectiveFrom: '2026-11-25T00:00:00.000Z',
      }),
    ],
  },
];

const passingEvidence = new Map<string, string>();
const latestEvidence = new Map<string, VersionTestEvidence>();
const scopeEpochs = new Map<string, number>();

function ownerName(userId: string): string {
  if (userId === CURRENT_USER_ID) return FAKE_USER.displayName;
  return TRADE_FAKE_DB.owners.find((owner) => owner.id === userId)?.name ?? userId;
}

function seedInitialEvidence(defs: readonly FakeConfigDefinition[]): void {
  for (const def of defs) {
    for (const ver of def.versions) {
      if (
        ver.status === 'TESTED' ||
        ver.status === 'PUBLISHED' ||
        ver.status === 'SCHEDULED' ||
        ver.status === 'SUPERSEDED'
      ) {
        const evidenceId = `ev-${ver.id}`;
        passingEvidence.set(`${ver.id}:${ver.contentHash}`, evidenceId);
        latestEvidence.set(ver.id, {
          evidenceId,
          passed: true,
          diagnostics: [],
          contentHash: ver.contentHash,
          testedAt: ver.effectiveFrom,
        });
      }
    }
  }
}

seedInitialEvidence(SEED_DEFINITIONS);

function toPublicVersion(ver: FakeConfigVersion, now = new Date()): ConfigVersion {
  const { createdBy: _createdBy, ...publicVersion } = ver;
  return clone({
    ...publicVersion,
    effectiveState: versionState(ver, now),
  });
}

function toDetailVersion(ver: FakeConfigVersion, now = new Date()): ConfigVersionDetail {
  const evidence = latestEvidence.get(ver.id) ?? null;
  return clone({
    ...ver,
    effectiveState: versionState(ver, now),
    createdByName: ownerName(ver.createdBy),
    latestTestEvidence: evidence,
  });
}

function resolveScopeTarget(ctx: TradeContext): ScopeTarget {
  if (ctx.branchId && !ctx.companyId) {
    throw new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
  }
  if (ctx.companyId && ctx.branchId) return 'BRANCH';
  if (ctx.companyId) return 'COMPANY';
  return 'TENANT';
}

function matchesExactScope(ver: Omit<ConfigVersion, 'effectiveState'>, target: ScopeTarget, ctx: TradeContext): boolean {
  if (ver.scopeTarget !== target) return false;
  if (target === 'TENANT') {
    return ver.companyId === null && ver.branchId === null;
  }
  if (target === 'COMPANY') {
    return ver.companyId === (ctx.companyId ?? null) && ver.branchId === null;
  }
  return ver.companyId === (ctx.companyId ?? null) && ver.branchId === (ctx.branchId ?? null);
}

function scopeEpochKey(target: ScopeTarget, ctx: TradeContext): string {
  if (target === 'TENANT') return 'TENANT';
  if (target === 'COMPANY') return `COMPANY:${ctx.companyId ?? ''}`;
  return `BRANCH:${ctx.companyId ?? ''}:${ctx.branchId ?? ''}`;
}

function requireIdempotencyKey(key: string): void {
  if (!key || !key.trim()) {
    throw new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING');
  }
}

function findVersionContext(versionId: string): { def: FakeConfigDefinition; ver: FakeConfigVersion } | null {
  for (const def of SEED_DEFINITIONS) {
    const ver = def.versions.find((entry) => entry.id === versionId);
    if (ver) {
      return { def, ver };
    }
  }
  return null;
}

function effectiveWindowEnd(ver: Pick<ConfigVersion, 'supersededAt' | 'effectiveTo'>): number {
  const supMs = ver.supersededAt ? Date.parse(ver.supersededAt) : Infinity;
  const endMs = ver.effectiveTo ? Date.parse(ver.effectiveTo) : Infinity;
  return Math.min(supMs, endMs);
}

function activeCompanyBaseline(
  def: FakeConfigDefinition,
  companyId: string | null,
  atMs: number,
): FakeConfigVersion | null {
  if (!companyId) return null;
  const candidates = def.versions.filter((cv) => {
    if (cv.scopeTarget !== 'COMPANY' || cv.companyId !== companyId) return false;
    if (cv.status !== 'PUBLISHED' && cv.status !== 'SCHEDULED' && !(cv.status === 'SUPERSEDED' && cv.supersededAt !== null)) {
      return false;
    }
    const startMs = Date.parse(cv.effectiveFrom);
    const endMs = effectiveWindowEnd(cv);
    return startMs <= atMs && endMs > atMs;
  });
  candidates.sort((a, b) => b.versionNumber - a.versionNumber);
  return candidates[0] ?? null;
}

export async function fakeListDefinitions(
  ctx: TradeContext,
  query: ListDefinitionsQuery = {},
): Promise<Page<ConfigDefinition>> {
  await fakeDelay();
  const target = resolveScopeTarget(ctx);
  const page = query.page ?? 1;
  const limit = query.limit ?? 24;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const now = new Date();
  const sorted = SEED_DEFINITIONS.slice().sort((a, b) => a.key.localeCompare(b.key));
  const total = sorted.length;
  const start = (page - 1) * limit;
  const items: ConfigDefinition[] = sorted.slice(start, start + limit).map((def) => {
    const scopedVersions = def.versions
      .filter((ver) => matchesExactScope(ver, target, ctx))
      .slice()
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map((ver) => toPublicVersion(ver, now));
    return clone({
      id: def.id,
      key: def.key,
      valueSchema: def.valueSchema,
      allowedScopes: def.allowedScopes,
      mergeStrategy: def.mergeStrategy,
      riskClass: def.riskClass,
      companyLockPolicy: def.companyLockPolicy,
      version: def.version,
      versions: scopedVersions,
    });
  });

  return { items, total, page, limit };
}

export async function fakeGetDefinition(id: string): Promise<ConfigDefinitionDetail> {
  await fakeDelay();
  const def = SEED_DEFINITIONS.find((entry) => entry.id === id);
  if (!def) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
  }

  const now = new Date();
  const versions = def.versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .map((ver) => toDetailVersion(ver, now));

  return clone({
    id: def.id,
    key: def.key,
    valueSchema: def.valueSchema,
    allowedScopes: def.allowedScopes,
    mergeStrategy: def.mergeStrategy,
    riskClass: def.riskClass,
    companyLockPolicy: def.companyLockPolicy,
    version: def.version,
    versions,
  });
}

export async function fakeCreateDefinition(body: CreateDefinitionBody, key: string): Promise<ConfigDefinition> {
  await fakeDelay();
  requireIdempotencyKey(key);

  const normalizedKey = (body.key ?? '').trim().toLowerCase();
  if (!KEY_PATTERN.test(normalizedKey)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { key: ['invalid'] });
  }

  if (SEED_DEFINITIONS.some((def) => def.key === normalizedKey)) {
    throw new ApiError(409, 'TRADE.CONFIGURATION.KEY_TAKEN');
  }

  if (!validateSchemaSubset(body.valueSchema, 1)) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.DEFINITION_INVALID');
  }

  if (!mergeFitsSchema(body.valueSchema, body.mergeStrategy)) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.DEFINITION_INVALID');
  }

  if (!Array.isArray(body.allowedScopes) || body.allowedScopes.length < 1 || body.allowedScopes.length > 3) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.DEFINITION_INVALID');
  }
  const uniqueScopes = new Set(body.allowedScopes);
  if (
    uniqueScopes.size !== body.allowedScopes.length ||
    !body.allowedScopes.every((scope) => VALID_SCOPES.has(scope))
  ) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.DEFINITION_INVALID');
  }

  if (!VALID_RISKS.has(body.riskClass)) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.DEFINITION_INVALID');
  }

  const lockPolicy: { requireCompanyBaseline?: boolean } = {};
  if (body.companyLockPolicy && typeof body.companyLockPolicy.requireCompanyBaseline === 'boolean') {
    lockPolicy.requireCompanyBaseline = body.companyLockPolicy.requireCompanyBaseline;
  }

  const created: FakeConfigDefinition = {
    id: fakeId(),
    key: normalizedKey,
    valueSchema: clone(body.valueSchema),
    allowedScopes: [...body.allowedScopes],
    mergeStrategy: body.mergeStrategy,
    riskClass: body.riskClass,
    companyLockPolicy: lockPolicy,
    version: 1,
    versions: [],
  };
  SEED_DEFINITIONS.push(created);

  return clone({
    ...created,
    versions: [],
  });
}

export async function fakeCreateVersion(
  ctx: TradeContext,
  definitionId: string,
  definitionVersion: number,
  body: CreateVersionBody,
  key: string,
): Promise<CreatedConfigVersion> {
  await fakeDelay();
  requireIdempotencyKey(key);
  const target = resolveScopeTarget(ctx);

  const def = SEED_DEFINITIONS.find((entry) => entry.id === definitionId);
  if (!def) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
  }

  if (definitionVersion !== def.version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  if (body.scopeTarget !== target || !def.allowedScopes.includes(body.scopeTarget)) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.SCOPE_FORBIDDEN');
  }

  const valueErrors = validateValue(def.valueSchema, body.value);
  if (valueErrors.length > 0) {
    const paths = Array.from(new Set(valueErrors.map((err) => err.path)));
    throw new ApiError(422, 'TRADE.CONFIGURATION.VALUE_INVALID', { path: paths });
  }

  const fromMs = Date.parse(body.effectiveFrom);
  if (!Number.isFinite(fromMs)) {
    throw new ApiError(422, 'TRADE.CONFIGURATION.VALUE_INVALID');
  }
  if (body.effectiveTo !== null) {
    const toMs = Date.parse(body.effectiveTo);
    if (!Number.isFinite(toMs) || toMs <= fromMs) {
      throw new ApiError(422, 'TRADE.CONFIGURATION.VALUE_INVALID');
    }
  }

  const maxNumber = def.versions.reduce((max, item) => Math.max(max, item.versionNumber), 0);
  const created: FakeConfigVersion = {
    id: fakeId(),
    versionNumber: maxNumber + 1,
    version: 1,
    scopeTarget: target,
    companyId: target === 'TENANT' ? null : (ctx.companyId ?? null),
    branchId: target === 'BRANCH' ? (ctx.branchId ?? null) : null,
    channelId: null,
    value: clone(body.value),
    status: 'DRAFT',
    effectiveFrom: new Date(fromMs).toISOString(),
    effectiveTo: body.effectiveTo ? new Date(Date.parse(body.effectiveTo)).toISOString() : null,
    supersededAt: null,
    supersededByVersionId: null,
    contentHash: hashValue(body.value),
    createdBy: CURRENT_USER_ID,
  };

  def.versions.push(created);
  return clone({
    ...created,
    effectiveState: versionState(created),
  });
}

/**
 * Backend rule (configuration-scope.service publishVersion): the predecessor must be PUBLISHED or
 * SCHEDULED, not superseded, start before the new version, and must not end before it starts
 * (effectiveTo < from is rejected; effectiveTo equal to from is allowed).
 */
export function isSupersedable(
  candidate: Pick<ConfigVersion, 'status' | 'supersededAt' | 'effectiveFrom' | 'effectiveTo'>,
  newFromMs: number,
): boolean {
  if (candidate.status !== 'PUBLISHED' && candidate.status !== 'SCHEDULED') return false;
  if (candidate.supersededAt !== null) return false;
  if (Date.parse(candidate.effectiveFrom) >= newFromMs) return false;
  return candidate.effectiveTo === null || Date.parse(candidate.effectiveTo) >= newFromMs;
}

function companyLockDiagnostics(def: FakeConfigDefinition, ver: FakeConfigVersion): string[] {
  if (ver.scopeTarget !== 'BRANCH' || Object.keys(def.companyLockPolicy).length === 0) return [];
  const baseline = activeCompanyBaseline(def, ver.companyId, Date.parse(ver.effectiveFrom));
  if (!baseline) {
    return def.companyLockPolicy.requireCompanyBaseline === true ? ['COMPANY_BASELINE_REQUIRED'] : [];
  }
  if (
    def.mergeStrategy === 'MIN' &&
    typeof ver.value === 'number' &&
    typeof baseline.value === 'number' &&
    ver.value > baseline.value
  ) {
    return ['BRANCH_WEAKENS_MIN'];
  }
  if (def.mergeStrategy === 'DENY_WINS' && baseline.value === false && ver.value === true) {
    return ['BRANCH_WEAKENS_DENY'];
  }
  return [];
}

export async function fakeTestVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  key: string,
): Promise<TestResult> {
  await fakeDelay();
  requireIdempotencyKey(key);
  const target = resolveScopeTarget(ctx);

  const found = findVersionContext(versionId);
  if (!found || !matchesExactScope(found.ver, target, ctx)) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
  }
  const { def, ver } = found;

  if (rowVersion !== ver.version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  if (ver.status !== 'DRAFT' && ver.status !== 'TESTED') {
    throw new ApiError(409, 'TRADE.CONFIGURATION.TEST_FAILED');
  }

  // Mirrors the backend: a flat [code, ...paths] list; the first schema error only,
  // and the company-lock check runs only when the value is valid.
  const valueErrors = validateValue(def.valueSchema, ver.value);
  const diagnostics: string[] =
    valueErrors.length > 0
      ? ['TRADE.CONFIGURATION.VALUE_INVALID', valueErrors[0].path]
      : companyLockDiagnostics(def, ver);

  const evidenceId = fakeId();
  latestEvidence.set(ver.id, {
    evidenceId,
    passed: diagnostics.length === 0,
    diagnostics: clone(diagnostics),
    contentHash: ver.contentHash,
    testedAt: nowIso(),
  });

  if (diagnostics.length > 0) {
    return {
      evidenceId,
      passed: false,
      diagnostics,
      mergeStrategy: def.mergeStrategy,
      contentHash: ver.contentHash,
      version: ver.version,
    };
  }

  ver.status = 'TESTED';
  ver.version += 1;
  passingEvidence.set(`${ver.id}:${ver.contentHash}`, evidenceId);

  return {
    evidenceId,
    passed: true,
    diagnostics: [],
    mergeStrategy: def.mergeStrategy,
    contentHash: ver.contentHash,
    version: ver.version,
  };
}

export async function fakePublishVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  body: PublishVersionBody,
  key: string,
): Promise<PublishedConfigVersion> {
  await fakeDelay();
  requireIdempotencyKey(key);
  const target = resolveScopeTarget(ctx);

  const found = findVersionContext(versionId);
  if (!found || !matchesExactScope(found.ver, target, ctx)) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
  }
  const { def, ver } = found;

  if (rowVersion !== ver.version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  if (ver.status !== 'TESTED') {
    throw new ApiError(409, 'TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED');
  }

  if (ver.createdBy === CURRENT_USER_ID) {
    throw new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  }

  if (!passingEvidence.has(`${ver.id}:${ver.contentHash}`)) {
    throw new ApiError(409, 'TRADE.CONFIGURATION.TEST_FAILED');
  }

  if (companyLockDiagnostics(def, ver).length > 0) {
    throw new ApiError(409, 'TRADE.CONFIGURATION.TEST_FAILED');
  }

  const newFromMs = Date.parse(ver.effectiveFrom);
  const newToMs = ver.effectiveTo ? Date.parse(ver.effectiveTo) : Infinity;

  let supersededTarget: FakeConfigVersion | null = null;
  if (body.supersedesVersionId) {
    const candidate = def.versions.find((entry) => entry.id === body.supersedesVersionId) ?? null;
    if (
      !candidate ||
      candidate.id === ver.id ||
      !matchesExactScope(candidate, target, ctx) ||
      !isSupersedable(candidate, newFromMs)
    ) {
      throw new ApiError(409, 'TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED');
    }
    supersededTarget = candidate;
  }

  for (const other of def.versions) {
    if (other.id === ver.id) continue;
    if (!matchesExactScope(other, target, ctx)) continue;
    if (
      other.status !== 'PUBLISHED' &&
      other.status !== 'SCHEDULED' &&
      !(other.status === 'SUPERSEDED' && other.supersededAt !== null)
    ) {
      continue;
    }

    const otherFromMs = Date.parse(other.effectiveFrom);
    const otherToMs =
      supersededTarget && other.id === supersededTarget.id ? newFromMs : effectiveWindowEnd(other);

    if (otherFromMs < newToMs && newFromMs < otherToMs) {
      throw new ApiError(409, 'TRADE.CONFIGURATION.EFFECTIVE_OVERLAP');
    }
  }

  if (supersededTarget) {
    supersededTarget.status = 'SUPERSEDED';
    supersededTarget.supersededAt = ver.effectiveFrom;
    supersededTarget.supersededByVersionId = ver.id;
    supersededTarget.version += 1;
  }

  ver.status = newFromMs > Date.now() ? 'SCHEDULED' : 'PUBLISHED';
  ver.version += 1;

  const epochKey = scopeEpochKey(target, ctx);
  const nextEpoch = (scopeEpochs.get(epochKey) ?? 0) + 1;
  scopeEpochs.set(epochKey, nextEpoch);

  return {
    ...toPublicVersion(ver),
    configurationEpoch: nextEpoch,
  };
}

export async function fakeRetireVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  key: string,
): Promise<ConfigVersion> {
  await fakeDelay();
  requireIdempotencyKey(key);
  const target = resolveScopeTarget(ctx);

  const found = findVersionContext(versionId);
  if (!found || !matchesExactScope(found.ver, target, ctx)) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
  }
  const { ver } = found;

  if (rowVersion !== ver.version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  const currentState = versionState(ver);
  if (currentState !== 'LIVE' && currentState !== 'SCHEDULED') {
    throw new ApiError(409, 'TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED');
  }

  ver.status = 'RETIRED';
  ver.version += 1;
  return toPublicVersion(ver);
}

export async function fakeCancelVersion(
  ctx: TradeContext,
  versionId: string,
  rowVersion: number,
  key: string,
): Promise<ConfigVersion> {
  await fakeDelay();
  requireIdempotencyKey(key);
  const target = resolveScopeTarget(ctx);

  const found = findVersionContext(versionId);
  if (!found || !matchesExactScope(found.ver, target, ctx)) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
  }
  const { ver } = found;

  if (rowVersion !== ver.version) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }

  const currentState = versionState(ver);
  if (currentState !== 'DRAFT' && currentState !== 'TESTED') {
    throw new ApiError(409, 'TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED');
  }

  ver.status = 'RETIRED';
  ver.version += 1;
  return toPublicVersion(ver);
}
