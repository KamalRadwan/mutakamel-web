import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../shared/crm-http';
import * as opportunitiesApi from './opportunities.api';

describe('Opportunities API retirement', () => {
  let http: HttpTestingController;
  let disposeHttp: () => void;
  const id = '019f0000-0000-7000-8000-000000000003';
  const path = `/api/tenant/crm/v1/opportunities/${id}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    disposeHttp = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    crmQueries().clear();
  });

  afterEach(() => {
    http.verify();
    crmQueries().clear();
    disposeHttp();
  });

  it('keeps the live record read using the bare CRM response', async () => {
    const pending = opportunitiesApi.getOpportunity(id);
    const request = http.expectOne(path);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
    expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
    request.flush({ id, title: 'Live opportunity' });
    await expect(pending).resolves.toEqual({ id, title: 'Live opportunity' });
  });

  it('preserves backend errors for the existing error handling without fake fallback', async () => {
    const pending = opportunitiesApi.getOpportunity(id);
    const rejected = expect(pending).rejects.toMatchObject({ status: 404, code: 'OPPORTUNITY_NOT_FOUND' });
    http.expectOne(path).flush({ code: 'OPPORTUNITY_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await rejected;
  });

  it('removes the unused fake-backed exports from the public API', () => {
    expect(opportunitiesApi).not.toHaveProperty('getRelatedCounts');
    expect(opportunitiesApi).not.toHaveProperty('listCustomerOpportunities');
  });
});
