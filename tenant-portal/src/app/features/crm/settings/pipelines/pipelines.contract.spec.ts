import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import {
  addPipelineStage, assignmentOptions, beginPipelineEdit, createPipeline, deletePipeline,
  getPipelineAssignments, getPipelineConfiguration, listPipelinesConfiguration, listPipelinesForRead,
  removePipelineStage, reorderPipelineStages, replaceAssignments, resetPipeline, setDefaultPipeline, updatePipeline,
} from './pipelines.api';
import type { Pipeline } from './pipelines.model';

const base = '/api/tenant/crm/v1';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const pipeline = (CRM_SETTINGS_FIXTURES['/pipelines/configuration'] as Pipeline[])[0];
const id = pipeline.id;
const createBody = { code: 'ENTERPRISE', nameAr: 'المؤسسات', nameEn: 'Enterprise' };
const assignments = { accessMode: 'RESTRICTED' as const, userIds: ['user'], teamIds: ['team'] };
const writes = [
  { name: 'create', method: 'POST', path: '/pipelines', body: createBody, response: pipeline, call: (key: string, changed = false) => createPipeline({ ...createBody, nameEn: changed ? 'Changed' : createBody.nameEn }) },
  { name: 'update', method: 'PATCH', path: `/pipelines/${id}`, body: { nameEn: 'Updated' }, response: pipeline, call: (key: string, changed = false) => updatePipeline(id, { nameEn: changed ? 'Changed' : 'Updated' }) },
  { name: 'delete', method: 'DELETE', path: `/pipelines/${id}`, body: null, response: null, call: () => deletePipeline(id) },
  { name: 'set default', method: 'PUT', path: `/pipelines/${id}/default`, body: null, response: pipeline, call: (key: string) => setDefaultPipeline(id, key) },
  { name: 'reset', method: 'POST', path: `/pipelines/${id}/reset`, body: null, response: pipeline, call: () => resetPipeline(id) },
  { name: 'attach stage', method: 'POST', path: `/pipelines/${id}/stages`, body: { opportunityStageId: 'stage' }, response: pipeline.stages[0], call: (key: string, changed = false) => addPipelineStage(id, changed ? 'another' : 'stage') },
  { name: 'reorder', method: 'PATCH', path: `/pipelines/${id}/stages/reorder`, body: { orderedIds: ['membership'] }, response: pipeline.stages, call: (key: string, changed = false) => reorderPipelineStages(id, [changed ? 'another' : 'membership'], key) },
  { name: 'detach stage', method: 'DELETE', path: `/pipelines/${id}/stages/membership`, body: null, response: null, call: () => removePipelineStage(id, 'membership') },
  { name: 'assignments', method: 'PUT', path: `/pipelines/${id}/assignments`, body: assignments, response: assignments, call: (key: string, changed = false) => replaceAssignments(id, { ...assignments, userIds: [changed ? 'another' : 'user'] }, key) },
];

