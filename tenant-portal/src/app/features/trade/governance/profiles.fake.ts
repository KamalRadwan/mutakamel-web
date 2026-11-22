import { ApiError, fakeDelay, fakeId } from '../shared/trade-api';
import { clone, nowIso } from '../shared/trade-foundation.fake';
import {
  FAKE_COLLEAGUE,
  FAKE_ME,
  checkIfMatch,
  computeHash,
  fakeIdem,
  getFakeActor,
  normalizeWriteOpts,
  type WriteOptions,
} from './governance-fake-actors';
import { CODE_PATTERN } from './policy.registry';
import type { ScopeTarget } from './policy.model';
import type {
  CreateProfileInput,
  CreateProfileVersionInput,
  DocumentProfile,
  DocumentProfileRecord,
  ListProfilesQuery,
  ProfileCaseExecution,
  ProfileContent,
  ProfileCounts,
  ProfileDeleteResult,
  ProfileFilterQuery,
  ProfileList,
  ProfilePublishResult,
  ProfileRequiredCase,
  ProfileRequiredCaseInput,
  ProfileScopeTarget,
  ProfileValidateResult,
  ProfileValidationRun,
  ProfileVersion,
  ProfileVersionCreated,
  ProfileVersionDetail,
  ProfileVersionRecord,
  ProfileVersionStatus,
} from './profiles.model';
import {
  PROFILE_REGISTRY,
  PROFILE_REGISTRY_VERSION,
  defaultProfileContent,
  type DocumentType,
  type ProfileRegistry,
} from './profiles.registry';

// Mirrors trade-app document-profile.service.ts and document-profile-activation.service.ts.

const idem = fakeIdem();

const SCHEMA_VERSION = 'trade-document-profile.v1';
const RUNTIME_VERSION = 'trade-document-runtime.v1';
const FAKE_COMPANY_ID = '0193a000-0000-7000-8000-00000000c001';
/** All TradeDocumentFamily values: counts return every family as a key. */
const DOCUMENT_FAMILIES = ['QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'SALES_RETURN', 'PURCHASE_RETURN', 'POS_SALE'] as const;

// The fake operating context (the backend reads it from the request). Tests may switch it.
let fakeScopeTarget: ScopeTarget = 'COMPANY';
export function setFakeProfileScopeTarget(target: ScopeTarget): void {
  fakeScopeTarget = target;
}

function registryChecksum(): string {
  return computeHash({ registry: PROFILE_REGISTRY_VERSION, families: PROFILE_REGISTRY.families });
}

function caseHash(valid: boolean): string {
  return computeHash({ valid });
}

interface StoredProfile {
  id: string;
  code: string;
  documentType: DocumentType;
  scopeTarget: ProfileScopeTarget;
  pointerVersion: number;
  currentPublishedVersionId: string | null;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredRun extends ProfileValidationRun {
  candidateRowVersion: number;
  registryChecksum: string;
}

interface StoredProfileVersion {
  id: string;
  profileId: string;
  profileVersion: number;
  status: ProfileVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt: string | null;
  supersededByVersionId: string | null;
  checksum: string;
  registryVersion: string;
  runtimeVersion: string;
  version: number;
  content: ProfileContent;
  requiredCases: ProfileRequiredCase[];
  runs: StoredRun[];
  authorUserId: string;
  validatedBy: string | null;
  publishedBy: string | null;
  restoredFromVersionId: string | null;
  restorationReason: string | null;
  scheduledExpectedPointerVersion: number | null;
}

// ---------------------------------------------------------------------------
// Required cases (document-profile-registry.ts compileRequiredCases / runProfileCase)
// ---------------------------------------------------------------------------

function serverOwnedFields(type: DocumentType): Set<string> {
  return new Set(PROFILE_REGISTRY.families[type].fields.filter((f) => f.serverOwned).map((f) => f.code));
}

function mandatoryCases(type: DocumentType, content: ProfileContent): Omit<ProfileRequiredCase, 'id'>[] {
  const required = content.fields.filter((f) => f.required).map((f) => f.code);
  const validInput: Record<string, unknown> = Object.fromEntries(required.map((code) => [code, 'sample']));
  const missingInput = { ...validInput };
  if (required[0]) delete missingInput[required[0]];
  const serverOwned = [...serverOwnedFields(type)][0] ?? 'grandTotal';
  return [
    { code: 'MINIMAL_VALID', input: validInput, expectedHash: caseHash(true) },
    { code: 'MISSING_REQUIRED_REJECTED', input: missingInput, expectedHash: caseHash(false) },
    { code: 'SERVER_OWNED_REJECTED', input: { ...validInput, [serverOwned]: '100.00' }, expectedHash: caseHash(false) },
    { code: `${type}_REGISTRY_COMPATIBLE`, input: validInput, expectedHash: caseHash(true) },
  ];
}

function compileRequiredCases(
  type: DocumentType,
  content: ProfileContent,
  additions: readonly ProfileRequiredCaseInput[],
): ProfileRequiredCase[] {
  if (!Array.isArray(additions) || additions.length > 20) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.VALIDATION_LIMIT_EXCEEDED');
  }
  const mandatory = mandatoryCases(type, content);
  const seen = new Set(mandatory.map((item) => item.code));
  const custom = additions.map((raw) => {
    if (
      !raw ||
      typeof raw.code !== 'string' ||
      !/^[A-Z][A-Z0-9_]{1,63}$/.test(raw.code) ||
      seen.has(raw.code) ||
      !raw.input ||
      typeof raw.input !== 'object' ||
      Array.isArray(raw.input) ||
      typeof raw.expectedValid !== 'boolean'
    ) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.REQUIRED_CASES_FAILED');
    }
    seen.add(raw.code);
    return { code: raw.code, input: clone(raw.input), expectedHash: caseHash(raw.expectedValid) };
  });
  return [...mandatory, ...custom].map((item) => ({ id: fakeId(), ...item }));
}

