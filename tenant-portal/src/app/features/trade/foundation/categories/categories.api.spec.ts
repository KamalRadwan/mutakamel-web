import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../../core/api/core-http';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { TradeHttp, bindTradeHttp, bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { StatusCounts } from '../../shared/trade-foundation.model';
import {
  countCategories,
  createCategory,
  deleteCategory,
  getCategory,
  getTreeLevel,
  listCategories,
  moveCategory,
  renameCategory,
  reorderCategory,
  searchCategories,
  setCategoryStatus,
} from './categories.api';
import type {
  CategoryDeleteReceipt,
  CategoryDetail,
  CategoryPage,
  CategoryReceipt,
  CategorySummary,
  CategoryTreePage,
} from './categories.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAT_ID = '01900000-0000-7000-8000-000000000010';
const PARENT_ID = '01900000-0000-7000-8000-000000000001';
const BEFORE_ID = '01900000-0000-7000-8000-000000000020';
const REASON_ID = '01900000-0000-7000-8000-000000000099';

function makeSummary(overrides: Partial<CategorySummary> = {}): CategorySummary {
  return {
    id: CAT_ID,
    code: 'ELEC',
    displayName: 'Electronics',
    name: 'Electronics',
    parentId: null,
    sortOrder: 1024,
    status: 'ACTIVE',
    version: 1,
    effectiveActive: true,
    inactiveAncestorId: null,
    depth: 1,
    childCount: 0,
    hasChildren: false,
    path: [
      {
        id: CAT_ID,
        code: 'ELEC',
        name: 'Electronics',
        siblingPosition: 1,
        siblingTotal: 1,
      },
    ],
    ...overrides,
  };
}

function makeDetail(overrides: Partial<CategoryDetail> = {}): CategoryDetail {
  return {
    ...makeSummary(),
    localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
    treeVersion: 5,
    subtreeHeight: 1,
    createdAt: '2026-11-23T09:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    usage: {
      directItemCount: 0,
      subtreeItemCount: 0,
      descendantCount: 0,
      hasRetainedItemReferences: false,
      canDelete: false,
      deleteBlockers: ['ACTIVE'],
      asOf: '2026-11-23T10:00:00.000Z',
    },
    ...overrides,
  };
}

