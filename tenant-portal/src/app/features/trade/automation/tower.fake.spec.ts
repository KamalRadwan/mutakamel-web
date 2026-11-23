import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../core/api/core-http';
import { ApiError, type TradeContext, newIdempotencyKey } from '../shared/trade-api';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { TradeHttp, bindTradeHttp, bindTradeHttpForTest, tradeQueries } from '../shared/trade-http';
import * as api from './tower.api';
import { bulkResolve, getCounts, getException, listExceptions, resolve } from './tower.api';
import {
  type ResolveExceptionInput,
  TOWER_CATEGORIES,
  TOWER_SEVERITIES,
  TOWER_STATUSES,
  type TowerCounts,
  type TowerException,
  type TowerExceptionPage,
  type TowerFilterQuery,
  resolutionCodesFor,
  toTowerCardCounts,
} from './tower.model';
import { formatTowerSafeErrorCode, towerSourceRoute, translateTowerProblem } from './tower.util';

const EXC_ID = '0193a000-0000-7000-8000-000000000101';
const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const KEPT_ARTIFACT = '0193a000-0000-7000-8000-00000000abcd';

const TENANT: TradeContext = {};
const C1: TradeContext = { companyId: COMPANY_ID };
const C1_B1: TradeContext = { companyId: COMPANY_ID, branchId: BRANCH_ID };