function runProfileCase(type: DocumentType, content: ProfileContent, input: Record<string, unknown>): boolean {
  const serverOwned = serverOwnedFields(type);
  const editable = new Set(content.fields.filter((f) => !serverOwned.has(f.code)).map((f) => f.code));
  const required = content.fields.filter((f) => f.required).map((f) => f.code);
  return Object.keys(input).every((key) => editable.has(key)) && required.every((key) => key in input);
}

function executeProfileCases(type: DocumentType, content: ProfileContent, cases: readonly ProfileRequiredCase[]): ProfileCaseExecution[] {
  return cases.map((item) => {
    const actualHash = caseHash(runProfileCase(type, content, item.input));
    return { code: item.code, actualHash, expectedHash: item.expectedHash, passed: actualHash === item.expectedHash, durationMs: 0 };
  });
}

function profileChecksum(content: unknown, cases: readonly ProfileRequiredCase[], from: string, to: string | null): string {
  return computeHash({
    content,
    cases: cases.map(({ code, input, expectedHash }) => ({ code, input, expectedHash })),
    registry: registryChecksum(),
    runtime: RUNTIME_VERSION,
    effectiveFrom: from,
    effectiveTo: to,
  });
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

function seedVersion(
  base: Pick<StoredProfileVersion, 'id' | 'profileId' | 'profileVersion' | 'status' | 'effectiveFrom' | 'effectiveTo' | 'version' | 'authorUserId'> & {
    type: DocumentType;
    extraCases?: ProfileRequiredCaseInput[];
    passedRun?: boolean;
  },
): StoredProfileVersion {
  const content = defaultProfileContent(base.type);
  const requiredCases = compileRequiredCases(base.type, content, base.extraCases ?? []);
  const live = base.status === 'PUBLISHED' || base.status === 'SUPERSEDED';
  const runs: StoredRun[] = base.passedRun
    ? [
        {
          id: `pvr-${base.id}`,
          passed: true,
          diagnostics: [],
          validatedAt: base.effectiveFrom,
          results: executeProfileCases(base.type, content, requiredCases).map((r, i) => ({
            code: r.code,
            requiredCaseId: requiredCases[i].id,
            actualHash: r.actualHash,
            expectedHash: r.expectedHash,
            passed: r.passed,
            durationMs: r.durationMs,
            diagnosticCode: null,
          })),
          candidateRowVersion: base.status === 'TESTED' ? base.version : base.version - 1,
          registryChecksum: registryChecksum(),
        },
      ]
    : [];
  return {
    id: base.id,
    profileId: base.profileId,
    profileVersion: base.profileVersion,
    status: base.status,
    effectiveFrom: base.effectiveFrom,
    effectiveTo: base.effectiveTo,
    supersededAt: null,
    supersededByVersionId: null,
    checksum: profileChecksum(content, requiredCases, base.effectiveFrom, base.effectiveTo),
    registryVersion: PROFILE_REGISTRY_VERSION,
    runtimeVersion: RUNTIME_VERSION,
    version: base.version,
    content,
    requiredCases,
    runs,
    authorUserId: base.authorUserId,
    validatedBy: base.passedRun ? FAKE_ME : null,
    publishedBy: live ? FAKE_ME : null,
    restoredFromVersionId: null,
    restorationReason: null,
    scheduledExpectedPointerVersion: null,
  };
}

function buildSeedProfiles(): { profiles: StoredProfile[]; versions: StoredProfileVersion[] } {
  const profiles: StoredProfile[] = [
    {
      id: 'prof-quotation-default',
      code: 'DEFAULT',
      documentType: 'QUOTATION',
      scopeTarget: 'COMPANY',
      pointerVersion: 2,
      currentPublishedVersionId: 'profv-qt-2',
      version: 3,
      createdBy: FAKE_COLLEAGUE,
      updatedBy: FAKE_COLLEAGUE,
      createdAt: '2026-01-10T08:00:00.000Z',
      updatedAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'prof-sales-order-default',
      code: 'DEFAULT',
      documentType: 'SALES_ORDER',
      scopeTarget: 'COMPANY',
      pointerVersion: 1,
      currentPublishedVersionId: 'profv-so-1',
      version: 2,
      createdBy: FAKE_COLLEAGUE,
      updatedBy: FAKE_COLLEAGUE,
      createdAt: '2026-02-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 'prof-purchase-order-default',
      code: 'DEFAULT',
      documentType: 'PURCHASE_ORDER',
      scopeTarget: 'COMPANY',
      pointerVersion: 0,
      currentPublishedVersionId: null,
      version: 1,
      createdBy: FAKE_ME,
      updatedBy: FAKE_ME,
      createdAt: '2026-11-15T08:00:00.000Z',
      updatedAt: '2026-11-19T14:00:00.000Z',
    },
  ];

  const versions: StoredProfileVersion[] = [
    seedVersion({
      id: 'profv-qt-2', profileId: 'prof-quotation-default', profileVersion: 2, status: 'PUBLISHED', type: 'QUOTATION',
      effectiveFrom: '2026-06-01T00:00:00.000Z', effectiveTo: '2026-12-01T00:00:00.000Z', version: 3,
      authorUserId: FAKE_COLLEAGUE, passedRun: true,
    }),
    seedVersion({
      id: 'profv-qt-3', profileId: 'prof-quotation-default', profileVersion: 3, status: 'TESTED', type: 'QUOTATION',
      effectiveFrom: '2026-12-01T00:00:00.000Z', effectiveTo: null, version: 2, authorUserId: FAKE_COLLEAGUE, passedRun: true,
      extraCases: [{ code: 'QUOTATION_MINIMUM_INPUTS', input: { customerAccountId: 'acc-1', currencyCode: 'EGP', validUntil: '2027-01-01' }, expectedValid: true }],
    }),
    seedVersion({
      id: 'profv-so-1', profileId: 'prof-sales-order-default', profileVersion: 1, status: 'PUBLISHED', type: 'SALES_ORDER',
      effectiveFrom: '2026-05-01T00:00:00.000Z', effectiveTo: null, version: 3, authorUserId: FAKE_COLLEAGUE, passedRun: true,
    }),
    seedVersion({
      id: 'profv-po-1', profileId: 'prof-purchase-order-default', profileVersion: 1, status: 'DRAFT', type: 'PURCHASE_ORDER',
      effectiveFrom: '2026-12-15T00:00:00.000Z', effectiveTo: null, version: 1, authorUserId: FAKE_ME,
    }),
  ];
  return { profiles, versions };
}

let DB = buildSeedProfiles();

/** Test hook: a fresh seeded store and the default COMPANY context. */
export function resetFakeProfileStore(): void {
  DB = buildSeedProfiles();
  fakeScopeTarget = 'COMPANY';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mirrors common/governed-supersession.ts: open or ending after the cutoff -> cut at the cutoff;
 * ended by the cutoff and the successor started by that end -> supersededAt = effectiveTo; a gap -> both null.
 */
function supersessionFields(
  effectiveTo: string | null,
  successor: { id: string; effectiveFrom: string },
  cutoff: string,
): { supersededAt: string | null; supersededByVersionId: string | null } {
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(cutoff)) {
    if (Date.parse(effectiveTo) < Date.parse(successor.effectiveFrom)) {
      return { supersededAt: null, supersededByVersionId: null };
    }
    return { supersededAt: effectiveTo, supersededByVersionId: successor.id };
  }
  return { supersededAt: cutoff, supersededByVersionId: successor.id };
}

/** DocumentProfileActivationService: due SCHEDULED versions go live when the pointer still matches. */
function activateDueScheduled(): void {
  const nowMs = Date.now();
  const due = DB.versions
    .filter((v) => v.status === 'SCHEDULED' && Date.parse(v.effectiveFrom) <= nowMs)
    .sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom));
  for (const v of due) {
    const profile = DB.profiles.find((p) => p.id === v.profileId);
    if (!profile) continue;
    // ACTIVE_POINTER_STALE: an activation exception, the version stays SCHEDULED.
    if (v.scheduledExpectedPointerVersion !== profile.pointerVersion) continue;
    if (profile.currentPublishedVersionId && profile.currentPublishedVersionId !== v.id) {
      const previous = DB.versions.find((item) => item.id === profile.currentPublishedVersionId);
      if (previous?.status === 'PUBLISHED' && Date.parse(previous.effectiveFrom) >= Date.parse(v.effectiveFrom)) continue;
      if (previous?.status === 'PUBLISHED') {
        previous.status = 'SUPERSEDED';
        if (!previous.supersededAt && !previous.supersededByVersionId) {
          Object.assign(previous, supersessionFields(previous.effectiveTo, v, v.effectiveFrom));
        }
        previous.version += 1;
      }
    }
    v.status = 'PUBLISHED';
    v.scheduledExpectedPointerVersion = null;
    v.version += 1;
    profile.currentPublishedVersionId = v.id;
    profile.pointerVersion += 1;
    profile.version += 1;
    profile.updatedAt = nowIso();
  }
}

