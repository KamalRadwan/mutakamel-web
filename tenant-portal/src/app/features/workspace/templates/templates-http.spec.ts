import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { TemplatesHttp } from './templates-http';

describe('TemplatesHttp', () => {
  let api: TemplatesHttp;
  let http: HttpTestingController;
  const path = '/api/tenant/core/v1/templates';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=csrf-proof`);
    api = TestBed.inject(TemplatesHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('returns the cursor page', async () => {
    const page = { items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } };
    const pending = api.cursorPage(path, { cursor: 'next', limit: 25 });
    const request = http.expectOne(`${path}?cursor=next&limit=25`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: page });
    await expect(pending).resolves.toEqual(page);
  });

  it('rejects a malformed cursor page', async () => {
    for (const page of [null, {}, { items: [] }, { items: {}, pageInfo: {} },
      { items: [], pageInfo: { limit: 25, hasNextPage: false } },
      { items: [], pageInfo: { limit: 0, hasNextPage: false, nextCursor: null } },
      { items: [], pageInfo: { limit: 25, hasNextPage: 'false', nextCursor: null } }]) {
      const pending = api.cursorPage(path);
      http.expectOne(path).flush({ success: true, data: page });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('keyed writes forward key and If-Match', async () => {
    const key = newIdempotencyKey();
    const pending = api.write('PATCH', path, { name: 'Updated' }, { key, ifMatch: '"7"' });
    const request = http.expectOne(path);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('If-Match')).toBe('"7"');
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    request.flush({ success: true, data: {} }, { headers: { ETag: '"8"', Location: '/next' } });
    await expect(pending).resolves.toMatchObject({ status: 200, etag: '"8"', location: '/next' });
  });

  it('rejects incomplete receipts and unexpected statuses without losing transport errors', async () => {
    const definition = { templateId: 'template', revision: 1, etag: '"1"' };
    const draft = { draftId: 'draft', revision: 1, etag: '"1"' };
    for (const [status, data] of [[201, null], [201, { definition, draft: {} }],
      [201, { definition: { ...definition, revision: 0 }, draft }], [200, { definition, draft }]] as const) {
      const pending = api.command('create', 'POST', path, {}, { key: newIdempotencyKey() });
      http.expectOne(path).flush({ success: true, data }, { status, statusText: 'OK' });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
    const thumbnail = api.command('retryThumbnail', 'POST', path, {}, { key: newIdempotencyKey() });
    http.expectOne(path).flush({ success: true, data: null }, { status: 202, statusText: 'Accepted' });
    await expect(thumbnail).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });

    const pending = api.command('create', 'POST', path, {}, { key: newIdempotencyKey() });
    http.expectOne(path).flush({ errorCode: 'CORE.TEMPLATE.CODE.CONFLICT', correlationId: 'correlation' },
      { status: 409, statusText: 'Conflict' });
    await expect(pending).rejects.toMatchObject({ status: 409, code: 'CORE.TEMPLATE.CODE.CONFLICT', correlationId: 'correlation' });
  });

  it('rejects recovery items without actual actor IDs', () => {
    for (const item of [null, {}, { snapshotId: 'snapshot', createdBy: {}, restoredBy: null },
      { snapshotId: 'snapshot', createdBy: 'creator' },
      { snapshotId: 'snapshot', createdBy: 'creator', restoredBy: {} }]) {
      expect(() => api.recoverySnapshot(item)).toThrow(expect.objectContaining({ status: 502 }));
    }
    expect(api.recoverySnapshot({ snapshotId: 'snapshot', createdBy: 'creator', restoredBy: null,
      sourceContentChecksum: 'checksum' })).toMatchObject({ sourceContentChecksum: 'checksum',
      createdBy: { kind: 'USER', actorId: 'creator', displayName: 'creator' }, restoredBy: null });
  });

  it('preserves both worker layout formats and structured fonts', async () => {
    const box = { x: 0, y: 0, width: 190, height: 277 };
    const object = { sourceNodeId: 'node-1', pageId: 'page-1', bounds: box };
    for (const receipt of [
      { layoutRuntimeChecksum: 'a'.repeat(64), geometryUnit: 'MM', pageLayoutMode: 'UNIFORM',
        pages: [{ pageId: 'page-1', widthMm: 210, heightMm: 297, contentBox: box, headerBox: box, footerBox: box }],
        fragments: [{ ...object, continuationIndex: 0, rowIndex: 1 }], fonts: [{ family: 'Tajawal', weight: '400', style: 'normal' }] },
      { layoutRuntimeChecksum: 'b'.repeat(64), pagedRuntimeChecksum: 'c'.repeat(64), geometryUnit: 'CSS_PX', pageLayoutMode: 'EXPLICIT',
        pages: [{ pageId: 'page-1', paper: box, content: box }], objects: [object], dataRows: [{ ...object, rowIndex: 0 }] },
    ]) {
      const pending = api.layoutReceipt(path);
      http.expectOne(path).flush({ success: true, data: receipt });
      await expect(pending).resolves.toEqual(receipt);
    }
  });

  it('rejects legacy or malformed layout geometry', async () => {
    const box = { x: 0, y: 0, width: 190, height: 277 };
    const receipt = { layoutRuntimeChecksum: 'a'.repeat(64), geometryUnit: 'MM', pageLayoutMode: 'UNIFORM',
      pages: [{ pageId: 'page-1', widthMm: 210, heightMm: 297, contentBox: box }], fragments: [], fonts: [] };
    for (const data of [null, { pages: [] }, { ...receipt, geometryUnit: 'CSS_PX' }, { ...receipt, pagedRuntimeChecksum: {} },
      { ...receipt, pages: [{ pageIndex: 0, width: 210, height: 297 }] }, { ...receipt, fonts: ['Tajawal'] },
      { ...receipt, pages: [...receipt.pages, ...receipt.pages] },
      { ...receipt, fragments: [{ sourceNodeId: 'node', pageId: 'missing', bounds: box, continuationIndex: 0 }] },
      { ...receipt, fragments: [{ sourceNodeId: 'node', pageId: 'page-1', bounds: { ...box, width: -1 }, continuationIndex: 0 }] },
      { ...receipt, fragments: [{ sourceNodeId: 'node', pageId: 'page-1', bounds: box, continuationIndex: -1 }] },
    ]) {
      const pending = api.layoutReceipt(path);
      http.expectOne(path).flush({ success: true, data });
      await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });
});