function makeException(overrides: Partial<TowerException> = {}): TowerException {
  return {
    id: EXC_ID,
    version: 2,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    sourceOwner: 'TRADE',
    sourceType: 'QUOTATION_PDF_RENDER',
    sourceId: '0193a000-0000-7000-8000-000000000201',
    sourceVersion: 1,
    category: 'OWNER_TRANSPORT_EXHAUSTED',
    severity: 'CRITICAL',
    status: 'OPEN',
    retryClass: 'TRANSIENT',
    safeErrorCode: 'TRADE.OWNER.TRANSPORT_TIMEOUT',
    intentKey: null,
    correlationId: 'corr-ct-001',
    assignedUserId: null,
    resolvedAt: null,
    resolutionReasonCode: null,
    source: {
      type: 'QUOTATION_PDF_RENDER',
      id: '0193a000-0000-7000-8000-000000000201',
      label: 'QT-2026-0142',
      documentType: 'QUOTATION',
      documentNumber: 'QT-2026-0142',
      link: { kind: 'QUOTATION', id: '0193a000-0000-7000-8000-000000000301' },
    },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeCounts(overrides: Partial<TowerCounts> = {}): TowerCounts {
  return {
    total: 5,
    byStatus: {
      OPEN: 2,
      ACKNOWLEDGED: 1,
      ACTION_PENDING: 1,
      RECONCILIATION_PENDING: 0,
      RESOLVED: 1,
      QUARANTINED: 0,
    },
    bySeverity: { INFO: 0, WARNING: 1, HIGH: 3, CRITICAL: 1 },
    byCategory: {
      PROFILE_ACTIVATION_CONFLICT: 1,
      RESULT_CONFLICT: 1,
      OWNER_TRANSPORT_EXHAUSTED: 2,
      DATA_CORRECTION_REQUIRED: 1,
    },
    resolvedToday: 1,
    ...overrides,
  };
}

const OWNER_INPUT: ResolveExceptionInput = {
  resolutionCode: 'OWNER_RESULT_APPLIED',
  reasonCode: 'CONFIRMED_WITH_OWNER',
  note: 'owner confirmed',
  evidence: { ticket: 'INC-2' },
};

describe('tower.api (TradeHttpStub)', () => {
  it('getCounts calls GET /control-tower/exceptions/counts once, whitelists query params, applies OPTIONAL scope, and unwraps counts', async () => {
    const counts = makeCounts();
    const stub = new TradeHttpStub({ 'GET /control-tower/exceptions/counts': counts });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const res = await getCounts(C1, {
        includeBranches: true,
        severity: 'CRITICAL',
        category: 'OWNER_TRANSPORT_EXHAUSTED',
        sort: 'severity',
        ...({ status: ['OPEN'], page: 2, limit: 50 } as unknown as TowerFilterQuery),
      });
      expect(res).toEqual(counts);
      expect(Object.keys(res.byStatus).sort()).toEqual([...TOWER_STATUSES].sort());
      expect(Object.keys(res.bySeverity).sort()).toEqual([...TOWER_SEVERITIES].sort());
      expect(Object.keys(res.byCategory).sort()).toEqual([...TOWER_CATEGORIES].sort());
      expect(toTowerCardCounts(res)).toEqual({
        open: 3,
        actionPending: 1,
        quarantined: 0,
        resolved: 1,
        resolvedToday: 1,
        highOrCritical: 4,
        total: 5,
      });

      expect(stub.recordedReads()).toEqual([
        {
          path: '/control-tower/exceptions/counts',
          query: {
            severity: 'CRITICAL',
            category: 'OWNER_TRANSPORT_EXHAUSTED',
            includeBranches: true,
            sort: 'severity',
          },
          scope: { companyId: COMPANY_ID },
        },
      ]);

      stub.reset();
      await getCounts(TENANT, { branchId: '' });
      expect(stub.recordedReads()).toEqual([
        { path: '/control-tower/exceptions/counts', query: undefined, scope: {} },
      ]);

      const queryErr = new ApiError(400, 'TRADE.CONTROL_TOWER.QUERY_INVALID', {
        category: ['invalid filter combination'],
      });
      stub.register('GET', '/control-tower/exceptions/counts', queryErr);
      await expect(getCounts(C1, { category: 'RESULT_CONFLICT' })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.CONTROL_TOWER.QUERY_INVALID',
        details: { category: ['invalid filter combination'] },
      });
    } finally {
      dispose();
    }
  });

  it('listExceptions calls GET /control-tower/exceptions with comma-joined status and keeps asOf on the page envelope', async () => {
    const pageFixture: TowerExceptionPage = {
      items: [makeException()],
      total: 1,
      page: 1,
      limit: 24,
      asOf: '2026-11-23T12:34:56.789Z',
    };
    const stub = new TradeHttpStub({ 'GET /control-tower/exceptions': pageFixture });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const page = await listExceptions(C1, {
        status: ['OPEN', 'ACKNOWLEDGED'],
        branchId: BRANCH_ID,
        severity: 'CRITICAL',
        sort: 'severity',
        page: 1,
        limit: 24,
      });
      expect(page).toEqual(pageFixture);
      expect(page.asOf).toBe('2026-11-23T12:34:56.789Z');
      expect(stub.recordedReads()).toEqual([
        {
          path: '/control-tower/exceptions',
          query: {
            status: 'OPEN,ACKNOWLEDGED',
            severity: 'CRITICAL',
            branchId: BRANCH_ID,
            sort: 'severity',
            page: 1,
            limit: 24,
          },
          scope: { companyId: COMPANY_ID },
        },
      ]);

      const scopeErr = new ApiError(403, 'TRADE.CONTROL_TOWER.SCOPE_DENIED', {
        reason: ['branch_not_accessible'],
      });
      stub.register('GET', '/control-tower/exceptions', scopeErr);
      await expect(listExceptions(C1, { branchId: 'b-gone' })).rejects.toMatchObject({
        status: 403,
        code: 'TRADE.CONTROL_TOWER.SCOPE_DENIED',
        details: { reason: ['branch_not_accessible'] },
      });
    } finally {
      dispose();
    }
  });

  it('getException calls GET /control-tower/exceptions/:id with OPTIONAL scope and unwraps detail including attempts & asOf', async () => {
    const detail = makeException({
      asOf: '2026-11-23T12:35:00.000Z',
      allowedResolutionCodes: ['OWNER_RESULT_APPLIED'],
      attempts: [
        {
          id: 'att-001',
          ownerCode: 'accounting-ledger',
          sourceType: 'QUOTATION_PDF_RENDER',
          sourceId: '0193a000-0000-7000-8000-000000000201',
          sourceVersion: 1,
          status: 'EXHAUSTED',
          retryClass: 'TRANSIENT',
          attemptCount: 5,
          nextAttemptAt: null,
          lastErrorCode: 'UPSTREAM_TIMEOUT',
          version: 5,
          updatedAt: '2026-11-23T09:55:00.000Z',
        },
      ],
    });
    const stub = new TradeHttpStub({ 'GET /control-tower/exceptions/:id': detail });
    const dispose = bindTradeHttpForTest(stub);

    try {
      const loaded = await getException(EXC_ID, C1_B1);
      expect(loaded).toEqual(detail);
      expect(loaded.asOf).toBe('2026-11-23T12:35:00.000Z');
      expect(stub.recordedReads()).toEqual([
        {
          path: `/control-tower/exceptions/${EXC_ID}`,
          query: undefined,
          scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
        },
      ]);

      const notFound = new ApiError(404, 'TRADE.CONTROL_TOWER.NOT_FOUND');
      stub.register('GET', '/control-tower/exceptions/:id', notFound);
      await expect(getException('missing', TENANT)).rejects.toBe(notFound);
    } finally {
      dispose();
    }
  });

  it('resolve sends POST /control-tower/exceptions/:id/resolve with reasonCode, key, If-Match, OPTIONAL scope, and never sends deprecated reason', async () => {
    const resolved = makeException({
      version: 3,
      status: 'RESOLVED',
      resolutionReasonCode: 'CONFIRMED_WITH_OWNER',
      resolutionReasonNote: 'owner confirmed',
      resolvedAt: '2026-11-23T12:40:00.000Z',
    });
    const stub = new TradeHttpStub({ 'POST /control-tower/exceptions/:id/resolve': resolved });
    const dispose = bindTradeHttpForTest(stub);
    const key = newIdempotencyKey();

    try {
      const dirtyInput = {
        ...OWNER_INPUT,
        reason: 'deprecated-should-not-be-sent',
        reasonNote: 'old-field',
      } as unknown as ResolveExceptionInput;

      const updated = await resolve(EXC_ID, dirtyInput, 2, key, C1_B1);
      expect(updated).toEqual(resolved);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/control-tower/exceptions/${EXC_ID}/resolve`,
          body: {
            resolutionCode: 'OWNER_RESULT_APPLIED',
            reasonCode: 'CONFIRMED_WITH_OWNER',
            note: 'owner confirmed',
            evidence: { ticket: 'INC-2' },
          },
          key,
          ifMatch: '"2"',
          scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
          query: undefined,
        },
      ]);
      const sentBody = stub.recordedWrites()[0].body as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty('reason');
      expect(sentBody).not.toHaveProperty('reasonNote');

      stub.reset();
      await resolve(
        EXC_ID,
        {
          resolutionCode: 'RESULT_ACCEPTED',
          reasonCode: 'DUPLICATE_RESULT_IGNORED',
          note: null,
          evidence: { keptArtifactId: KEPT_ARTIFACT },
        },
        2,
        newIdempotencyKey(),
        C1,
      );
      expect(stub.recordedWrites()[0].body).toEqual({
        resolutionCode: 'RESULT_ACCEPTED',
        reasonCode: 'DUPLICATE_RESULT_IGNORED',
        evidence: { keptArtifactId: KEPT_ARTIFACT },
      });

      await expect(resolve(EXC_ID, OWNER_INPUT, 2, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });
      await expect(resolve(EXC_ID, OWNER_INPUT, 2, 'bad-key')).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
      });
      await expect(
        resolve(EXC_ID, OWNER_INPUT, 0, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
      });

      const invalid = new ApiError(422, 'TRADE.CONTROL_TOWER.RESOLUTION_INVALID', {
        reason: ['evidence_invalid'],
      });
      stub.register('POST', '/control-tower/exceptions/:id/resolve', invalid);
      await expect(
        resolve(EXC_ID, OWNER_INPUT, 2, newIdempotencyKey(), C1_B1),
      ).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.CONTROL_TOWER.RESOLUTION_INVALID',
        details: { reason: ['evidence_invalid'] },
      });
    } finally {
      dispose();
    }
  });

  it('keeps bulkResolve disabled (B13) and exposes no retry function (ق7)', async () => {
    const stub = new TradeHttpStub();
    const dispose = bindTradeHttpForTest(stub);

    try {
      await expect(
        bulkResolve(
          C1,
          {
            selection: { kind: 'IDS', ids: [EXC_ID] },
            ...OWNER_INPUT,
          },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 501,
        code: 'TRADE.CONTROL_TOWER.BULK_RESOLVE_DISABLED',
      });
      expect(stub.recordedReads()).toEqual([]);
      expect(stub.recordedWrites()).toEqual([]);
      expect('retry' in api).toBe(false);
    } finally {
      dispose();
    }
  });
});

describe('tower.api (TradeHttp wire contract & envelope unwrap)', () => {
  const base = '/api/tenant/trade/v1';
  const envelope = (data: unknown) => ({
    success: true,
    data,
    correlationId: 'corr-twr',
    timestamp: '2026-11-23T12:00:00.000Z',
  });

  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    dispose = bindTradeHttpForTest();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName =
      doc.location.protocol === 'https:'
        ? '__Host-mutakamel-tenant-csrf'
        : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=csrf-proof`);
    bindTradeHttp(TestBed.inject(TradeHttp), tradeQueries(), TestBed.inject(CoreHttp));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    dispose();
  });

  it('unwraps { success, data } envelope for counts, list (keeping asOf), detail, and resolve with headers', async () => {
    const countsPayload = makeCounts();
    const countsPending = getCounts(TENANT, {});
    const countsReq = http.expectOne(`${base}/control-tower/exceptions/counts`);
    expect(
      countsReq.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-')),
    ).toEqual([]);
    countsReq.flush(envelope(countsPayload));
    await expect(countsPending).resolves.toEqual(countsPayload);

    const listPayload: TowerExceptionPage = {
      items: [makeException()],
      total: 1,
      page: 1,
      limit: 24,
      asOf: '2026-11-23T12:00:01.000Z',
    };
    const listPending = listExceptions(C1, { status: ['OPEN', 'ACKNOWLEDGED'], branchId: BRANCH_ID });
    const listReq = http.expectOne(
      `${base}/control-tower/exceptions?branchId=${BRANCH_ID}&status=OPEN,ACKNOWLEDGED`,
    );
    expect(listReq.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY_ID);
    expect(listReq.request.headers.get('x-mutakamel-branch-id')).toBeNull();
    listReq.flush(envelope(listPayload));
    await expect(listPending).resolves.toEqual(listPayload);

    const detailPayload = makeException({ allowedResolutionCodes: ['OWNER_RESULT_APPLIED'] });
    const detailPending = getException(EXC_ID, C1_B1);
    const detailReq = http.expectOne(`${base}/control-tower/exceptions/${EXC_ID}`);
    expect(detailReq.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY_ID);
    expect(detailReq.request.headers.get('x-mutakamel-branch-id')).toBe(BRANCH_ID);
    detailReq.flush(envelope(detailPayload));
    await expect(detailPending).resolves.toEqual(detailPayload);

    const key = newIdempotencyKey();
    const resolvedPayload = makeException({ status: 'RESOLVED', version: 3 });
    const resolvePending = resolve(EXC_ID, OWNER_INPUT, 2, key, C1_B1);
    const resolveReq = http.expectOne(`${base}/control-tower/exceptions/${EXC_ID}/resolve`);
    expect(resolveReq.request.method).toBe('POST');
    expect(resolveReq.request.headers.get('x-idempotency-key')).toBe(key);
    expect(resolveReq.request.headers.get('if-match')).toBe('"2"');
    expect(resolveReq.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY_ID);
    expect(resolveReq.request.headers.get('x-mutakamel-branch-id')).toBe(BRANCH_ID);
    expect(resolveReq.request.body).toEqual({
      resolutionCode: 'OWNER_RESULT_APPLIED',
      reasonCode: 'CONFIRMED_WITH_OWNER',
      note: 'owner confirmed',
      evidence: { ticket: 'INC-2' },
    });
    resolveReq.flush(envelope(resolvedPayload));
    await expect(resolvePending).resolves.toEqual(resolvedPayload);
  });

  it('maps service errors into Trade ApiError with details and correlationId', async () => {
    const key = newIdempotencyKey();
    const pending = resolve(EXC_ID, OWNER_INPUT, 2, key, C1);
    const req = http.expectOne(`${base}/control-tower/exceptions/${EXC_ID}/resolve`);
    req.flush(
      {
        success: false,
        errorCode: 'TRADE.CONTROL_TOWER.TARGET_STALE',
        details: { sourceVersion: ['changed'] },
        correlationId: 'corr-stale',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(pending).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.CONTROL_TOWER.TARGET_STALE',
      details: { sourceVersion: ['changed'] },
      correlationId: 'corr-stale',
    });
  });
});