/** projectVersion. */
function toVersionSummary(v: StoredProfileVersion, includeContent = false): ProfileVersion {
  const safe: ProfileVersion = {
    id: v.id,
    profileVersion: v.profileVersion,
    schemaVersion: SCHEMA_VERSION,
    registryVersion: v.registryVersion,
    runtimeVersion: v.runtimeVersion,
    checksum: v.checksum,
    status: v.status,
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    supersededAt: v.supersededAt,
    supersededByVersionId: v.supersededByVersionId,
    version: v.version,
    authorUserId: v.authorUserId,
    validatedBy: v.validatedBy,
    publishedBy: v.publishedBy,
  };
  return includeContent || v.status === 'PUBLISHED' || v.status === 'SUPERSEDED'
    ? { ...safe, content: clone(v.content) }
    : safe;
}

function toVersionRecord(v: StoredProfileVersion): ProfileVersionRecord {
  return {
    ...toVersionSummary(v),
    profileId: v.profileId,
    content: clone(v.content),
    restoredFromVersionId: v.restoredFromVersionId,
    restorationReason: v.restorationReason,
    scheduledExpectedPointerVersion: v.scheduledExpectedPointerVersion,
  };
}

function toProfileRecord(p: StoredProfile): DocumentProfileRecord {
  return {
    id: p.id,
    scopeTarget: p.scopeTarget,
    companyId: p.scopeTarget === 'COMPANY' ? FAKE_COMPANY_ID : null,
    companyScopeKey: p.scopeTarget === 'COMPANY' ? FAKE_COMPANY_ID : 'none',
    code: p.code,
    documentType: p.documentType,
    currentPublishedVersionId: p.currentPublishedVersionId,
    pointerVersion: p.pointerVersion,
    version: p.version,
    createdBy: p.createdBy,
    updatedBy: p.updatedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toProfileDto(p: StoredProfile, versions: StoredProfileVersion[], includeContent = false): DocumentProfile {
  return {
    ...toProfileRecord(p),
    versions: versions
      .filter((v) => v.profileId === p.id)
      .sort((a, b) => b.profileVersion - a.profileVersion || a.id.localeCompare(b.id))
      .map((v) => toVersionSummary(v, includeContent)),
  };
}

/** getVersion: the fake actor holds manage and validate, so content is never hidden. */
function toVersionDetailDto(v: StoredProfileVersion, p: StoredProfile): ProfileVersionDetail {
  const run = [...v.runs].sort((a, b) => Date.parse(b.validatedAt) - Date.parse(a.validatedAt))[0] ?? null;
  return {
    ...toVersionSummary(v),
    content: clone(v.content),
    requiredCases: clone([...v.requiredCases].sort((a, b) => a.code.localeCompare(b.code))),
    latestValidationRun: run
      ? { id: run.id, passed: run.passed, diagnostics: clone(run.diagnostics), validatedAt: run.validatedAt, results: clone(run.results) }
      : null,
    profile: {
      id: p.id,
      code: p.code,
      documentType: p.documentType,
      scopeTarget: p.scopeTarget,
      pointerVersion: p.pointerVersion,
      currentPublishedVersionId: p.currentPublishedVersionId,
    },
  };
}

function publishNotReady(reason: string): ApiError {
  return new ApiError(409, 'TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY', { reason: [reason.toLowerCase()] });
}

/** assertProfileTarget: profiles live at TENANT or COMPANY scope only. */
function assertProfileTarget(): void {
  if (fakeScopeTarget !== 'TENANT' && fakeScopeTarget !== 'COMPANY') {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED');
  }
}

function requireProfile(id: string): StoredProfile {
  assertProfileTarget();
  const p = DB.profiles.find((item) => item.id === id && item.scopeTarget === fakeScopeTarget);
  if (!p) {
    throw new ApiError(404, 'TRADE.DOCUMENT_PROFILE.NOT_FOUND');
  }
  return p;
}

function requireProfileVersion(id: string): { ver: StoredProfileVersion; profile: StoredProfile } {
  const ver = DB.versions.find((item) => item.id === id);
  if (!ver) {
    throw new ApiError(404, 'TRADE.DOCUMENT_PROFILE.NOT_FOUND');
  }
  return { ver, profile: requireProfile(ver.profileId) };
}

function validateContentAgainstRegistry(type: DocumentType, content: ProfileContent): void {
  const family = PROFILE_REGISTRY.families[type];
  if (!family) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  }

  const fieldDefs = new Map(family.fields.map((f) => [f.code, f]));
  const compDefs = new Map(family.components.map((c) => [c.code, c]));
  const evidenceDefs = new Map(family.evidence.map((e) => [e.code, e]));

  if (!Array.isArray(content.fields) || content.fields.length !== family.fields.length) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  }

  for (const field of content.fields) {
    const def = fieldDefs.get(field.code);
    if (!def) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
    }
    if (def.familyRequired && (!field.visible || !field.required)) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
    }
    if (def.serverOwned && field.required) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
    }
    if (field.required && !field.visible) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
    }
  }

  if (!Array.isArray(content.components) || content.components.length !== family.components.length) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  }

  for (const comp of content.components) {
    const def = compDefs.get(comp.code);
    if (!def) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
    }
    if (def.mandatory && !comp.visible) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
    }
    if (!Number.isFinite(comp.order) || comp.order < 0 || comp.order > 100) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
    }
  }

  for (const modeDef of family.modes) {
    const val = content.modes?.[modeDef.key];
    if (val === undefined) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
    }
    if (modeDef.kind === 'boolean') {
      if (typeof val !== 'boolean') {
        throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
      }
      if (modeDef.locked && val !== modeDef.defaultValue) {
        throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
      }
    } else {
      if (typeof val !== 'string' || !modeDef.allowedValues.includes(val)) {
        throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
      }
      if (modeDef.locked && val !== modeDef.defaultValue) {
        throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
      }
    }
  }

  if (!Array.isArray(content.evidence)) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  }
  for (const ev of content.evidence) {
    if (!evidenceDefs.has(ev.code)) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
    }
    if (ev.required && ev.include === false) {
      throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
    }
  }
}