for (const language of ['en', 'ar']) for (const theme of ['light', 'dark']) {
describe(`${language} ${theme}`, () => {
describe('PipelinesApi', () => {
  let http: HttpTestingController;
  let dispose: () => void;
  let originalAttributes: (string | null)[];
  beforeEach(() => {
    originalAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const doc = TestBed.inject(DOCUMENT);
    const cookie = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${cookie}=csrf-pipelines`);
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
  });
  afterEach(() => {
    http.verify();
    crmQueries().clear();
    dispose();
    vi.restoreAllMocks();
    ['lang', 'dir', 'data-theme'].forEach((name, index) => {
      const value = originalAttributes[index];
      if (value === null) document.documentElement.removeAttribute(name);
      else document.documentElement.setAttribute(name, value);
    });
  });

  it('reads every pipeline route with bare bodies', async () => {
    for (const [path, call, response] of [
      ['/pipelines', listPipelinesForRead, []],
      ['/pipelines/configuration', listPipelinesConfiguration, [pipeline]],
      [`/pipelines/${id}/configuration`, () => getPipelineConfiguration(id), pipeline],
      [`/pipelines/${id}/assignments`, () => getPipelineAssignments(id), assignments],
      ['/pipelines/assignment-options?search=enterprise&limit=20', () => assignmentOptions('enterprise', 20), { users: [], teams: [] }],
    ] as const) {
      const pending = call();
      http.expectOne(`${base}${path}`).flush(response);
      await expect(pending).resolves.toEqual(response);
    }
  });

  it('sorts default first then code', async () => {
    const pending = listPipelinesConfiguration();
    const unsorted = [
      { ...pipeline, id: 'z', code: 'Z', isDefault: false },
      { ...pipeline, id: 'a', code: 'A', isDefault: false },
      { ...pipeline, id: 'default', code: 'DEFAULT', isDefault: true },
    ];
    http.expectOne(`${base}/pipelines/configuration`).flush(unsorted);
    expect((await pending).map((item) => item.id)).toEqual(['default', 'a', 'z']);
  });

  it('set default sends the key', async () => {
    const key = newIdempotencyKey();
    const pending = setDefaultPipeline(id, key);
    const request = http.expectOne(`${base}/pipelines/${id}/default`);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(key).toMatch(uuidV7);
    request.flush(pipeline);
    await pending;
  });

  it('assignments dedupe and key', async () => {
    const key = newIdempotencyKey();
    const pending = replaceAssignments(id, { ...assignments, userIds: ['user', 'user'], teamIds: ['team', 'team'] }, key);
    const request = http.expectOne(`${base}/pipelines/${id}/assignments`);
    expect(request.request.body).toEqual(assignments);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush(assignments);
    await expect(pending).resolves.toEqual(assignments);
  });

  describe.each(writes)('$name', (operation) => {
    it('sends UUID v7, csrf, exact body, no scope or revision, then invalidates queries', async () => {
      const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      const pending = operation.call(newIdempotencyKey());
      const request = http.expectOne(`${base}${operation.path}`);
      expect(request.request.method).toBe(operation.method);
      expect(request.request.body).toEqual(operation.body);
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
      expect(request.request.headers.get('x-csrf-token')).toBe('csrf-pipelines');
      expect(request.request.headers.has('If-Match')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      request.flush(operation.response, { status: operation.method === 'DELETE' ? 204 : operation.method === 'POST' ? 201 : 200, statusText: 'Success' });
      await pending;
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'pipelines'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'pipelines'] });
    });

    it.each([0, 503, 409, 401])('keeps the same key and body after retryable outcome %s', async (status) => {
      const key = newIdempotencyKey();
      const first = operation.call(key);
      const assertion = expect(first).rejects.toMatchObject({ status });
      const request = http.expectOne(`${base}${operation.path}`);
      const sentKey = request.request.headers.get('x-idempotency-key');
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ errorCode: status === 409 ? 'GW.IDEM.IN_FLIGHT' : status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR' }, { status, statusText: 'Error' });
      await assertion;
      http.expectNone(`${base}${operation.path}`);
      const retry = operation.call(key);
      const replay = http.expectOne(`${base}${operation.path}`);
      expect(replay.request.headers.get('x-idempotency-key')).toBe(sentKey);
      expect(replay.request.body).toEqual(request.request.body);
      replay.flush(operation.response);
      await retry;
    });

    it('uses a new key after a final outcome', async () => {
      const first = operation.call(newIdempotencyKey());
      const assertion = expect(first).rejects.toMatchObject({ status: 422 });
      const request = http.expectOne(`${base}${operation.path}`);
      request.flush({ errorCode: 'CRM_VALIDATION_FAILED', details: { nameEn: ['Name is invalid'] } }, { status: 422, statusText: 'Invalid' });
      await assertion;
      http.expectNone(`${base}${operation.path}`);
      const next = operation.call(newIdempotencyKey());
      const nextRequest = http.expectOne(`${base}${operation.path}`);
      expect(nextRequest.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
      nextRequest.flush(operation.response);
      await next;
    });
  });

  it.each(writes.filter((operation) => operation.body !== null))('$name gets a new key when the body changes', async (operation) => {
    const first = operation.call(newIdempotencyKey());
    const assertion = expect(first).rejects.toMatchObject({ status: 503 });
    const request = http.expectOne(`${base}${operation.path}`);
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion;
    const changed = operation.call(newIdempotencyKey(), true);
    const next = http.expectOne(`${base}${operation.path}`);
    expect(next.request.body).not.toEqual(request.request.body);
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
    next.flush(operation.response);
    await changed;
  });

  it('starts a new action when a form is reopened', async () => {
    const first = createPipeline(createBody);
    const assertion = expect(first).rejects.toMatchObject({ status: 503 });
    const request = http.expectOne(`${base}/pipelines`);
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion;
    beginPipelineEdit(null);
    const reopened = createPipeline(createBody);
    const next = http.expectOne(`${base}/pipelines`);
    expect(next.request.headers.get('x-idempotency-key')).not.toBe(request.request.headers.get('x-idempotency-key'));
    next.flush(pipeline);
    await reopened;
  });
});
});
}