function makePage(overrides: Partial<CategoryPage> = {}): CategoryPage {
  return {
    items: [makeSummary()],
    total: 1,
    page: 1,
    limit: 100,
    treeVersion: 5,
    asOf: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeTreePage(overrides: Partial<CategoryTreePage> = {}): CategoryTreePage {
  return {
    ...makePage(),
    parentId: null,
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<CategoryReceipt> = {}): CategoryReceipt {
  return {
    id: CAT_ID,
    version: 2,
    treeVersion: 6,
    changed: true,
    ...overrides,
  };
}

describe('categories.api (TradeHttpStub)', () => {
  it('getTreeLevel calls GET /categories/tree with mode NONE (no scope) and omits null parentId', async () => {
    const rootPage = makeTreePage({ parentId: null });
    const childPage = makeTreePage({ parentId: PARENT_ID, page: 2, limit: 50 });
    const stub = new TradeHttpStub({ 'GET /categories/tree': rootPage });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(getTreeLevel(null)).resolves.toEqual(rootPage);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/categories/tree',
        query: { page: 1, limit: 100 },
        scope: undefined,
      });

      stub.register('GET', '/categories/tree', childPage);
      await expect(getTreeLevel(PARENT_ID, 2, 50)).resolves.toEqual(childPage);
      expect(stub.recordedReads()[1]).toEqual({
        path: '/categories/tree',
        query: { parentId: PARENT_ID, page: 2, limit: 50 },
        scope: undefined,
      });

      const notFound = new ApiError(404, 'TRADE.CATALOG.CATEGORY_NOT_FOUND');
      stub.register('GET', '/categories/tree', notFound);
      await expect(getTreeLevel(PARENT_ID)).rejects.toBe(notFound);
    } finally {
      dispose();
    }
  });

  it('countCategories calls GET /categories/status-counts with mode NONE and unwraps counts', async () => {
    const counts: StatusCounts<'ACTIVE' | 'INACTIVE'> = { ACTIVE: 4, INACTIVE: 1, total: 5 };
    const stub = new TradeHttpStub({ 'GET /categories/status-counts': counts });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(countCategories()).resolves.toEqual(counts);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/categories/status-counts',
        query: undefined,
        scope: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('listCategories calls GET /categories with mode NONE and optional query params', async () => {
    const page = makePage();
    const stub = new TradeHttpStub({ 'GET /categories': page });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listCategories()).resolves.toEqual(page);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/categories',
        query: undefined,
        scope: undefined,
      });

      await listCategories({ status: 'INACTIVE', page: 2, limit: 25 });
      expect(stub.recordedReads()[1]).toEqual({
        path: '/categories',
        query: { status: 'INACTIVE', page: 2, limit: 25 },
        scope: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('searchCategories sends POST /categories/search (200 read) with whitelisted body, key and mode NONE', async () => {
    const page = makePage();
    const stub = new TradeHttpStub({ 'POST /categories/search': page });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const result = await searchCategories({
        search: 'elec',
        status: 'ACTIVE',
        page: 1,
        limit: 50,
        uiOnly: 'strip-me',
      } as never);
      expect(result).toEqual(page);

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({
        method: 'POST',
        path: '/categories/search',
        body: { search: 'elec', status: 'ACTIVE', page: 1, limit: 50 },
        ifMatch: undefined,
        scope: undefined,
        query: undefined,
      });
      expect(writes[0].key).toMatch(UUID_V7_REGEX);

      const invalidQuery = new ApiError(422, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID');
      stub.register('POST', '/categories/search', invalidQuery);
      await expect(searchCategories({ search: '   ' })).rejects.toBe(invalidQuery);
    } finally {
      dispose();
    }
  });

  it('getCategory calls GET /categories/:id with mode NONE and unwraps detail', async () => {
    const detail = makeDetail();
    const stub = new TradeHttpStub({ 'GET /categories/:id': detail });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(getCategory(CAT_ID)).resolves.toEqual(detail);
      expect(stub.recordedReads()[0]).toEqual({
        path: `/categories/${CAT_ID}`,
        query: undefined,
        scope: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('createCategory posts whitelisted body with key, mode NONE, local key checks and field validation error propagation', async () => {
    const receipt = makeReceipt({ version: 1, treeVersion: 6 });
    const stub = new TradeHttpStub({ 'POST /categories': receipt });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await createCategory(
        {
          expectedTreeVersion: 5,
          code: 'ELEC',
          displayName: 'Electronics',
          localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
          parentId: null,
          beforeId: null,
          extraField: 'drop-me',
        } as never,
        key,
      );
      expect(result).toEqual(receipt);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: '/categories',
        body: {
          expectedTreeVersion: 5,
          code: 'ELEC',
          displayName: 'Electronics',
          localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
          parentId: null,
          beforeId: null,
        },
        key,
        ifMatch: undefined,
        scope: undefined,
        query: undefined,
      });

      await expect(
        createCategory(
          {
            expectedTreeVersion: 5,
            code: 'ELEC',
            displayName: 'Electronics',
            localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
          },
          '',
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

      await expect(
        createCategory(
          {
            expectedTreeVersion: 5,
            code: 'ELEC',
            displayName: 'Electronics',
            localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
          },
          'not-a-uuid',
        ),
      ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });
      expect(stub.recordedWrites()).toHaveLength(1);

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { code: ['code must be a string'] });
      stub.register('POST', '/categories', validationErr);
      await expect(
        createCategory(
          {
            expectedTreeVersion: 5,
            code: 'ELEC',
            displayName: 'Electronics',
            localizedNames: { en: 'Electronics', ar: 'إلكترونيات' },
          },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { code: ['code must be a string'] },
      });
    } finally {
      dispose();
    }
  });

  it('renameCategory patches whitelisted body with key, If-Match and mode NONE', async () => {
    const receipt = makeReceipt({ version: 4, treeVersion: 7 });
    const stub = new TradeHttpStub({ 'PATCH /categories/:id': receipt });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await renameCategory(
        CAT_ID,
        { displayName: 'Devices', localizedNames: { en: 'Devices', ar: 'أجهزة' }, ignored: true } as never,
        3,
        key,
      );
      expect(result).toEqual(receipt);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'PATCH',
        path: `/categories/${CAT_ID}`,
        body: { displayName: 'Devices', localizedNames: { en: 'Devices', ar: 'أجهزة' } },
        key,
        ifMatch: '"3"',
        scope: undefined,
        query: undefined,
      });

      const nameTaken = new ApiError(409, 'TRADE.CATALOG.CATEGORY_NAME_TAKEN');
      stub.register('PATCH', '/categories/:id', nameTaken);
      await expect(renameCategory(CAT_ID, { displayName: 'Devices' }, 3, newIdempotencyKey())).rejects.toBe(nameTaken);
    } finally {
      dispose();
    }
  });

  it('moveCategory posts with key, If-Match, mode NONE and propagates 409 conflict', async () => {
    const receipt = makeReceipt({ version: 5, treeVersion: 8 });
    const stub = new TradeHttpStub({ 'POST /categories/:id/move': receipt });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await moveCategory(
        CAT_ID,
        { expectedTreeVersion: 7, parentId: PARENT_ID, beforeId: null, ignored: 'x' } as never,
        4,
        key,
      );
      expect(result).toEqual(receipt);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: `/categories/${CAT_ID}/move`,
        body: { expectedTreeVersion: 7, parentId: PARENT_ID, beforeId: null },
        key,
        ifMatch: '"4"',
        scope: undefined,
        query: undefined,
      });

      const conflict = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['tree'] });
      stub.register('POST', '/categories/:id/move', conflict);
      await expect(
        moveCategory(CAT_ID, { expectedTreeVersion: 7, parentId: null }, 4, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 409,
        code: 'TRADE.CONCURRENCY.STALE_VERSION',
        details: { stale: ['tree'] },
      });
    } finally {
      dispose();
    }
  });

  it('reorderCategory posts with key, If-Match, mode NONE and propagates 409 conflict', async () => {
    const receipt = makeReceipt({ version: 6, treeVersion: 9 });
    const stub = new TradeHttpStub({ 'POST /categories/:id/reorder': receipt });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await reorderCategory(
        CAT_ID,
        { expectedTreeVersion: 8, beforeId: BEFORE_ID, ignored: 'x' } as never,
        5,
        key,
      );
      expect(result).toEqual(receipt);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: `/categories/${CAT_ID}/reorder`,
        body: { expectedTreeVersion: 8, beforeId: BEFORE_ID },
        key,
        ifMatch: '"5"',
        scope: undefined,
        query: undefined,
      });

      const conflict = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['node'] });
      stub.register('POST', '/categories/:id/reorder', conflict);
      await expect(
        reorderCategory(CAT_ID, { expectedTreeVersion: 8, beforeId: null }, 5, newIdempotencyKey()),
      ).rejects.toMatchObject({
        status: 409,
        code: 'TRADE.CONCURRENCY.STALE_VERSION',
        details: { stale: ['node'] },
      });
    } finally {
      dispose();
    }
  });

  it('setCategoryStatus sends reasonCodeId/reasonNote without deprecated reason (F-12), with key, If-Match and NONE scope', async () => {
    const receipt = makeReceipt({ version: 7, treeVersion: 10 });
    const stub = new TradeHttpStub({ 'POST /categories/:id/status': receipt });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await setCategoryStatus(
        CAT_ID,
        {
          expectedTreeVersion: 9,
          status: 'INACTIVE',
          reasonCodeId: REASON_ID,
          reasonNote: 'Seasonal pause',
          reason: 'deprecated-must-not-be-sent',
        } as never,
        6,
        key,
      );
      expect(result).toEqual(receipt);
      const write = stub.recordedWrites()[0];
      expect(write).toEqual({
        method: 'POST',
        path: `/categories/${CAT_ID}/status`,
        body: {
          expectedTreeVersion: 9,
          status: 'INACTIVE',
          reasonCodeId: REASON_ID,
          reasonNote: 'Seasonal pause',
        },
        key,
        ifMatch: '"6"',
        scope: undefined,
        query: undefined,
      });
      expect('reason' in (write.body as Record<string, unknown>)).toBe(false);

      const noteRequired = new ApiError(422, 'TRADE.REASON.NOTE_REQUIRED', { field: ['reasonNote'] });
      stub.register('POST', '/categories/:id/status', noteRequired);
      await expect(
        setCategoryStatus(
          CAT_ID,
          { expectedTreeVersion: 9, status: 'INACTIVE', reasonCodeId: REASON_ID },
          6,
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 422,
        code: 'TRADE.REASON.NOTE_REQUIRED',
        details: { field: ['reasonNote'] },
      });
    } finally {
      dispose();
    }
  });

  it('deleteCategory sends reasonCodeId/reasonNote without deprecated reason (F-12), with key, If-Match and NONE scope', async () => {
    const receipt: CategoryDeleteReceipt = {
      id: CAT_ID,
      deleted: true,
      version: 8,
      treeVersion: 11,
      deletedAt: '2026-11-23T12:00:00.000Z',
    };
    const stub = new TradeHttpStub({ 'POST /categories/:id/delete': receipt });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const result = await deleteCategory(
        CAT_ID,
        {
          expectedTreeVersion: 10,
          reasonCodeId: REASON_ID,
          reasonNote: 'Duplicate entry',
          reason: 'deprecated-must-not-be-sent',
        } as never,
        7,
        key,
      );
      expect(result).toEqual(receipt);
      const write = stub.recordedWrites()[0];
      expect(write).toEqual({
        method: 'POST',
        path: `/categories/${CAT_ID}/delete`,
        body: {
          expectedTreeVersion: 10,
          reasonCodeId: REASON_ID,
          reasonNote: 'Duplicate entry',
        },
        key,
        ifMatch: '"7"',
        scope: undefined,
        query: undefined,
      });
      expect('reason' in (write.body as Record<string, unknown>)).toBe(false);

      const blocked = new ApiError(422, 'TRADE.CATALOG.CATEGORY_DELETE_BLOCKED');
      stub.register('POST', '/categories/:id/delete', blocked);
      await expect(
        deleteCategory(
          CAT_ID,
          { expectedTreeVersion: 10, reasonCodeId: REASON_ID },
          7,
          newIdempotencyKey(),
        ),
      ).rejects.toBe(blocked);
    } finally {
      dispose();
    }
  });
});