function effectiveRange(from: string, to: string | null | undefined): { from: string; to: string | null } {
  const fromMs = Date.parse(from);
  if (Number.isNaN(fromMs)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (to && Date.parse(to) <= fromMs) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  }
  return { from, to: to ?? null };
}

function rangeEnd(v: Pick<StoredProfileVersion, 'supersededAt' | 'effectiveTo'>): number {
  const end = v.supersededAt ?? v.effectiveTo;
  return end ? Date.parse(end) : Number.POSITIVE_INFINITY;
}

/** profileOverlap: the current pointer is excluded while it can still be cut by this version. */
function profileOverlap(ver: StoredProfileVersion, currentPublishedVersionId: string | null): boolean {
  const from = Date.parse(ver.effectiveFrom);
  const to = ver.effectiveTo ? Date.parse(ver.effectiveTo) : Number.POSITIVE_INFINITY;
  return DB.versions.some((candidate) => {
    if (candidate.profileId !== ver.profileId || candidate.id === ver.id) return false;
    if (candidate.status !== 'PUBLISHED' && candidate.status !== 'SCHEDULED') return false;
    const cuttablePointer =
      candidate.id === currentPublishedVersionId &&
      candidate.status === 'PUBLISHED' &&
      Date.parse(candidate.effectiveFrom) < from &&
      candidate.supersededByVersionId === null &&
      rangeEnd(candidate) > from;
    if (cuttablePointer) return false;
    return Date.parse(candidate.effectiveFrom) < to && rangeEnd(candidate) > from;
  });
}

