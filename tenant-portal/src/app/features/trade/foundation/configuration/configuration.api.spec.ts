import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../../core/api/core-http';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { TradeHttp, bindTradeHttp, bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import {
  cancelVersion,
  createDefinition,
  createVersion,
  getDefinition,
  listDefinitions,
  publishVersion,
  retireVersion,
  testVersion,
} from './configuration.api';
import type {
  ConfigDefinition,
  ConfigVersion,
  CreatedConfigDefinition,
  CreatedConfigVersion,
  PublishedConfigVersion,
  TestResult,
} from './configuration.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEF_ID = '01900000-0000-7000-8000-000000000010';
const VER_ID = '01900000-0000-7000-8000-000000000020';
const PREV_VER_ID = '01900000-0000-7000-8000-000000000019';

function makeWireVersion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: VER_ID,
    versionNumber: 2,
    version: 3,
    scopeTarget: 'COMPANY',
    companyId: 'c1',
    branchId: null,
    channelId: null,
    value: 21,
    status: 'TESTED',
    effectiveState: 'TESTED',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    contentHash: 'abc123',
    createdBy: 'u2',
    createdByName: 'Sara Ali',
    testEvidence: {
      passed: true,
      diagnostics: [],
      testedAt: '2026-11-23T10:00:00.000Z',
      testedBy: 'u2',
    },
    ...overrides,
  };
}

function makeWireDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: DEF_ID,
    key: 'trade.quotation.default_validity_days',
    valueSchema: { type: 'integer', minimum: 1, maximum: 365 },
    allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
    mergeStrategy: 'MIN',
    riskClass: 'LOW',
    companyLockPolicy: { requireCompanyBaseline: true },
    version: 1,
    versions: [makeWireVersion()],
    ...overrides,
  };
}