describe('categories.api (TradeHttp wire contract)', () => {
  const base = '/api/tenant/trade/v1';
  const envelope = (data: unknown) => ({
    success: true,
    data,
    correlationId: 'corr-cat',
    timestamp: '2026-11-23T12:00:00.000Z',
  });

  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    dispose = bindTradeHttpForTest();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookieName = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookieName}=csrf-proof`);
    bindTradeHttp(TestBed.inject(TradeHttp), tradeQueries(), TestBed.inject(CoreHttp));
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    dispose();
  });

  it('getTreeLevel sends zero x-mutakamel-* headers and unwraps the Trade envelope', async () => {
    const page = makeTreePage();
    const pending = getTreeLevel(null, 1, 100);
    const req = http.expectOne(`${base}/categories/tree?page=1&limit=100`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    req.flush(envelope(page));
    await expect(pending).resolves.toEqual(page);
  });

  it('searchCategories sends POST /categories/search with key and zero x-mutakamel-* headers', async () => {
    const page = makePage();
    const pending = searchCategories({ search: 'elec', page: 1, limit: 100 });
    const req = http.expectOne(`${base}/categories/search`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ search: 'elec', page: 1, limit: 100 });
    expect(req.request.headers.get('x-idempotency-key')).toMatch(UUID_V7_REGEX);
    expect(req.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    req.flush(envelope(page), { status: 200, statusText: 'OK' });
    await expect(pending).resolves.toEqual(page);
  });

  it('moveCategory sends If-Match and x-idempotency-key with zero x-mutakamel-* headers and maps 409 errors', async () => {
    const key = newIdempotencyKey();
    const pending = moveCategory(CAT_ID, { expectedTreeVersion: 5, parentId: PARENT_ID }, 3, key);
    const req = http.expectOne(`${base}/categories/${CAT_ID}/move`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    expect(req.request.headers.get('If-Match')).toBe('"3"');
    expect(req.request.headers.keys().filter((h) => h.toLowerCase().startsWith('x-mutakamel-'))).toEqual([]);
    const rejection = expect(pending).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.CONCURRENCY.STALE_VERSION',
      details: { stale: ['node'] },
      correlationId: 'corr-409',
    });
    req.flush(
      {
        success: false,
        errorCode: 'TRADE.CONCURRENCY.STALE_VERSION',
        details: { stale: ['node'] },
        correlationId: 'corr-409',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await rejection;
  });
});