// ---------------------------------------------------------------------------
// Public Fake API Functions
// ---------------------------------------------------------------------------

export async function fakeGetProfileRegistry(): Promise<ProfileRegistry> {
  await fakeDelay(100);
  assertProfileTarget();
  return clone(PROFILE_REGISTRY);
}

function filterProfiles(q: ProfileFilterQuery): StoredProfile[] {
  const needle = q.q?.trim().toLowerCase() ?? '';
  return DB.profiles.filter((p) => {
    if (p.scopeTarget !== fakeScopeTarget) return false;
    if (q.documentType && p.documentType !== q.documentType) return false;
    if (needle && !p.code.toLowerCase().includes(needle)) return false;
    return true;
  });
}

/** GET document-profiles/counts: versionStatus filters histories, not identities, so it is ignored here. */
export async function fakeGetProfileCounts(q: ProfileFilterQuery = {}): Promise<ProfileCounts> {
  await fakeDelay(120);
  assertProfileTarget();
  const byDocumentType: Record<string, number> = Object.fromEntries(DOCUMENT_FAMILIES.map((family) => [family, 0]));
  let total = 0;
  for (const p of filterProfiles(q)) {
    byDocumentType[p.documentType] = (byDocumentType[p.documentType] ?? 0) + 1;
    total += 1;
  }
  return { total, byDocumentType };
}

