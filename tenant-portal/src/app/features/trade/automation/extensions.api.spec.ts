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
  discardDraft,
  getProfile,
  getProfileCounts,
  getTargets,
  getVersion,
  listProfiles,
  listVersions,
  publish,
  retire,
  updateFields,
  validate,
} from './extensions.api';
import type {
  CreateExtensionProfileInput,
  ExtensionDraftDiscardResult,
  ExtensionField,
  ExtensionFieldInput,
  ExtensionProfile,
  ExtensionProfileCounts,
  ExtensionProfileDraftResult,
  ExtensionProfileEntity,
  ExtensionProfilePublishResult,
  ExtValidateResult,
  ExtVersion,
} from './extensions.model';
import { EXTENSION_OBJECT_SCHEMA, type ExtensionTargetsResponse, toFieldInput } from './extensions.registry';

const PROFILE_ID = '01900000-0000-7000-8000-000000000101';
const VERSION_ID = '01900000-0000-7000-8000-000000000201';
const FIELD_ID = '01900000-0000-7000-8000-000000000301';

function makeField(overrides: Partial<ExtensionField> = {}): ExtensionField {
  return {
    id: FIELD_ID,
    fieldKey: 'pkg.shelf_life_days',
    valueKind: 'SCALAR',
    scalarType: 'DECIMAL',
    schemaCode: null,
    schemaVersion: null,
    isRequired: false,
    isSearchable: true,
    visibilityCode: 'USER',
    maxLength: null,
    maxItems: null,
    decimalScale: 0,
    minimumDecimal: '0',
    maximumDecimal: '3650',
    defaultStrategy: 'LITERAL',
    defaultValue: '30',
    constraintPayload: {},
    ordinal: 1,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<ExtVersion> = {}): ExtVersion {
  return {
    id: VERSION_ID,
    profileId: PROFILE_ID,
    version: 1,
    versionNumber: 1,
    registryVersion: 1,
    targetSchemaCode: 'trade.catalog-item.extensions',
    targetSchemaVersion: 1,
    definitionHash: '0'.repeat(64),
    status: 'DRAFT',
    compatibilitySummary: {},
    publishedAt: null,
    publishedBy: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ExtensionProfile> = {}): ExtensionProfile {
  return {
    id: PROFILE_ID,
    version: 2,
    code: 'ITEM_EXTRA',
    targetCode: 'CATALOG_ITEM',
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    status: 'DRAFT',
    currentPublishedVersionId: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    fieldCount: 1,
    currentPublishedVersion: null,
    editableDraftVersion: makeVersion({ fields: [makeField()] }),
    ...overrides,
  };
}

function makeProfileEntity(overrides: Partial<ExtensionProfileEntity> = {}): ExtensionProfileEntity {
  return {
    id: PROFILE_ID,
    version: 2,
    code: 'ITEM_EXTRA',
    targetCode: 'CATALOG_ITEM',
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    status: 'DRAFT',
    currentPublishedVersionId: null,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function textField(fieldKey = 'spec.note', extra: Partial<ExtensionFieldInput> = {}): ExtensionFieldInput {
  return { fieldKey, valueKind: 'SCALAR', scalarType: 'STRING', visibilityCode: 'USER', ...extra };
}

describe('extensions.api (TradeHttpStub)', () => {
  it('getProfileCounts calls GET /extensions/profiles/counts with filters, OPTIONAL scope, unwraps counts, and propagates errors', async () => {
    const counts: ExtensionProfileCounts = {
      total: 2,
      byTarget: { CATALOG_ITEM: 1, QUOTATION: 1, SALES_ORDER: 0, PURCHASE_ORDER: 0 },
      byStatus: { DRAFT: 1, ACTIVE: 1, RETIRED: 0 },
    };
    const stub = new TradeHttpStub({ 'GET /extensions/profiles/counts': counts });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const res = await getProfileCounts({ targetCode: 'CATALOG_ITEM', status: 'ACTIVE' }, { companyId: 'c1' });
      expect(res).toEqual(counts);
      expect(stub.recordedReads()).toEqual([
        {
          path: '/extensions/profiles/counts',
          query: { targetCode: 'CATALOG_ITEM', status: 'ACTIVE' },
          scope: { companyId: 'c1' },
        },
      ]);

      stub.reset();
      await getProfileCounts();
      expect(stub.recordedReads()).toEqual([
        { path: '/extensions/profiles/counts', query: undefined, scope: {} },
      ]);

      const err = new ApiError(400, 'TRADE.VALIDATION_FAILED', { status: ['invalid status'] });
      stub.register('GET', '/extensions/profiles/counts', err);
      await expect(getProfileCounts({ status: 'ACTIVE' })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { status: ['invalid status'] },
      });
    } finally {
      dispose();
    }
  });

  it('getTargets calls GET /extensions/targets with OPTIONAL scope and unwraps the target registry', async () => {
    const targets: ExtensionTargetsResponse = {
      registryVersion: 1,
      targets: [
        { code: 'CATALOG_ITEM', schemaCode: 'trade.catalog-item.extensions', schemaVersion: 1, searchable: true },
      ],
      valueKinds: ['SCALAR', 'OBJECT', 'COLLECTION'],
      scalarTypes: ['STRING', 'BOOLEAN', 'DECIMAL', 'DATE', 'UUID', 'ENUM'],
      valueSchemas: {
        object: { code: EXTENSION_OBJECT_SCHEMA, version: 1 },
        collection: { code: 'trade.extension.scalar-collection', version: 1 },
      },
      defaultStrategies: ['NONE', 'LITERAL'],
      limits: { fieldsPerProfile: 100, valueBytes: 16384 },
    };
    const stub = new TradeHttpStub({ 'GET /extensions/targets': targets });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const res = await getTargets({ companyId: 'c1', branchId: 'b1' });
      expect(res).toEqual(targets);
      expect(stub.recordedReads()).toEqual([
        { path: '/extensions/targets', query: undefined, scope: { companyId: 'c1', branchId: 'b1' } },
      ]);
    } finally {
      dispose();
    }
  });

  it('listProfiles calls GET /extensions/profiles with query params and OPTIONAL scope, unwraps page, and propagates validation details', async () => {
    const profile = makeProfile({ editableDraftVersion: makeVersion({ fields: undefined }) });
    const stub = new TradeHttpStub({
      'GET /extensions/profiles': { items: [profile], total: 1, page: 1, limit: 24 },
    });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const page = await listProfiles(
        { targetCode: 'CATALOG_ITEM', status: 'DRAFT', page: 1, limit: 24 },
        { companyId: 'c1' },
      );
      expect(page).toEqual({ items: [profile], total: 1, page: 1, limit: 24 });
      expect(stub.recordedReads()).toEqual([
        {
          path: '/extensions/profiles',
          query: { targetCode: 'CATALOG_ITEM', status: 'DRAFT', page: 1, limit: 24 },
          scope: { companyId: 'c1' },
        },
      ]);

      const err = new ApiError(400, 'TRADE.VALIDATION_FAILED', { limit: ['limit must not exceed 100'] });
      stub.register('GET', '/extensions/profiles', err);
      await expect(listProfiles({ limit: 500 })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { limit: ['limit must not exceed 100'] },
      });
    } finally {
      dispose();
    }
  });

  it('getProfile calls GET /extensions/profiles/:id with OPTIONAL scope, preserves OWNER_DERIVED reads, and propagates 404 DEFINITION_NOT_FOUND', async () => {
    const derivedField = makeField({
      fieldKey: 'pkg.derived_tag',
      defaultStrategy: 'OWNER_DERIVED',
      defaultValue: null,
    });
    const profile = makeProfile({
      editableDraftVersion: makeVersion({ fields: [derivedField] }),
    });
    const stub = new TradeHttpStub({ 'GET /extensions/profiles/:id': profile });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const loaded = await getProfile(PROFILE_ID, { companyId: 'c1' });
      expect(loaded.editableDraftVersion?.fields?.[0]?.defaultStrategy).toBe('OWNER_DERIVED');
      expect(stub.recordedReads()).toEqual([
        { path: `/extensions/profiles/${PROFILE_ID}`, query: undefined, scope: { companyId: 'c1' } },
      ]);

      const notFound = new ApiError(404, 'TRADE.EXTENSION.DEFINITION_NOT_FOUND');
      stub.register('GET', '/extensions/profiles/:id', notFound);
      await expect(getProfile('missing', {})).rejects.toBe(notFound);
    } finally {
      dispose();
    }
  });

  it('listVersions calls GET /extensions/profiles/:id/versions with OPTIONAL scope and unwraps page', async () => {
    const version = makeVersion({ status: 'PUBLISHED', publishedAt: '2026-11-23T11:00:00.000Z', publishedBy: 'u1' });
    const stub = new TradeHttpStub({
      'GET /extensions/profiles/:id/versions': { items: [version], total: 1, page: 1, limit: 50 },
    });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const page = await listVersions(PROFILE_ID, { status: 'PUBLISHED', page: 1, limit: 50 }, {});
      expect(page).toEqual({ items: [version], total: 1, page: 1, limit: 50 });
      expect(stub.recordedReads()).toEqual([
        {
          path: `/extensions/profiles/${PROFILE_ID}/versions`,
          query: { page: 1, limit: 50, status: 'PUBLISHED' },
          scope: {},
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('getVersion calls GET /extensions/profiles/:id/versions/:versionId with OPTIONAL scope and unwraps detail', async () => {
    const detail = makeVersion({ fields: [makeField()] });
    const stub = new TradeHttpStub({ 'GET /extensions/profiles/:id/versions/:versionId': detail });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const loaded = await getVersion(PROFILE_ID, VERSION_ID, { companyId: 'c1' });
      expect(loaded).toEqual(detail);
      expect(stub.recordedReads()).toEqual([
        {
          path: `/extensions/profiles/${PROFILE_ID}/versions/${VERSION_ID}`,
          query: undefined,
          scope: { companyId: 'c1' },
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('createProfile sends POST /extensions/profiles with UUIDv7 key, whitelisted body, OPTIONAL scope, and validates key/booleans', async () => {
    const created: ExtensionProfileDraftResult = {
      ...makeProfileEntity(),
      draftVersion: { ...makeVersion(), createdBy: 'u1', updatedBy: 'u1' },
      fields: [{ ...makeField(), profileVersionId: VERSION_ID, createdBy: 'u1', updatedBy: 'u1' }],
    };
    const stub = new TradeHttpStub({ 'POST /extensions/profiles': created });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const dirtyField = { ...textField(), id: 'extra', ordinal: 99 } as unknown as ExtensionFieldInput;
      const input: CreateExtensionProfileInput = {
        code: 'ITEM_EXTRA',
        targetCode: 'CATALOG_ITEM',
        scopeTarget: 'COMPANY',
        fields: [dirtyField],
      };
      const res = await createProfile(input, key, { companyId: 'c1' });
      expect(res).toEqual(created);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/extensions/profiles',
          body: {
            code: 'ITEM_EXTRA',
            targetCode: 'CATALOG_ITEM',
            scopeTarget: 'COMPANY',
            fields: [textField()],
          },
          key,
          ifMatch: undefined,
          scope: { companyId: 'c1' },
          query: undefined,
        },
      ]);

      await expect(createProfile(input, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });
      await expect(createProfile(input, 'key-1')).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
      });
      await expect(
        createProfile({ ...input, fields: [{ ...textField(), isRequired: 'true' as unknown as boolean }] }, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { isRequired: ['invalid'] },
      });

      const conflict = new ApiError(409, 'TRADE.EXTENSION.DEFINITION_CONFLICT', {
        code: ['already exists'],
      });
      stub.register('POST', '/extensions/profiles', conflict);
      await expect(createProfile(input, newIdempotencyKey(), { companyId: 'c1' })).rejects.toBe(conflict);
    } finally {
      dispose();
    }
  });

  it('updateFields sends PATCH /extensions/profiles/:id with key, If-Match, whitelisted fields, and OPTIONAL scope', async () => {
    const updated: ExtensionProfileDraftResult = {
      ...makeProfileEntity({ version: 3 }),
      draftVersion: { ...makeVersion({ version: 2 }), createdBy: 'u1', updatedBy: 'u1' },
      fields: [{ ...makeField(), profileVersionId: VERSION_ID, createdBy: 'u1', updatedBy: 'u1' }],
    };
    const stub = new TradeHttpStub({ 'PATCH /extensions/profiles/:id': updated });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const dirty = { ...textField('spec.updated'), id: 'bad', ordinal: 4 } as unknown as ExtensionFieldInput;
      const res = await updateFields(PROFILE_ID, [dirty], 2, key, { companyId: 'c1' });
      expect(res).toEqual(updated);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'PATCH',
          path: `/extensions/profiles/${PROFILE_ID}`,
          body: { fields: [textField('spec.updated')] },
          key,
          ifMatch: '"2"',
          scope: { companyId: 'c1' },
          query: undefined,
        },
      ]);

      await expect(
        updateFields(PROFILE_ID, [textField()], undefined as unknown as number, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
      });

      const stale = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      stub.register('PATCH', '/extensions/profiles/:id', stale);
      await expect(updateFields(PROFILE_ID, [textField()], 1, newIdempotencyKey())).rejects.toBe(stale);
    } finally {
      dispose();
    }
  });

  it('validate sends POST /extensions/profiles/:id/validate with key and If-Match', async () => {
    const result: ExtValidateResult = {
      profileId: PROFILE_ID,
      versionId: VERSION_ID,
      passed: true,
      checkedAt: '2026-11-23T11:30:00.000Z',
      fieldCount: 1,
      diagnostics: [],
      version: 3,
    };
    const stub = new TradeHttpStub({ 'POST /extensions/profiles/:id/validate': result });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const res = await validate(PROFILE_ID, 2, key, { companyId: 'c1' });
      expect(res).toEqual(result);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/extensions/profiles/${PROFILE_ID}/validate`,
          body: undefined,
          key,
          ifMatch: '"2"',
          scope: { companyId: 'c1' },
          query: undefined,
        },
      ]);

      const conflict = new ApiError(409, 'TRADE.EXTENSION.PROFILE_CONFLICT');
      stub.register('POST', '/extensions/profiles/:id/validate', conflict);
      await expect(validate(PROFILE_ID, 2, newIdempotencyKey())).rejects.toBe(conflict);
    } finally {
      dispose();
    }
  });

  it('publish sends POST /extensions/profiles/:id/publish with key and If-Match', async () => {
    const result: ExtensionProfilePublishResult = {
      ...makeProfileEntity({ status: 'ACTIVE', version: 4, currentPublishedVersionId: VERSION_ID }),
      publishedVersion: { ...makeVersion({ status: 'PUBLISHED' }), createdBy: 'u1', updatedBy: 'u1' },
    };
    const stub = new TradeHttpStub({ 'POST /extensions/profiles/:id/publish': result });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const res = await publish(PROFILE_ID, 3, key, {});
      expect(res).toEqual(result);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/extensions/profiles/${PROFILE_ID}/publish`,
          body: undefined,
          key,
          ifMatch: '"3"',
          scope: {},
          query: undefined,
        },
      ]);

      const makerChecker = new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
      stub.register('POST', '/extensions/profiles/:id/publish', makerChecker);
      await expect(publish(PROFILE_ID, 3, newIdempotencyKey())).rejects.toBe(makerChecker);
    } finally {
      dispose();
    }
  });

  it('discardDraft sends DELETE /extensions/profiles/:id/draft with key and If-Match', async () => {
    const result: ExtensionDraftDiscardResult = {
      id: PROFILE_ID,
      version: 5,
      discardedVersionId: VERSION_ID,
    };
    const stub = new TradeHttpStub({ 'DELETE /extensions/profiles/:id/draft': result });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const res = await discardDraft(PROFILE_ID, 4, key, { companyId: 'c1' });
      expect(res).toEqual(result);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'DELETE',
          path: `/extensions/profiles/${PROFILE_ID}/draft`,
          body: undefined,
          key,
          ifMatch: '"4"',
          scope: { companyId: 'c1' },
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('retire sends POST /extensions/profiles/:id/retire with key and If-Match', async () => {
    const result = makeProfileEntity({ status: 'RETIRED', version: 6 });
    const stub = new TradeHttpStub({ 'POST /extensions/profiles/:id/retire': result });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const res = await retire(PROFILE_ID, 5, key, { companyId: 'c1' });
      expect(res).toEqual(result);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/extensions/profiles/${PROFILE_ID}/retire`,
          body: undefined,
          key,
          ifMatch: '"5"',
          scope: { companyId: 'c1' },
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('toFieldInput strips id and ordinal while preserving OWNER_DERIVED strategy', () => {
    const field = makeField({ defaultStrategy: 'OWNER_DERIVED', defaultValue: null });
    const input = toFieldInput(field);
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('ordinal');
    expect(input.defaultStrategy).toBe('OWNER_DERIVED');
    expect(input).not.toHaveProperty('defaultValue');
  });
});

describe('extensions.api (TradeHttp wire contract & envelope unwrap)', () => {
  const base = '/api/tenant/trade/v1';
  const envelope = (data: unknown) => ({
    success: true,
    data,
    correlationId: 'corr-ext',
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

  it('unwraps { success, data } envelope for list, get, counts, and publish with OPTIONAL scope headers', async () => {
    const countsPayload: ExtensionProfileCounts = {
      total: 1,
      byTarget: { CATALOG_ITEM: 1, QUOTATION: 0, SALES_ORDER: 0, PURCHASE_ORDER: 0 },
      byStatus: { DRAFT: 1, ACTIVE: 0, RETIRED: 0 },
    };
    const countsPending = getProfileCounts({}, {});
    const countsReq = http.expectOne(`${base}/extensions/profiles/counts`);
    expect(countsReq.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    countsReq.flush(envelope(countsPayload));
    await expect(countsPending).resolves.toEqual(countsPayload);

    const listPending = listProfiles({ page: 1, limit: 24 }, { companyId: 'c1', branchId: 'b1' });
    const listReq = http.expectOne(`${base}/extensions/profiles?page=1&limit=24`);
    expect(listReq.request.headers.get('x-mutakamel-company-id')).toBe('c1');
    expect(listReq.request.headers.get('x-mutakamel-branch-id')).toBe('b1');
    listReq.flush(envelope({ items: [makeProfile()], total: 1, page: 1, limit: 24 }));
    await expect(listPending).resolves.toMatchObject({ total: 1, items: [{ code: 'ITEM_EXTRA' }] });

    const key = newIdempotencyKey();
    const pubPayload: ExtensionProfilePublishResult = {
      ...makeProfileEntity({ status: 'ACTIVE', version: 3 }),
      publishedVersion: { ...makeVersion({ status: 'PUBLISHED' }), createdBy: 'u1', updatedBy: 'u1' },
    };
    const pubPending = publish(PROFILE_ID, 2, key, { companyId: 'c1' });
    const pubReq = http.expectOne(`${base}/extensions/profiles/${PROFILE_ID}/publish`);
    expect(pubReq.request.method).toBe('POST');
    expect(pubReq.request.headers.get('x-idempotency-key')).toBe(key);
    expect(pubReq.request.headers.get('if-match')).toBe('"2"');
    expect(pubReq.request.headers.get('x-mutakamel-company-id')).toBe('c1');
    pubReq.flush(envelope(pubPayload));
    await expect(pubPending).resolves.toMatchObject({ status: 'ACTIVE', version: 3 });
  });

  it('maps wrapped backend error responses with field details into Trade ApiError', async () => {
    const key = newIdempotencyKey();
    const pending = createProfile(
      { code: 'bad', targetCode: 'CATALOG_ITEM', scopeTarget: 'COMPANY', fields: [textField()] },
      key,
      { companyId: 'c1' },
    );
    const req = http.expectOne(`${base}/extensions/profiles`);
    req.flush(
      {
        success: false,
        errorCode: 'TRADE.VALIDATION_FAILED',
        details: { code: ['must match pattern'] },
        correlationId: 'corr-err',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(pending).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { code: ['must match pattern'] },
      correlationId: 'corr-err',
    });
  });
});