describe('tower.util & tower.model', () => {
  it('shows safeErrorCode verbatim without translating it', () => {
    const fakeTransloco = {
      translate: (key: string) => `TRANSLATED:${key}`,
    } as never;

    expect(formatTowerSafeErrorCode('  TRADE.OWNER.TRANSPORT_TIMEOUT  ')).toBe(
      'TRADE.OWNER.TRANSPORT_TIMEOUT',
    );
    expect(translateTowerProblem(fakeTransloco, 'ARTIFACT_DIGEST_MISMATCH')).toBe(
      'ARTIFACT_DIGEST_MISMATCH',
    );
    expect(translateTowerProblem(fakeTransloco, '   ', '—')).toBe('—');
  });

  it('maps supported source link kinds to router commands', () => {
    expect(
      towerSourceRoute({
        type: 'DOCUMENT_PROFILE_VERSION',
        id: 'v1',
        label: 'DEFAULT',
        link: { kind: 'DOCUMENT_PROFILE_VERSION', id: 'v1', parentId: 'p1' },
      }),
    ).toEqual({ commands: ['/trade/governance/document-profiles', 'p1', 'versions', 'v1'] });

    expect(
      towerSourceRoute({
        type: 'QUOTATION_PDF_RENDER',
        id: 'j1',
        label: 'QT-1',
        link: { kind: 'QUOTATION', id: 'q1' },
      }),
    ).toEqual({ commands: ['/trade/documents/quotations', 'q1'] });

    expect(towerSourceRoute({ type: 'UNKNOWN', id: 'x', label: null })).toBeNull();
    expect(resolutionCodesFor('RESULT_CONFLICT')).toEqual(['RESULT_ACCEPTED']);
  });
});