export async function fakeListProfiles(q: ListProfilesQuery = {}): Promise<ProfileList> {
  await fakeDelay();
  assertProfileTarget();
  activateDueScheduled();
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  const matches = filterProfiles(q).sort((a, b) => a.code.localeCompare(b.code));
  const versions = q.versionStatus ? DB.versions.filter((v) => v.status === q.versionStatus) : DB.versions;
  const items = matches
    .slice((page - 1) * limit, page * limit)
    .map((p) => toProfileDto(p, versions, q.include === 'content'));
  return clone({ items, total: matches.length, page, limit });
}

export async function fakeGetProfile(id: string): Promise<DocumentProfile> {
  await fakeDelay();
  activateDueScheduled();
  return clone(toProfileDto(requireProfile(id), DB.versions));
}

export async function fakeGetProfileVersion(id: string): Promise<ProfileVersionDetail> {
  await fakeDelay();
  activateDueScheduled();
  const { ver, profile } = requireProfileVersion(id);
  return clone(toVersionDetailDto(ver, profile));
}

export async function fakeCreateProfile(input: CreateProfileInput, opts?: WriteOptions | string): Promise<DocumentProfileRecord> {
  await fakeDelay();
  const resolved = typeof opts === 'string' ? { idempotencyKey: opts } : normalizeWriteOpts(opts);
  assertProfileTarget();
  if (fakeScopeTarget !== input.scopeTarget) {
    throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED');
  }
  if (!CODE_PATTERN.test(input.code) || !['QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER'].includes(input.documentType)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  return idem.run('profiles:create', resolved.idempotencyKey, input, () => {
    const scopeTarget = fakeScopeTarget as ProfileScopeTarget;
    if (
      DB.profiles.some(
        (p) => p.documentType === input.documentType && p.code === input.code && p.scopeTarget === scopeTarget,
      )
    ) {
      throw new ApiError(409, 'TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN');
    }
    const now = nowIso();
    const actor = getFakeActor();
    const created: StoredProfile = {
      id: fakeId(),
      code: input.code,
      documentType: input.documentType,
      scopeTarget,
      pointerVersion: 0,
      currentPublishedVersionId: null,
      version: 1,
      createdBy: actor,
      updatedBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    DB.profiles.unshift(created);
    return toProfileRecord(created);
  });
}

export async function fakeCreateProfileVersion(
  profileId: string,
  input: CreateProfileVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfileVersionCreated> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  const snapshot = requireProfile(profileId);
  validateContentAgainstRegistry(snapshot.documentType, input.content);
  const requiredCases = compileRequiredCases(snapshot.documentType, input.content, input.requiredCases ?? []);
  const range = effectiveRange(input.effectiveFrom, input.effectiveTo);

  return idem.run(
    `profiles:createVersion:${profileId}`,
    opts.idempotencyKey,
    { profileId, input, ifMatch: opts.ifMatch },
    () => {
      const profile = requireProfile(profileId);
      checkIfMatch(opts.ifMatch, profile.version);
      if (input.restoredFromVersionId) {
        const source = DB.versions.find((v) => v.id === input.restoredFromVersionId && v.profileId === profileId);
        if (!source || !input.restorationReason) {
          throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
        }
      } else if (input.restorationReason) {
        throw new ApiError(422, 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
      }
      const maxNum = DB.versions.filter((v) => v.profileId === profile.id).reduce((max, v) => Math.max(max, v.profileVersion), 0);
      const content = clone(input.content);
      const actor = getFakeActor();
      const created: StoredProfileVersion = {
        id: fakeId(),
        profileId: profile.id,
        profileVersion: maxNum + 1,
        status: 'DRAFT',
        effectiveFrom: range.from,
        effectiveTo: range.to,
        supersededAt: null,
        supersededByVersionId: null,
        checksum: profileChecksum(content, requiredCases, range.from, range.to),
        registryVersion: PROFILE_REGISTRY_VERSION,
        runtimeVersion: RUNTIME_VERSION,
        version: 1,
        content,
        requiredCases,
        runs: [],
        authorUserId: actor,
        validatedBy: null,
        publishedBy: null,
        restoredFromVersionId: input.restoredFromVersionId ?? null,
        restorationReason: input.restorationReason ?? null,
        scheduledExpectedPointerVersion: null,
      };
      DB.versions.push(created);
      // Creating a version does not change the profile row version.
      return { ...toVersionRecord(created), requiredCaseCount: requiredCases.length };
    },
  );
}

export async function fakeDeleteProfileVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfileDeleteResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`profiles:deleteVersion:${id}`, opts.idempotencyKey, { id, ifMatch: opts.ifMatch }, () => {
    const { ver } = requireProfileVersion(id);
    checkIfMatch(opts.ifMatch, ver.version);
    if (ver.status !== 'DRAFT') throw publishNotReady('NOT_DELETABLE');
    ver.version += 1;
    const idx = DB.versions.findIndex((item) => item.id === id);
    if (idx >= 0) DB.versions.splice(idx, 1);
    return { id, deleted: true as const, version: ver.version };
  });
}

export async function fakeValidateProfileVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfileValidateResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`profiles:validate:${id}`, opts.idempotencyKey, { id, ifMatch: opts.ifMatch }, () => {
    const { ver, profile } = requireProfileVersion(id);
    validateContentAgainstRegistry(profile.documentType, ver.content);
    checkIfMatch(opts.ifMatch, ver.version);
    if (ver.status !== 'DRAFT') throw publishNotReady('NOT_DRAFT');
    if (ver.registryVersion !== PROFILE_REGISTRY_VERSION || ver.runtimeVersion !== RUNTIME_VERSION) {
      throw publishNotReady('CHECKSUM_DRIFT');
    }
    const results = executeProfileCases(profile.documentType, ver.content, ver.requiredCases);
    const passed = results.every((r) => r.passed);
    if (passed) {
      ver.status = 'TESTED';
      ver.validatedBy = getFakeActor();
      ver.version += 1;
    }
    const checksum = registryChecksum();
    const run: StoredRun = {
      id: fakeId(),
      passed,
      diagnostics: results.filter((r) => !r.passed).map((r) => ({ caseCode: r.code, code: 'OUTCOME_HASH_MISMATCH' })),
      validatedAt: nowIso(),
      results: results.map((r) => ({
        code: r.code,
        requiredCaseId: ver.requiredCases.find((c) => c.code === r.code)!.id,
        actualHash: r.actualHash,
        expectedHash: r.expectedHash,
        passed: r.passed,
        durationMs: r.durationMs,
        diagnosticCode: r.passed ? null : 'OUTCOME_HASH_MISMATCH',
      })),
      candidateRowVersion: ver.version,
      registryChecksum: checksum,
    };
    ver.runs.push(run);
    return clone({
      validationRunId: run.id,
      passed,
      status: ver.status,
      checksum: ver.checksum,
      registryChecksum: checksum,
      results,
      version: ver.version,
    });
  });
}