function makeWireRawVersion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: VER_ID,
    definitionId: DEF_ID,
    versionNumber: 3,
    version: 1,
    scopeTarget: 'BRANCH',
    companyId: 'c1',
    branchId: 'b1',
    channelId: null,
    value: 14,
    status: 'DRAFT',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    contentHash: 'hash-3',
    createdBy: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('configuration.api', () => {
  it('listDefinitions calls GET /configuration/definitions with OPTIONAL scope, page/limit query, normalizes F-1/F-2/F-3 testEvidence and nullable createdBy, and propagates validation errors', async () => {
    const wireDef = makeWireDefinition({
      versions: [
        makeWireVersion({
          createdBy: null,
          createdByName: null,
          testEvidence: {
            passed: false,
            diagnostics: { code: 'TRADE.CONFIGURATION.VALUE_INVALID', paths: ['$.margins.top'] },
            testedAt: '2026-11-23T11:00:00.000Z',
            testedBy: null,
          },
        }),
      ],
    });
    const stub = new TradeHttpStub({
      'GET /configuration/definitions': { items: [wireDef], total: 1, page: 2, limit: 12 },
    });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const result = await listDefinitions({ companyId: 'c1', branchId: 'b1' }, { page: 2, limit: 12 });
      expect(result).toEqual({
        items: [
          {
            id: DEF_ID,
            key: 'trade.quotation.default_validity_days',
            valueSchema: { type: 'integer', minimum: 1, maximum: 365 },
            allowedScopes: ['TENANT', 'COMPANY', 'BRANCH'],
            mergeStrategy: 'MIN',
            riskClass: 'LOW',
            companyLockPolicy: { requireCompanyBaseline: true },
            version: 1,
            versions: [
              {
                id: VER_ID,
                versionNumber: 2,
                version: 3,
                scopeTarget: 'COMPANY',
                companyId: 'c1',
                branchId: null,
                channelId: null,
                value: 21,
                status: 'TESTED',
                effectiveState: 'TESTED',
                effectiveFrom: '2026-12-01T00:00:00.000Z',
                effectiveTo: null,
                supersededAt: null,
                supersededByVersionId: null,
                contentHash: 'abc123',
                createdBy: null,
                createdByName: null,
                testEvidence: {
                  passed: false,
                  diagnostics: ['TRADE.CONFIGURATION.VALUE_INVALID', '$.margins.top'],
                  testedAt: '2026-11-23T11:00:00.000Z',
                  testedBy: null,
                },
              },
            ],
          } satisfies ConfigDefinition,
        ],
        total: 1,
        page: 2,
        limit: 12,
      });
      expect(stub.recordedReads()).toEqual([
        {
          path: '/configuration/definitions',
          query: { page: 2, limit: 12 },
          scope: { companyId: 'c1', branchId: 'b1' },
        },
      ]);

      stub.reset();
      await listDefinitions({});
      expect(stub.recordedReads()).toEqual([
        { path: '/configuration/definitions', query: undefined, scope: {} },
      ]);

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        limit: ['limit must not be greater than 100'],
      });
      stub.register('GET', '/configuration/definitions', validationErr);
      await expect(listDefinitions({ companyId: 'c1' }, { limit: 999 })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { limit: ['limit must not be greater than 100'] },
      });
    } finally {
      dispose();
    }
  });

  it('getDefinition calls GET /configuration/definitions/:id with OPTIONAL scope, unifies version projection (F-1/F-2/F-3), and propagates 404/403', async () => {
    const wireDef = makeWireDefinition({
      versions: [
        makeWireVersion({
          createdBy: null,
          createdByName: null,
          testEvidence: {
            passed: false,
            diagnostics: ['BRANCH_WEAKENS_MIN'],
            testedAt: '2026-11-23T10:30:00.000Z',
            testedBy: 'u3',
          },
        }),
      ],
    });
    const stub = new TradeHttpStub({ 'GET /configuration/definitions/:id': wireDef });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const detail = await getDefinition(DEF_ID, { companyId: 'c1' });
      expect(detail.versions[0]).toMatchObject({
        createdBy: null,
        createdByName: null,
        testEvidence: {
          passed: false,
          diagnostics: ['BRANCH_WEAKENS_MIN'],
          testedAt: '2026-11-23T10:30:00.000Z',
          testedBy: 'u3',
        },
      });
      expect(stub.recordedReads()).toEqual([
        { path: `/configuration/definitions/${DEF_ID}`, query: undefined, scope: { companyId: 'c1' } },
      ]);

      const notFound = new ApiError(404, 'TRADE.CONFIGURATION.DEFINITION_NOT_FOUND');
      stub.register('GET', '/configuration/definitions/:id', notFound);
      await expect(getDefinition('missing', {})).rejects.toBe(notFound);
    } finally {
      dispose();
    }
  });

  it('createDefinition sends POST /configuration/definitions with UUIDv7 key, NONE scope (no headers), whitelisted DTO body, and raw result without versions (F-5)', async () => {
    const wireCreated = {
      id: DEF_ID,
      key: 'trade.sales.max_discount',
      valueSchema: { type: 'number', minimum: 0, maximum: 50 },
      allowedScopes: ['TENANT', 'COMPANY'],
      mergeStrategy: 'MIN',
      riskClass: 'MEDIUM',
      companyLockPolicy: { requireCompanyBaseline: true },
      version: 1,
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    };
    const stub = new TradeHttpStub({ 'POST /configuration/definitions': wireCreated });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const created: CreatedConfigDefinition = await createDefinition(
        {
          key: 'trade.sales.max_discount',
          valueSchema: { type: 'number', minimum: 0, maximum: 50 },
          allowedScopes: ['TENANT', 'COMPANY'],
          mergeStrategy: 'MIN',
          riskClass: 'MEDIUM',
          companyLockPolicy: { requireCompanyBaseline: true, extraLock: 'strip' } as never,
          extraField: 'strip-me',
        } as never,
        key,
      );

      expect(created).toEqual({
        id: DEF_ID,
        key: 'trade.sales.max_discount',
        valueSchema: { type: 'number', minimum: 0, maximum: 50 },
        allowedScopes: ['TENANT', 'COMPANY'],
        mergeStrategy: 'MIN',
        riskClass: 'MEDIUM',
        companyLockPolicy: { requireCompanyBaseline: true },
        version: 1,
      });
      expect('versions' in created).toBe(false);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/configuration/definitions',
          body: {
            key: 'trade.sales.max_discount',
            valueSchema: { type: 'number', minimum: 0, maximum: 50 },
            allowedScopes: ['TENANT', 'COMPANY'],
            mergeStrategy: 'MIN',
            riskClass: 'MEDIUM',
            companyLockPolicy: { requireCompanyBaseline: true },
          },
          key,
          ifMatch: undefined,
          scope: undefined,
          query: undefined,
        },
      ]);
      expect(stub.recordedWrites()[0].key).toMatch(UUID_V7_REGEX);

      await expect(
        createDefinition(
          {
            key: 'trade.x',
            valueSchema: { type: 'boolean' },
            allowedScopes: ['TENANT'],
            mergeStrategy: 'OVERRIDE',
            riskClass: 'LOW',
            companyLockPolicy: {},
          },
          '',
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

      await expect(
        createDefinition(
          {
            key: 'trade.x',
            valueSchema: { type: 'boolean' },
            allowedScopes: ['TENANT'],
            mergeStrategy: 'OVERRIDE',
            riskClass: 'LOW',
            companyLockPolicy: {},
          },
          'not-v7',
        ),
      ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });
      expect(stub.recordedWrites()).toHaveLength(1);

      const fieldErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { key: ['invalid key'] });
      stub.register('POST', '/configuration/definitions', fieldErr);
      await expect(
        createDefinition(
          {
            key: 'bad',
            valueSchema: { type: 'boolean' },
            allowedScopes: ['TENANT'],
            mergeStrategy: 'OVERRIDE',
            riskClass: 'LOW',
            companyLockPolicy: {},
          },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { key: ['invalid key'] },
      });
    } finally {
      dispose();
    }
  });

  it('createVersion sends POST /configuration/definitions/:id/versions with key, If-Match, OPTIONAL scope per switch, whitelisted body, and raw response (F-5)', async () => {
    const wireCreated = makeWireRawVersion();
    const stub = new TradeHttpStub({ 'POST /configuration/definitions/:id/versions': wireCreated });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const created: CreatedConfigVersion = await createVersion(
        { companyId: 'c1', branchId: 'b1' },
        DEF_ID,
        1,
        {
          scopeTarget: 'BRANCH',
          value: 14,
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
          extra: 'strip',
        } as never,
        key,
      );

      expect(created).toEqual({
        id: VER_ID,
        definitionId: DEF_ID,
        versionNumber: 3,
        version: 1,
        scopeTarget: 'BRANCH',
        companyId: 'c1',
        branchId: 'b1',
        channelId: null,
        value: 14,
        status: 'DRAFT',
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: null,
        supersededAt: null,
        supersededByVersionId: null,
        contentHash: 'hash-3',
        createdBy: null,
      });
      expect('effectiveState' in created).toBe(false);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/configuration/definitions/${DEF_ID}/versions`,
          body: {
            scopeTarget: 'BRANCH',
            value: 14,
            effectiveFrom: '2026-12-01T00:00:00.000Z',
            effectiveTo: null,
          },
          key,
          ifMatch: '"1"',
          scope: { companyId: 'c1', branchId: 'b1' },
          query: undefined,
        },
      ]);

      await createVersion(
        {},
        DEF_ID,
        1,
        {
          scopeTarget: 'TENANT',
          value: 30,
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
        },
        newIdempotencyKey(),
      );
      expect(stub.recordedWrites()[1].scope).toEqual({});

      const valueErr = new ApiError(422, 'TRADE.CONFIGURATION.VALUE_INVALID', { path: ['$.margins.top'] });
      stub.register('POST', '/configuration/definitions/:id/versions', valueErr);
      await expect(
        createVersion(
          { companyId: 'c1' },
          DEF_ID,
          1,
          {
            scopeTarget: 'COMPANY',
            value: -5,
            effectiveFrom: '2026-12-01T00:00:00.000Z',
            effectiveTo: null,
          },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.CONFIGURATION.VALUE_INVALID',
        details: { path: ['$.margins.top'] },
      });
    } finally {
      dispose();
    }
  });

  it('testVersion sends POST /configuration/versions/:id/test with empty body, key, If-Match, OPTIONAL scope, and normalizes TestResult diagnostics', async () => {
    const wireResult = {
      evidenceId: 'ev-1',
      passed: false,
      diagnostics: ['TRADE.CONFIGURATION.VALUE_INVALID', '$.margins.top'],
      mergeStrategy: 'MIN',
      contentHash: 'hash-3',
      version: 1,
    };
    const stub = new TradeHttpStub({ 'POST /configuration/versions/:id/test': wireResult });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const result: TestResult = await testVersion({ companyId: 'c1', branchId: 'b1' }, VER_ID, 2, key);
      expect(result).toEqual({
        evidenceId: 'ev-1',
        passed: false,
        diagnostics: ['TRADE.CONFIGURATION.VALUE_INVALID', '$.margins.top'],
        mergeStrategy: 'MIN',
        contentHash: 'hash-3',
        version: 1,
      });
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/configuration/versions/${VER_ID}/test`,
          body: undefined,
          key,
          ifMatch: '"2"',
          scope: { companyId: 'c1', branchId: 'b1' },
          query: undefined,
        },
      ]);

      const stale = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      stub.register('POST', '/configuration/versions/:id/test', stale);
      await expect(testVersion({ companyId: 'c1' }, VER_ID, 2, newIdempotencyKey())).rejects.toBe(stale);
    } finally {
      dispose();
    }
  });

  it('publishVersion sends POST /configuration/versions/:id/publish with key, If-Match, OPTIONAL scope, whitelisted supersedesVersionId, and returns raw version + epoch (F-5)', async () => {
    const wirePublished = {
      ...makeWireRawVersion({ status: 'SCHEDULED', version: 4, scopeTarget: 'COMPANY', branchId: null }),
      configurationEpoch: 9,
    };
    const stub = new TradeHttpStub({ 'POST /configuration/versions/:id/publish': wirePublished });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const key = newIdempotencyKey();
      const published: PublishedConfigVersion = await publishVersion(
        { companyId: 'c1' },
        VER_ID,
        3,
        { supersedesVersionId: PREV_VER_ID, extra: 'strip' } as never,
        key,
      );
      expect(published).toMatchObject({
        id: VER_ID,
        definitionId: DEF_ID,
        status: 'SCHEDULED',
        version: 4,
        configurationEpoch: 9,
      });
      expect('effectiveState' in published).toBe(false);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/configuration/versions/${VER_ID}/publish`,
          body: { supersedesVersionId: PREV_VER_ID },
          key,
          ifMatch: '"3"',
          scope: { companyId: 'c1' },
          query: undefined,
        },
      ]);

      await publishVersion({}, VER_ID, 3, {}, newIdempotencyKey());
      expect(stub.recordedWrites()[1]).toMatchObject({
        body: {},
        scope: {},
      });

      const makerChecker = new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
      stub.register('POST', '/configuration/versions/:id/publish', makerChecker);
      await expect(publishVersion({ companyId: 'c1' }, VER_ID, 3, {}, newIdempotencyKey())).rejects.toBe(
        makerChecker,
      );
    } finally {
      dispose();
    }
  });

  it('retireVersion and cancelVersion send POST with empty body, key, If-Match, OPTIONAL scope, and return projected ConfigVersion', async () => {
    const retiredWire = makeWireVersion({ status: 'RETIRED', effectiveState: 'RETIRED', version: 5 });
    const cancelledWire = makeWireVersion({ status: 'RETIRED', effectiveState: 'RETIRED', version: 2 });
    const stub = new TradeHttpStub({
      'POST /configuration/versions/:id/retire': retiredWire,
      'POST /configuration/versions/:id/cancel': cancelledWire,
    });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const k1 = newIdempotencyKey();
      const retired: ConfigVersion = await retireVersion({ companyId: 'c1', branchId: 'b1' }, VER_ID, 4, k1);
      expect(retired.effectiveState).toBe('RETIRED');
      expect(retired.status).toBe('RETIRED');

      const k2 = newIdempotencyKey();
      const cancelled: ConfigVersion = await cancelVersion({}, VER_ID, 1, k2);
      expect(cancelled.effectiveState).toBe('RETIRED');
      expect(cancelled.status).toBe('RETIRED');

      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/configuration/versions/${VER_ID}/retire`,
          body: undefined,
          key: k1,
          ifMatch: '"4"',
          scope: { companyId: 'c1', branchId: 'b1' },
          query: undefined,
        },
        {
          method: 'POST',
          path: `/configuration/versions/${VER_ID}/cancel`,
          body: undefined,
          key: k2,
          ifMatch: '"1"',
          scope: {},
          query: undefined,
        },
      ]);

      const disallowed = new ApiError(409, 'TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED');
      stub.register('POST', '/configuration/versions/:id/retire', disallowed);
      await expect(retireVersion({ companyId: 'c1' }, VER_ID, 4, newIdempotencyKey())).rejects.toBe(disallowed);
    } finally {
      dispose();
    }
  });
});

