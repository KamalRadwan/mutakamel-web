import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { createLeadSource, deleteLeadSource, listLeadSources, reorderLeadSources, updateLeadSource, uploadLeadSourceIcon } from './lead-sources.api';
import type { LeadSource } from './lead-sources.model';

const base = '/api/tenant/crm/v1/acquisition-sources';
const id = '0192b8ea-7c4f-7a7d-9c9f-51c7f2b30001';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const row: LeadSource = { id, nameAr: 'الموقع', nameEn: 'Website', isActive: true, sortOrder: 1,
  iconUrl: `${base}/${id}/icon?v=1234567890abcdef`, createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z' };

describe('LeadSourcesApi', () => {
  let http: HttpTestingController;
  let dispose: () => void;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-source`);
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
  });

  afterEach(() => { http.verify(); dispose(); vi.restoreAllMocks(); });

  function write(url: string, method: string) {
    const request = http.expectOne(url);
    expect(request.request.method).toBe(method);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-source');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    expect(request.request.headers.has('If-Match')).toBe(false);
    return request;
  }

  it('reads the bare catalogue without filters, including an empty response', async () => {
    for (const body of [[row], []]) {
      const result = listLeadSources();
      http.expectOne(base).flush(body);
      await expect(result).resolves.toEqual(body);
    }
  });

  it('creates trimmed names, keeps isActive false and returns the server view', async () => {
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    const result = createLeadSource({ nameAr: ' الموقع ', nameEn: ' Website ', isActive: false });
    const request = write(base, 'POST');
    expect(request.request.body).toEqual({ nameAr: 'الموقع', nameEn: 'Website', isActive: false });
    request.flush({ ...row, isActive: false }, { status: 201, statusText: 'Created' });
    await expect(result).resolves.toEqual({ ...row, isActive: false });
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'lead-sources'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'lead-sources'] });
  });

  it('updates only the supplied fields and keeps the server response intact', async () => {
    const result = updateLeadSource(id, { nameEn: ' New name ', isActive: false });
    const request = write(`${base}/${id}`, 'PATCH');
    expect(request.request.body).toEqual({ nameEn: 'New name', isActive: false });
    request.flush({ ...row, nameEn: 'New name', isActive: false });
    await expect(result).resolves.toEqual({ ...row, nameEn: 'New name', isActive: false });
  });

  it('deletes without a body and accepts 204', async () => {
    const result = deleteLeadSource(id);
    const request = write(`${base}/${id}`, 'DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeUndefined();
  });

  it('adopts the complete server list returned by reorder', async () => {
    const key = newIdempotencyKey();
    const result = reorderLeadSources([id], key);
    const request = write(`${base}/reorder`, 'PATCH');
    expect(request.request.body).toEqual({ orderedIds: [id] });
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    const server = [{ ...row, nameEn: 'Concurrent rename' }];
    request.flush(server);
    await expect(result).resolves.toEqual(server);
  });

  it('reorder key reused on retry', async () => {
    const key = newIdempotencyKey();
    const result = reorderLeadSources([id], key);
    const rejected = expect(result).rejects.toMatchObject({ status: 0 });
    const first = write(`${base}/reorder`, 'PATCH');
    first.error(new ProgressEvent('error'));
    await rejected;
    http.expectNone(() => true);
    const retry = reorderLeadSources([id], key);
    const second = write(`${base}/reorder`, 'PATCH');
    expect(second.request.body).toEqual(first.request.body);
    expect(second.request.headers.get('x-idempotency-key')).toBe(key);
    second.flush([row]);
    await retry;
  });

  it('icon upload body', async () => {
    const key = newIdempotencyKey();
    const file = new File(['png bytes'], 'icon.png', { type: 'image/png' });
    const result = uploadLeadSourceIcon(id, file, key);
    const request = write(`${base}/${id}/icon`, 'POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect([...request.request.body.keys()]).toEqual(['file']);
    expect(request.request.body.get('file')).toBe(file);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush(row, { status: 201, statusText: 'Created' });
    await expect(result).resolves.toEqual(row);
  });

  it.each(['POST', 'PATCH', 'DELETE'] as const)('%s keeps its key and body after each retryable failure and 401', async (method) => {
    const send = () => method === 'POST' ? createLeadSource({ nameAr: 'الموقع', nameEn: 'Website' })
      : method === 'PATCH' ? updateLeadSource(id, { nameEn: 'Website' }) : deleteLeadSource(id);
    const url = method === 'POST' ? base : `${base}/${id}`;
    let key: string | null = null;
    let body: unknown;
    for (const [status, code] of [[0, 'NETWORK_ERROR'], [503, 'ENTITLEMENT_UNAVAILABLE'], [409, 'GW.IDEM.IN_FLIGHT'], [401, 'UNAUTHORIZED']] as const) {
      const result = send();
      const rejected = expect(result).rejects.toMatchObject({ status, code });
      const request = write(url, method);
      if (key) {
        expect(request.request.headers.get('x-idempotency-key')).toBe(key);
        expect(request.request.body).toEqual(body);
      }
      key = request.request.headers.get('x-idempotency-key');
      body = request.request.body;
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ errorCode: code }, { status, statusText: 'Failure' });
      await rejected;
      http.expectNone(() => true);
    }
    const result = send();
    const request = write(url, method);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush(method === 'DELETE' ? null : row, { status: method === 'DELETE' ? 204 : 200, statusText: 'OK' });
    await result;
    const fresh = send();
    const next = write(url, method);
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(key);
    next.flush(method === 'DELETE' ? null : row, { status: method === 'DELETE' ? 204 : 200, statusText: 'OK' });
    await fresh;
  });

  it.each(['POST', 'PATCH'] as const)('%s gives changed values a new key', async (method) => {
    const send = (nameEn: string) => method === 'POST'
      ? createLeadSource({ nameAr: 'الموقع', nameEn }) : updateLeadSource(id, { nameEn });
    const url = method === 'POST' ? base : `${base}/${id}`;
    const failed = send('First');
    const rejected = expect(failed).rejects.toBeInstanceOf(ApiError);
    const first = write(url, method);
    first.error(new ProgressEvent('error'));
    await rejected;
    const changed = send('Changed');
    const second = write(url, method);
    expect(second.request.headers.get('x-idempotency-key')).not.toBe(first.request.headers.get('x-idempotency-key'));
    second.flush(row);
    await changed;
  });

  it.each([
    [400, 'CRM_VALIDATION_FAILED'], [404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND'],
    [409, 'CRM_ACQUISITION_SOURCE_NAME_TAKEN'], [422, 'CRM_ACQUISITION_SOURCE_LIMIT_EXCEEDED'],
    [422, 'GW.IDEM.MISMATCH'], [429, 'GW.RATE.LIMIT_EXCEEDED'], [403, 'CRM_SUBSCRIPTION_READ_ONLY'],
  ])('preserves %s %s without an automatic retry', async (status, code) => {
    const result = updateLeadSource(id, { nameEn: 'Test' });
    const rejected = expect(result).rejects.toMatchObject({ status, code, correlationId: 'source-ref' });
    const request = write(`${base}/${id}`, 'PATCH');
    request.flush({ errorCode: code, details: { nameEn: ['Name must be shorter'] }, correlationId: 'source-ref' }, { status: Number(status), statusText: 'Failure' });
    await rejected;
    if (code === 'CRM_VALIDATION_FAILED') expect(Object.keys(fieldErrorsOf(await result.catch((error: unknown) => error)))).toEqual(['nameEn']);
    http.expectNone(() => true);
    const fresh = updateLeadSource(id, { nameEn: 'Test' });
    const next = write(`${base}/${id}`, 'PATCH');
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
    next.flush(row);
    await fresh;
  });
});
