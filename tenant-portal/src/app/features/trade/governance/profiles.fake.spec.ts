import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../core/api/core-http';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { TradeHttp, bindTradeHttp, bindTradeHttpForTest, tradeQueries } from '../shared/trade-http';
import {
  createProfile,
  createVersion,
  deleteVersion,
  getProfile,
  getProfileCounts,
  getRegistry,
  getVersion,
  listProfiles,
  publishVersion,
  validateVersion,
} from './profiles.api';
import type {
  DocumentProfile,
  DocumentProfileRecord,
  ProfileContent,
  ProfileCounts,
  ProfileDeleteResult,
  ProfileList,
  ProfilePublishResult,
  ProfileValidateResult,
  ProfileVersionCreated,
  ProfileVersionDetail,
} from './profiles.model';
import { PROFILE_REGISTRY_VERSION, defaultProfileContent } from './profiles.registry';
import { isEffectiveOverlapError } from './document-profiles-page/profile-access';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROF_ID = '01900000-0000-7000-8000-000000000010';
const VER_ID = '01900000-0000-7000-8000-000000000020';
const COMPANY_CTX = { companyId: 'c1' };

function makeProfileRecord(overrides: Partial<DocumentProfileRecord> = {}): DocumentProfileRecord {
  return {
    id: PROF_ID,
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    companyScopeKey: 'c1',
    code: 'DEFAULT',
    documentType: 'QUOTATION',
    currentPublishedVersionId: null,
    pointerVersion: 0,
    version: 1,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<DocumentProfile> = {}): DocumentProfile {
  return {
    ...makeProfileRecord(),
    versions: [
      {
        id: VER_ID,
        profileVersion: 1,
        schemaVersion: 'trade-document-profile.v1',
        registryVersion: PROFILE_REGISTRY_VERSION,
        runtimeVersion: 'trade-document-runtime.v1',
        checksum: 'chk-1',
        status: 'DRAFT',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: null,
        supersededAt: null,
        supersededByVersionId: null,
        version: 1,
        authorUserId: 'u1',
        validatedBy: null,
        publishedBy: null,
      },
    ],
    ...overrides,
  };
}

describe('profiles.api (TradeHttpStub)', () => {
  it('recognizes the backend uppercase overlap reason and the direct field code', () => {
    expect(isEffectiveOverlapError(new ApiError(409, 'TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY', {
      reason: ['EFFECTIVE_OVERLAP'],
    }))).toBe(true);
    expect(isEffectiveOverlapError(new ApiError(409, 'TRADE.DOCUMENT_PROFILE.EFFECTIVE_OVERLAP'))).toBe(true);
    expect(isEffectiveOverlapError(new ApiError(409, 'TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY', {
      reason: ['NO_PASSING_RUN'],
    }))).toBe(false);
  });
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it('getRegistry calls GET /document-profiles/registry with OPTIONAL scope and maps wire family metadata', async () => {
    stub.register('GET', '/document-profiles/registry', {
      families: {
        QUOTATION: {
          fields: ['PARTY', 'CONTACT', 'CURRENCY', 'VALID_UNTIL', 'LINES', 'GRAND_TOTAL'],
          requiredFields: ['PARTY', 'CURRENCY', 'VALID_UNTIL', 'LINES'],
          serverOwnedFields: ['GRAND_TOTAL'],
          components: ['HEADER', 'LINE_ITEMS', 'TOTALS'],
          requiredComponents: ['HEADER', 'LINE_ITEMS'],
          modes: {
            acceptanceMode: { allowedValues: ['INTERNAL_AUTHORIZED'] },
            priceLockRequired: { allowedValues: [true, false] },
          },
          evidenceCodes: ['CUSTOMER_ACCEPTANCE', 'APPROVAL_DECISION'],
          serverCaseCodes: ['MINIMAL_VALID', 'MISSING_REQUIRED_REJECTED', 'SERVER_OWNED_REJECTED', 'QUOTATION_REGISTRY_COMPATIBLE'],
        },
        SALES_ORDER: {
          fields: ['PARTY', 'CURRENCY', 'LINES'],
          requiredFields: ['PARTY', 'CURRENCY', 'LINES'],
          serverOwnedFields: [],
          components: ['HEADER', 'LINE_ITEMS'],
          requiredComponents: ['HEADER', 'LINE_ITEMS'],
          modes: { confirmationMode: { allowedValues: ['SYNC'] } },
          evidenceCodes: ['APPROVAL_DECISION'],
          serverCaseCodes: ['MINIMAL_VALID'],
        },
        PURCHASE_ORDER: {
          fields: ['SUPPLIER', 'CURRENCY', 'LINES', 'RECEIVING_NODE'],
          requiredFields: ['SUPPLIER', 'CURRENCY', 'LINES', 'RECEIVING_NODE'],
          serverOwnedFields: [],
          components: ['HEADER', 'LINE_ITEMS'],
          requiredComponents: ['HEADER', 'LINE_ITEMS'],
          modes: { approvalMode: { allowedValues: ['NONE', 'WORKFLOW'] } },
          evidenceCodes: ['SUPPLIER_ACKNOWLEDGEMENT'],
          serverCaseCodes: ['MINIMAL_VALID'],
        },
      },
    });

    const reg = await getRegistry(COMPANY_CTX);
    expect(reg.families.QUOTATION.fields.find((f) => f.code === 'PARTY')?.familyRequired).toBe(true);
    expect(reg.families.QUOTATION.fields.find((f) => f.code === 'GRAND_TOTAL')?.serverOwned).toBe(true);
    expect(reg.families.QUOTATION.components.find((c) => c.code === 'HEADER')?.mandatory).toBe(true);
    expect(reg.families.QUOTATION.modes.find((m) => m.key === 'acceptanceMode')).toEqual({
      key: 'acceptanceMode',
      kind: 'enum',
      allowedValues: ['INTERNAL_AUTHORIZED'],
      defaultValue: 'INTERNAL_AUTHORIZED',
      locked: true,
    });
    expect(reg.families.QUOTATION.modes.find((m) => m.key === 'priceLockRequired')).toEqual({
      key: 'priceLockRequired',
      kind: 'boolean',
      allowedValues: ['true', 'false'],
      defaultValue: true,
      locked: false,
    });
    expect(stub.recordedReads()).toEqual([
      { path: '/document-profiles/registry', query: undefined, scope: COMPANY_CTX },
    ]);
  });

  it('getProfileCounts calls GET /document-profiles/counts with filter query and OPTIONAL scope', async () => {
    const counts: ProfileCounts = {
      total: 3,
      byDocumentType: { QUOTATION: 1, SALES_ORDER: 1, PURCHASE_ORDER: 1, POS_SALE: 0 },
    };
    stub.register('GET', '/document-profiles/counts', counts);

    const res = await getProfileCounts({ documentType: 'QUOTATION', versionStatus: 'PUBLISHED', q: 'DEF' }, {});
    expect(res).toEqual(counts);
    expect(stub.recordedReads()[0]).toEqual({
      path: '/document-profiles/counts',
      query: { documentType: 'QUOTATION', versionStatus: 'PUBLISHED', q: 'DEF' },
      scope: {},
    });
  });

  it('listProfiles calls GET /document-profiles with query params and unwraps list envelope', async () => {
    const list: ProfileList = { items: [makeProfile()], total: 1, page: 2, limit: 25 };
    stub.register('GET', '/document-profiles', list);

    const res = await listProfiles(
      { documentType: 'QUOTATION', versionStatus: 'DRAFT', q: 'DEF', page: 2, limit: 25, include: 'content' },
      COMPANY_CTX,
    );
    expect(res).toEqual(list);
    expect(stub.recordedReads()[0]).toEqual({
      path: '/document-profiles',
      query: {
        documentType: 'QUOTATION',
        versionStatus: 'DRAFT',
        q: 'DEF',
        page: 2,
        limit: 25,
        include: 'content',
      },
      scope: COMPANY_CTX,
    });
  });

  it('getProfile calls GET /document-profiles/:id with OPTIONAL scope and unwraps profile', async () => {
    const profile = makeProfile();
    stub.register('GET', '/document-profiles/:id', profile);

    const res = await getProfile('prof/1', COMPANY_CTX);
    expect(res).toEqual(profile);
    expect(stub.recordedReads()[0]).toEqual({
      path: '/document-profiles/prof%2F1',
      query: undefined,
      scope: COMPANY_CTX,
    });
  });

  it('createProfile sends POST /document-profiles with whitelisted body, UUIDv7 key, no If-Match, and propagates field errors', async () => {
    const created = makeProfileRecord();
    stub.register('POST', '/document-profiles', created);

    const key = newIdempotencyKey();
    const res = await createProfile(
      { code: 'DEFAULT', documentType: 'QUOTATION', scopeTarget: 'COMPANY', extra: 'strip' } as never,
      { idempotencyKey: key, ctx: COMPANY_CTX },
    );
    expect(res).toEqual(created);
    expect(stub.recordedWrites()[0]).toEqual({
      method: 'POST',
      path: '/document-profiles',
      body: { code: 'DEFAULT', documentType: 'QUOTATION', scopeTarget: 'COMPANY' },
      key,
      ifMatch: undefined,
      scope: COMPANY_CTX,
      query: undefined,
    });
    expect(stub.recordedWrites()[0].key).toMatch(UUID_V7_REGEX);

    await expect(
      createProfile({ code: 'DEFAULT', documentType: 'QUOTATION', scopeTarget: 'COMPANY' }, ''),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

    await expect(
      createProfile({ code: 'DEFAULT', documentType: 'QUOTATION', scopeTarget: 'COMPANY' }, 'bad-key'),
    ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });

    const fieldErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { code: ['invalid'] });
    stub.register('POST', '/document-profiles', fieldErr);
    await expect(
      createProfile({ code: 'bad', documentType: 'QUOTATION', scopeTarget: 'COMPANY' }, newIdempotencyKey()),
    ).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { code: ['invalid'] },
    });
  });

  it('createVersion strips UI-only `include` from evidence[] (G-9), enforces S1 booleans, and sends key + If-Match', async () => {
    const baseContent = defaultProfileContent('QUOTATION');
    const contentWithInclude: ProfileContent = {
      ...baseContent,
      evidence: [
        { code: 'CUSTOMER_ACCEPTANCE', include: true, required: false },
        { code: 'APPROVAL_DECISION', include: true, required: true },
        { code: 'SUPPLIER_ACKNOWLEDGEMENT', include: false, required: false },
      ],
    };
    const created: ProfileVersionCreated = {
      id: VER_ID,
      profileId: PROF_ID,
      profileVersion: 1,
      schemaVersion: 'trade-document-profile.v1',
      registryVersion: PROFILE_REGISTRY_VERSION,
      runtimeVersion: 'trade-document-runtime.v1',
      checksum: 'chk-1',
      status: 'DRAFT',
      effectiveFrom: '2026-12-01T00:00:00.000Z',
      effectiveTo: null,
      supersededAt: null,
      supersededByVersionId: null,
      version: 1,
      authorUserId: 'u1',
      validatedBy: null,
      publishedBy: null,
      content: {
        ...baseContent,
        evidence: [
          { code: 'CUSTOMER_ACCEPTANCE', required: false },
          { code: 'APPROVAL_DECISION', required: true },
        ],
      },
      restoredFromVersionId: null,
      restorationReason: null,
      scheduledExpectedPointerVersion: null,
      requiredCaseCount: 5,
    };
    stub.register('POST', '/document-profiles/:id/versions', created);

    await expect(
      createVersion(
        PROF_ID,
        { content: contentWithInclude, effectiveFrom: '2026-12-01T00:00:00.000Z' },
        undefined,
        newIdempotencyKey(),
        COMPANY_CTX,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });

    const key = newIdempotencyKey();
    const res = await createVersion(
      PROF_ID,
      {
        content: contentWithInclude,
        requiredCases: [{ code: 'MIN_CASE', input: { PARTY: 'p1' }, expectedValid: true }],
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: null,
      },
      1,
      key,
      COMPANY_CTX,
    );
    expect(res.id).toBe(VER_ID);

    const write = stub.recordedWrites()[0];
    expect(write.method).toBe('POST');
    expect(write.path).toBe(`/document-profiles/${PROF_ID}/versions`);
    expect(write.key).toBe(key);
    expect(write.ifMatch).toBe('"1"');
    expect(write.scope).toEqual(COMPANY_CTX);

    const sentBody = write.body as { content: ProfileContent };
    expect(sentBody.content.evidence).toEqual([
      { code: 'CUSTOMER_ACCEPTANCE', required: false },
      { code: 'APPROVAL_DECISION', required: true },
    ]);
    expect(sentBody.content.evidence.every((item) => !('include' in item))).toBe(true);
  });

  it('getVersion calls GET /document-profile-versions/:id with OPTIONAL scope and supports contentHidden', async () => {
    const detail: ProfileVersionDetail = {
      id: VER_ID,
      profileVersion: 1,
      schemaVersion: 'trade-document-profile.v1',
      registryVersion: PROFILE_REGISTRY_VERSION,
      runtimeVersion: 'trade-document-runtime.v1',
      checksum: 'chk-1',
      status: 'DRAFT',
      effectiveFrom: '2026-12-01T00:00:00.000Z',
      effectiveTo: null,
      supersededAt: null,
      supersededByVersionId: null,
      version: 1,
      authorUserId: 'u1',
      validatedBy: null,
      publishedBy: null,
      contentHidden: true,
      requiredCases: [],
      latestValidationRun: null,
      profile: {
        id: PROF_ID,
        code: 'DEFAULT',
        documentType: 'QUOTATION',
        scopeTarget: 'COMPANY',
        pointerVersion: 0,
        currentPublishedVersionId: null,
      },
    };
    stub.register('GET', '/document-profile-versions/:id', detail);

    const res = await getVersion(VER_ID, COMPANY_CTX);
    expect(res.contentHidden).toBe(true);
    expect(res.content).toBeUndefined();
    expect(stub.recordedReads()[0]).toEqual({
      path: `/document-profile-versions/${VER_ID}`,
      query: undefined,
      scope: COMPANY_CTX,
    });
  });

  it('deleteVersion sends DELETE /document-profile-versions/:id with empty body, key, and If-Match', async () => {
    const deleted: ProfileDeleteResult = { id: VER_ID, deleted: true, version: 2 };
    stub.register('DELETE', '/document-profile-versions/:id', deleted);

    const key = newIdempotencyKey();
    const res = await deleteVersion(VER_ID, 1, key, COMPANY_CTX);
    expect(res).toEqual(deleted);
    expect(stub.recordedWrites()[0]).toEqual({
      method: 'DELETE',
      path: `/document-profile-versions/${VER_ID}`,
      body: undefined,
      key,
      ifMatch: '"1"',
      scope: COMPANY_CTX,
      query: undefined,
    });
  });

  it('validateVersion sends POST /document-profile-versions/:id/validate with empty body, key, and If-Match', async () => {
    const result: ProfileValidateResult = {
      validationRunId: 'run-1',
      passed: true,
      status: 'TESTED',
      checksum: 'chk-1',
      registryChecksum: 'reg-1',
      results: [],
      version: 2,
    };
    stub.register('POST', '/document-profile-versions/:id/validate', result);

    const key = newIdempotencyKey();
    const res = await validateVersion(VER_ID, 1, key, COMPANY_CTX);
    expect(res).toEqual(result);
    expect(stub.recordedWrites()[0]).toEqual({
      method: 'POST',
      path: `/document-profile-versions/${VER_ID}/validate`,
      body: undefined,
      key,
      ifMatch: '"1"',
      scope: COMPANY_CTX,
      query: undefined,
    });
  });

  it('publishVersion sends { expectedActivePointerVersion }, key, and If-Match, and propagates ACTIVE_POINTER_STALE without retry', async () => {
    const published: ProfilePublishResult = {
      id: VER_ID,
      profileId: PROF_ID,
      profileVersion: 2,
      schemaVersion: 'trade-document-profile.v1',
      registryVersion: PROFILE_REGISTRY_VERSION,
      runtimeVersion: 'trade-document-runtime.v1',
      checksum: 'chk-2',
      status: 'PUBLISHED',
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      effectiveTo: null,
      supersededAt: null,
      supersededByVersionId: null,
      version: 3,
      authorUserId: 'u1',
      validatedBy: 'u1',
      publishedBy: 'u2',
      content: defaultProfileContent('QUOTATION'),
      restoredFromVersionId: null,
      restorationReason: null,
      scheduledExpectedPointerVersion: null,
      activePointerVersion: 1,
      active: true,
    };
    stub.register('POST', '/document-profile-versions/:id/publish', published);

    const key = newIdempotencyKey();
    const res = await publishVersion(VER_ID, 0, 2, key, COMPANY_CTX);
    expect(res).toEqual(published);
    expect(stub.recordedWrites()[0]).toEqual({
      method: 'POST',
      path: `/document-profile-versions/${VER_ID}/publish`,
      body: { expectedActivePointerVersion: 0 },
      key,
      ifMatch: '"2"',
      scope: COMPANY_CTX,
      query: undefined,
    });

    const stalePointer = new ApiError(409, 'TRADE.DOCUMENT_PROFILE.ACTIVE_POINTER_STALE');
    stub.register('POST', '/document-profile-versions/:id/publish', stalePointer);
    await expect(publishVersion(VER_ID, 0, 2, newIdempotencyKey(), COMPANY_CTX)).rejects.toBe(stalePointer);
    expect(stub.recordedWrites()).toHaveLength(2);
  });
});