describe('configuration.api (TradeHttp wire contract & scope switch)', () => {
  const base = '/api/tenant/trade/v1';
  const envelope = (data: unknown) => ({
    success: true,
    data,
    correlationId: 'corr-cfg',
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

  it('Tenant switch sends no x-mutakamel-* headers while Branch switch sends both company and branch headers', async () => {
    const pagePayload = { items: [makeWireDefinition()], total: 1, page: 1, limit: 24 };

    const tenantPending = listDefinitions({}, { page: 1, limit: 24 });
    const tenantReq = http.expectOne(`${base}/configuration/definitions?page=1&limit=24`);
    expect(tenantReq.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    tenantReq.flush(envelope(pagePayload));
    await expect(tenantPending).resolves.toMatchObject({ total: 1 });

    const branchPending = listDefinitions({ companyId: 'c1', branchId: 'b1' }, { page: 1, limit: 24 });
    const branchReq = http.expectOne(`${base}/configuration/definitions?page=1&limit=24`);
    expect(branchReq.request.headers.get('x-mutakamel-company-id')).toBe('c1');
    expect(branchReq.request.headers.get('x-mutakamel-branch-id')).toBe('b1');
    branchReq.flush(envelope(pagePayload));
    await expect(branchPending).resolves.toMatchObject({ total: 1 });
  });

  it('createDefinition sends zero scope headers and unwraps raw definition without versions', async () => {
    const key = newIdempotencyKey();
    const rawDef = {
      id: DEF_ID,
      key: 'trade.quotation.auto_expire',
      valueSchema: { type: 'boolean' },
      allowedScopes: ['TENANT'],
      mergeStrategy: 'DENY_WINS',
      riskClass: 'LOW',
      companyLockPolicy: {},
      version: 1,
    };

    const pending = createDefinition(
      {
        key: 'trade.quotation.auto_expire',
        valueSchema: { type: 'boolean' },
        allowedScopes: ['TENANT'],
        mergeStrategy: 'DENY_WINS',
        riskClass: 'LOW',
        companyLockPolicy: {},
      },
      key,
    );

    const req = http.expectOne(`${base}/configuration/definitions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    req.flush(envelope(rawDef), { status: 201, statusText: 'Created' });
    const result = await pending;
    expect(result.versions).toBeUndefined();
    expect(result.key).toBe('trade.quotation.auto_expire');
  });
});
