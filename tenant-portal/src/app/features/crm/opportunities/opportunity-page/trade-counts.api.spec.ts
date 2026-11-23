import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { getTradeCounts } from './trade-counts.api';

const companyId = '019f0000-0000-7000-8000-000000000001';
const branchId = '019f0000-0000-7000-8000-000000000002';
const opportunityId = '019f0000-0000-7000-8000-000000000003';
const path = '/api/tenant/trade/v1/documents/counts-by-crm-opportunity';

describe('TradeCounts API', () => {
  const selection = signal<{ companyId: string; branchId: string | null }>({ companyId, branchId });
  const branchCompanies = signal(new Map([[branchId, companyId]]));
  let http: HttpTestingController;
  let disposeHttp: () => void;
  let disposeRuntime: () => void;

  beforeEach(() => {
    selection.set({ companyId, branchId });
    branchCompanies.set(new Map([[branchId, companyId]]));
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { selection, branchCompanies } },
    ] });
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof');
    http = TestBed.inject(HttpTestingController);
    disposeHttp = bindCrmHttpForTest();
    disposeRuntime = bindCrmInjectorForTest(() => TestBed.inject(EnvironmentInjector));
    crmQueries().clear();
  });

  afterEach(() => {
    http.verify();
    crmQueries().clear();
    disposeRuntime();
    disposeHttp();
    vi.restoreAllMocks();
  });

  async function request() {
    const pending = getTradeCounts(opportunityId);
    await Promise.resolve();
    const testRequest = http.expectOne(path);
    expect(testRequest.request.method).toBe('POST');
    expect(testRequest.request.body).toEqual({ opportunityIds: [opportunityId] });
    expect(testRequest.request.withCredentials).toBe(true);
    expect(testRequest.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(testRequest.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(testRequest.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    return { pending, testRequest };
  }

  it('shows counts from the matching item in the bare Trade body', async () => {
    const { pending, testRequest } = await request();
    testRequest.flush({ items: [
      { opportunityId: 'another', quotations: 99, salesOrders: 99 },
      { opportunityId, quotations: 3, salesOrders: 2 },
    ] });
    await expect(pending).resolves.toEqual({ quotations: 3, salesOrders: 2 });
  });

  it('no trade access returns null without rejecting', async () => {
    const { pending, testRequest } = await request();
    testRequest.flush({ code: 'TRADE.AUTH.TARGET_DENIED' }, { status: 403, statusText: 'Forbidden' });
    await expect(pending).resolves.toBeNull();
  });

  it('preserves zero and unavailable document-type counts', async () => {
    const { pending, testRequest } = await request();
    testRequest.flush({ items: [{ opportunityId, quotations: 0, salesOrders: null }] });
    await expect(pending).resolves.toEqual({ quotations: 0, salesOrders: null });
  });

  it('does not invent zero counts for a missing opportunity', async () => {
    const { pending, testRequest } = await request();
    testRequest.flush({ items: [] });
    await expect(pending).resolves.toBeNull();
  });

  it('does not request counts for company-only or ambiguous scope', async () => {
    selection.set({ companyId, branchId: null });
    await expect(getTradeCounts(opportunityId)).resolves.toBeNull();
    selection.set({ companyId, branchId });
    branchCompanies.set(new Map());
    await expect(getTradeCounts(opportunityId)).resolves.toBeNull();
    http.expectNone(path);
  });

  it('keeps server failures for the shared load-failure state and Retry', async () => {
    const { pending, testRequest } = await request();
    const rejected = expect(pending).rejects.toMatchObject({ status: 503, correlationId: 'counts-correlation' });
    testRequest.flush({ code: 'SERVER_ERROR', correlationId: 'counts-correlation' }, { status: 503, statusText: 'Unavailable' });
    await rejected;
    http.expectNone(path);
  });
});