describe('profiles.api (TradeHttp wire contract & envelope unwrap)', () => {
  const base = '/api/tenant/trade/v1';
  const envelope = (data: unknown) => ({
    success: true,
    data,
    correlationId: 'corr-prof',
    timestamp: '2026-11-23T12:00:00.000Z',
  });

  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    dispose = bindTradeHttpForTest();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName =
      doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=csrf-proof`);
    bindTradeHttp(TestBed.inject(TradeHttp), tradeQueries(), TestBed.inject(CoreHttp));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    dispose();
  });

  it('unwraps Trade envelope on getProfile and publishVersion with OPTIONAL scope headers', async () => {
    const prof = makeProfile({ scopeTarget: 'TENANT', companyId: null, companyScopeKey: 'none' });
    const getPending = getProfile(PROF_ID, {});
    const getReq = http.expectOne(`${base}/document-profiles/${PROF_ID}`);
    expect(getReq.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    getReq.flush(envelope(prof));
    await expect(getPending).resolves.toMatchObject({ id: PROF_ID, scopeTarget: 'TENANT' });

    const key = newIdempotencyKey();
    const pubPending = publishVersion(VER_ID, 3, 2, key, COMPANY_CTX);
    const pubReq = http.expectOne(`${base}/document-profile-versions/${VER_ID}/publish`);
    expect(pubReq.request.method).toBe('POST');
    expect(pubReq.request.headers.get('x-idempotency-key')).toBe(key);
    expect(pubReq.request.headers.get('if-match')).toBe('"2"');
    expect(pubReq.request.headers.get('x-mutakamel-company-id')).toBe('c1');
    expect(pubReq.request.body).toEqual({ expectedActivePointerVersion: 3 });
    pubReq.flush(
      envelope({
        ...prof.versions[0],
        profileId: PROF_ID,
        status: 'PUBLISHED',
        content: defaultProfileContent('QUOTATION'),
        restoredFromVersionId: null,
        restorationReason: null,
        scheduledExpectedPointerVersion: null,
        activePointerVersion: 4,
        active: true,
      }),
    );
    await expect(pubPending).resolves.toMatchObject({ activePointerVersion: 4, active: true });
  });
});