/** publishVersion: stale pointer first, then the row version, readiness, overlap, predecessor, pointer. */
export async function fakePublishProfileVersion(
  id: string,
  expectedActivePointerVersion: number,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfilePublishResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  if (!Number.isInteger(expectedActivePointerVersion) || expectedActivePointerVersion < 0) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  return idem.run(
    `profiles:publish:${id}`,
    opts.idempotencyKey,
    { id, expectedActivePointerVersion, ifMatch: opts.ifMatch },
    () => {
      const { ver, profile } = requireProfileVersion(id);
      if (profile.pointerVersion !== expectedActivePointerVersion) {
        throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      }
      checkIfMatch(opts.ifMatch, ver.version);
      validateContentAgainstRegistry(profile.documentType, ver.content);
      if (ver.status !== 'TESTED') throw publishNotReady('NOT_TESTED');
      const actor = getFakeActor();
      if (ver.authorUserId === actor) throw publishNotReady('SELF_PUBLISH');
      if (ver.registryVersion !== PROFILE_REGISTRY_VERSION || ver.runtimeVersion !== RUNTIME_VERSION) {
        throw publishNotReady('REGISTRY_DRIFT');
      }
      const checksum = registryChecksum();
      if (!ver.runs.some((run) => run.passed && run.candidateRowVersion === ver.version && run.registryChecksum === checksum)) {
        throw publishNotReady('NO_PASSING_RUN');
      }
      if (profileOverlap(ver, profile.currentPublishedVersionId)) throw publishNotReady('EFFECTIVE_OVERLAP');

      const now = nowIso();
      const immediate = Date.parse(ver.effectiveFrom) <= Date.parse(now);
      if (profile.currentPublishedVersionId && profile.currentPublishedVersionId !== ver.id) {
        const previous = DB.versions.find((v) => v.id === profile.currentPublishedVersionId);
        if (
          previous?.status === 'PUBLISHED' &&
          (immediate ||
            (Date.parse(previous.effectiveFrom) < Date.parse(ver.effectiveFrom) &&
              (!previous.effectiveTo || Date.parse(previous.effectiveTo) > Date.parse(ver.effectiveFrom))))
        ) {
          // A recorded successor is immutable: never replace a reservation.
          if (previous.supersededAt || previous.supersededByVersionId) throw publishNotReady('EFFECTIVE_OVERLAP');
          if (immediate) previous.status = 'SUPERSEDED';
          Object.assign(previous, supersessionFields(previous.effectiveTo, ver, immediate ? now : ver.effectiveFrom));
          previous.version += 1;
        }
      }
      ver.status = immediate ? 'PUBLISHED' : 'SCHEDULED';
      ver.publishedBy = actor;
      ver.scheduledExpectedPointerVersion = immediate ? null : expectedActivePointerVersion;
      ver.version += 1;
      if (immediate) {
        profile.currentPublishedVersionId = ver.id;
        profile.pointerVersion += 1;
        profile.version += 1;
        profile.updatedBy = actor;
        profile.updatedAt = now;
      }
      return { ...toVersionRecord(ver), activePointerVersion: profile.pointerVersion, active: immediate };
    },
  );
}
